// Cleans and standardizes data/v<version>/drugs.json in place (latest
// version by default, or `--version X.Y.Z`), then refreshes that version's
// drugCount / added / removed in data/versions.json.
// Safe to run repeatedly: every step is idempotent.
//
//   npm run clean:data   (then `npm run export:csv` to refresh the CSV)
//
// Output conventions:
//   nature      "Synthetic" | "Natural"
//   status      "FDA approved" | "Not FDA approved"
//   drugClass   one of CLASS_MAP's values
//   brandNames  comma-separated, de-duplicated ("" when unknown)
//   references  separated by " | " ("" when none); DOIs as https://doi.org/...
//   missing     "" (never "N/A" or "NULL")

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRecords, syncManifestEntry, targetVersion, writeRecords } from "./lib/versions.mjs";

export const REF_SEPARATOR = " | ";

/* ── Encoding repair ─────────────────────────────────────────────────────
   Much of the text was UTF-8 that got decoded as Windows-1252 one or more
   times (e.g. "–" stored as "Ã¢â‚¬â€œ"). Re-encode runs of suspect chars
   back to bytes and decode as UTF-8 until the text stops changing. */
const CP1252 = {
  "€": 0x80, "‚": 0x82, "ƒ": 0x83, "„": 0x84, "…": 0x85, "†": 0x86, "‡": 0x87,
  "ˆ": 0x88, "‰": 0x89, "Š": 0x8a, "‹": 0x8b, "Œ": 0x8c, "Ž": 0x8e, "‘": 0x91,
  "’": 0x92, "“": 0x93, "”": 0x94, "•": 0x95, "–": 0x96, "—": 0x97, "˜": 0x98,
  "™": 0x99, "š": 0x9a, "›": 0x9b, "œ": 0x9c, "ž": 0x9e, "Ÿ": 0x9f,
};
const utf8 = new TextDecoder("utf-8", { fatal: true });
const SUSPECT_RUN = new RegExp(`[\\u0080-\\u00ff${Object.keys(CP1252).join("")}]{2,}`, "g");

function decodeRun(run) {
  for (let i = 0; i < 4; i += 1) {
    const bytes = [];
    for (const ch of run) {
      const code = CP1252[ch] ?? ch.charCodeAt(0);
      if (code > 0xff) return run;
      bytes.push(code);
    }
    let next;
    try {
      next = utf8.decode(Uint8Array.from(bytes));
    } catch {
      return run; // not mojibake (e.g. a genuine "é") — leave it
    }
    if (next === run) return run;
    run = next;
  }
  return run;
}

const fixEncoding = (s) => s.replace(SUSPECT_RUN, decodeRun);

/* ── Generic text cleanup ─────────────────────────────────────────────── */
function cleanText(value) {
  let s = fixEncoding(String(value ?? ""));
  s = s
    .replace(/&nacute;/g, "ń")
    .replace(/&amp;/g, "&")
    .replace(/[  -​ ]/g, " ") // nbsp & friends
    .replace(/[\u0080-\u009f]/g, "") // stray C1 control chars
    .replace(/\bAntiarrythm/g, "Antiarrhythm")
    .replace(/\bantiarrythm/g, "antiarrhythm")
    .replace(/[ \t]+/g, " ")
    .replace(/\s+([,.;:])(?=\s|$)/g, "$1")
    .trim();
  if (/^(n\/?a|null|none|-)$/i.test(s)) return "";
  return s;
}

/* ── Controlled vocabularies ──────────────────────────────────────────── */
const CLASS_MAP = [
  [/^alpha and beta/i, "Alpha and Beta Blocker"],
  [/^beta.?blocker and antiarrhythmic/i, "Beta Blocker and Antiarrhythmic"],
  [/^beta.?blocker$/i, "Beta Blocker"],
  [/^calcium channel blocker$/i, "Calcium Channel Blocker"],
  [/^antianginal/i, "Antianginal Agent"],
  [/^class (ia|ib|ic|iii) antiarrhythmic$/i, (m) => `Class ${fmtRoman(m[1])} Antiarrhythmic`],
  [/^antiarrhythmic$/i, "Antiarrhythmic"],
  [/^loop diuretic$/i, "Loop Diuretic"],
  [/^thiazide diuretic$/i, "Thiazide Diuretic"],
  [/aldosterone antagonist|potassium.sparing/i, "Potassium-Sparing Diuretic (Aldosterone Antagonist)"],
  [/^angii?otensin converting enzymes? (blocker|inhibitor)s?\.?$|^angiotensin-converting enzyme \(ace\) inhibitor$/i,
    "Angiotensin-Converting Enzyme (ACE) Inhibitor"],
  [/^angiotensin ii receptor blocker/i, "Angiotensin II Receptor Blocker (ARB)"],
  [/^cardiac glycosides?$/i, "Cardiac Glycoside"],
  [/^cardiac myosin inhibitors?$/i, "Cardiac Myosin Inhibitor"],
  [/^anticoagulants?$/i, "Anticoagulant"],
];
function fmtRoman(r) {
  return r.toUpperCase() === "III" ? "III" : r[0].toUpperCase() + r.slice(1).toLowerCase();
}
function standardClass(raw) {
  const c = cleanText(raw);
  for (const [re, out] of CLASS_MAP) {
    const m = c.match(re);
    if (m) return typeof out === "function" ? out(m) : out;
  }
  throw new Error(`Unmapped drug class: "${c}" — add it to CLASS_MAP`);
}

function standardNature(raw) {
  const n = cleanText(raw).toLowerCase();
  if (/^nat/.test(n)) return "Natural";
  if (/^synth|^syntheitc/.test(n)) return "Synthetic";
  throw new Error(`Unmapped nature: "${raw}"`);
}

// Known approvals used to fill the two records stored as NULL.
const STATUS_OVERRIDES = { WARFARIN: "FDA approved", DABIGATRAN: "FDA approved" };
function standardStatus(raw, name) {
  const s = cleanText(raw).toLowerCase();
  if (!s) {
    if (STATUS_OVERRIDES[name]) return STATUS_OVERRIDES[name];
    throw new Error(`Missing status for ${name}`);
  }
  if (/\bnot\b/.test(s)) return "Not FDA approved";
  if (/approv/.test(s)) return "FDA approved";
  throw new Error(`Unmapped status: "${raw}"`);
}

function standardSource(raw) {
  const s = cleanText(raw);
  if (/^synthe(sized|tic) compound$/i.test(s)) return "Synthetic compound";
  if (/^cinchona bark$/i.test(s)) return "Extracted from Cinchona bark";
  if (/^sweet clover plant$/i.test(s)) return "Derived from sweet clover plant";
  return s;
}

const NAME_FIXES = { ACEBUTALOL: "ACEBUTOLOL" };
function standardName(raw) {
  const n = cleanText(raw).toUpperCase();
  return NAME_FIXES[n] ?? n;
}

function standardBrands(raw) {
  const seen = new Set();
  const out = [];
  for (const part of cleanText(raw).split(",")) {
    const b = part.trim();
    if (!b || seen.has(b.toLowerCase())) continue;
    seen.add(b.toLowerCase());
    out.push(b);
  }
  return out.join(", ");
}

/* ── References ───────────────────────────────────────────────────────── */
const BARE_DOI = /^(?:doi:\s*)?(10\.\d{4,9}\/\S+)$/i;
const SPLIT = "\u0000";

function splitReferences(raw) {
  // "&NA;" is a placeholder for a missing author/volume in the source export
  let s = cleanText(raw)
    .replace(/,\s*NA;\s*\(/g, ", (")
    .replace(/(^|;\s*)&NA;\s*/g, "$1") // missing author at start of a reference
    .replace(/&NA(?=;)/g, "") // junk glued to the end of a DOI
    .replace(/&NA;?/g, "");
  if (!s) return [];
  // Already in the standard format?
  if (s.includes(REF_SEPARATOR.trim())) return s.split("|").map((r) => r.trim()).filter(Boolean);

  s = s
    // reference glued onto the end of a DOI: "...0315-8Tendera, M."
    .replace(/(https?:\/\/doi\.org\/\S+?)(?=[A-Z][A-Za-z'’-]+,\s+[A-Z]\.)/g, `$1${SPLIT}`)
    // "; " that ends a reference (prev char ends a citation, not a title)
    .replace(/(?<=[.\d)]|https?:\/\/\S+);\s+/g, SPLIT)
    // trailing separators
    .replace(/[;\s]+$/, "");

  const refs = [];
  for (let part of s.split(SPLIT)) {
    part = part.trim().replace(/;$/, "").trim();
    if (!part) continue;
    // list of bare DOIs separated by commas
    const pieces = part.split(/,\s*/);
    if (pieces.length > 1 && pieces.every((p) => BARE_DOI.test(p.trim()))) {
      refs.push(...pieces.map((p) => p.trim()));
    } else {
      refs.push(part);
    }
  }

  const seen = new Set();
  return refs
    .map((r) => {
      const m = r.match(BARE_DOI);
      return m ? `https://doi.org/${m[1]}` : r;
    })
    .filter((r) => {
      const key = r.toLowerCase().replace(/\W/g, "");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

/* ── Main ─────────────────────────────────────────────────────────────── */
function cleanRecord(r) {
  const name = standardName(r.name);
  return {
    id: r.id,
    drugId: cleanText(r.drugId).toUpperCase(),
    name,
    effects: cleanText(r.effects),
    nature: standardNature(r.nature),
    molecularTargets: cleanText(r.molecularTargets),
    drugClass: standardClass(r.drugClass),
    status: standardStatus(r.status, name),
    source: standardSource(r.source),
    brandNames: standardBrands(r.brandNames),
    references: splitReferences(r.references).join(REF_SEPARATOR),
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = targetVersion();
  const records = readRecords(version).map(cleanRecord);

  const ids = records.map((r) => r.drugId);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length) throw new Error(`Duplicate drug IDs: ${dupIds.join(", ")}`);
  const badIds = ids.filter((id) => !/^HCM\d{4}$/.test(id));
  if (badIds.length) throw new Error(`Malformed drug IDs: ${badIds.join(", ")}`);

  records.sort((a, b) => a.drugId.localeCompare(b.drugId));
  writeRecords(version, records);
  const entry = syncManifestEntry(version);
  console.log(
    `Cleaned v${version}: ${records.length} records` +
      (entry.added.length ? `, added ${entry.added.map((d) => d.name).join(", ")}` : "") +
      (entry.removed.length ? `, removed ${entry.removed.map((d) => d.name).join(", ")}` : "")
  );
}
