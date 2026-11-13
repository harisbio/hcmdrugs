// Reads data/v<version>/drugs.csv into that version's drugs.json
// (latest version by default, or `--version X.Y.Z`).
//
// Rows are matched to existing records by drugId, so each drug keeps its
// numeric id and createdAt; updatedAt changes only when its content changed.
// New drugIds get the next free id. Run `npm run clean:data` afterwards
// (`npm run import:csv` does both).

import fs from "node:fs";
import { csvPath, jsonPath, readRecords, targetVersion, writeRecords } from "./lib/versions.mjs";

const FIELDS = [
  "drugId",
  "name",
  "effects",
  "nature",
  "molecularTargets",
  "drugClass",
  "status",
  "source",
  "brandNames",
  "references",
];

// RFC 4180 parser: handles quoted fields containing commas, quotes and newlines.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const version = targetVersion();
const rows = parseCsv(fs.readFileSync(csvPath(version), "utf8").replace(/^﻿/, ""));
if (rows.length < 2) throw new Error("CSV must include a header and at least one row.");

const headers = rows[0].map((h) => h.trim());
for (const f of FIELDS) if (!headers.includes(f)) throw new Error(`Missing column: ${f}`);

const existing = fs.existsSync(jsonPath(version)) ? readRecords(version) : [];
const byDrugId = new Map(existing.map((r) => [r.drugId, r]));
let nextId = Math.max(0, ...existing.map((r) => r.id || 0)) + 1;
const now = new Date().toISOString().replace("T", " ").slice(0, 19);

const records = [];
for (const values of rows.slice(1)) {
  const obj = Object.fromEntries(headers.map((h, i) => [h, values[i] ?? ""]));
  if (!obj.drugId || !obj.name) continue;
  const prev = byDrugId.get(obj.drugId.trim());
  const content = Object.fromEntries(FIELDS.map((f) => [f, obj[f]]));
  const changed = !prev || FIELDS.some((f) => (prev[f] ?? "") !== content[f]);
  records.push({
    id: prev?.id ?? nextId++,
    ...content,
    createdAt: prev?.createdAt ?? now,
    updatedAt: changed ? now : prev.updatedAt,
  });
}

records.sort((a, b) => a.drugId.localeCompare(b.drugId));
writeRecords(version, records);
console.log(`Converted ${records.length} records to ${jsonPath(version)}`);
