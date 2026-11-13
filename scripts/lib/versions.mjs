// Shared helpers for the versioned data layout:
//
//   data/versions.json          manifest: latest version + changelog
//   data/v<version>/drugs.json  records for that version
//   data/v<version>/drugs.csv   CSV export of the same records
//
// Scripts act on the latest version unless given `--version X.Y.Z`.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
export const projectRoot = path.resolve(here, "..", "..");
export const dataRoot = path.join(projectRoot, "data");
export const manifestPath = path.join(dataRoot, "versions.json");

const SEMVER = /^\d+\.\d+\.\d+$/;

export function readManifest() {
  return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
}

export function writeManifest(manifest) {
  manifest.versions.sort((a, b) => compareVersions(b.version, a.version));
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
}

export function compareVersions(a, b) {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i += 1) if (pa[i] !== pb[i]) return pa[i] - pb[i];
  return 0;
}

/** Version named by `--version X.Y.Z` in argv, else the latest one. */
export function targetVersion(argv = process.argv) {
  const i = argv.indexOf("--version");
  const v = i >= 0 ? argv[i + 1] : readManifest().latest;
  if (!SEMVER.test(v || "")) throw new Error(`Invalid version "${v}" (expected X.Y.Z)`);
  return v;
}

/** argv without the `--version X.Y.Z` pair, for scripts with positional args. */
export function positionalArgs(argv = process.argv) {
  const out = argv.slice(2);
  const i = out.indexOf("--version");
  if (i >= 0) out.splice(i, 2);
  return out;
}

export const versionDir = (v) => path.join(dataRoot, `v${v}`);
export const jsonPath = (v) => path.join(versionDir(v), "drugs.json");
export const csvPath = (v) => path.join(versionDir(v), "drugs.csv");

export function readRecords(v) {
  const data = JSON.parse(fs.readFileSync(jsonPath(v), "utf8"));
  return data.records ?? data;
}

export function writeRecords(v, records) {
  fs.mkdirSync(versionDir(v), { recursive: true });
  const out = { version: v, generatedAt: new Date().toISOString(), count: records.length, records };
  fs.writeFileSync(jsonPath(v), JSON.stringify(out, null, 2) + "\n");
}

/** The version released immediately before `v`, or null. */
export function previousVersion(v) {
  const older = readManifest()
    .versions.map((x) => x.version)
    .filter((x) => compareVersions(x, v) < 0)
    .sort(compareVersions);
  return older.length ? older[older.length - 1] : null;
}

/** Recompute drugCount / added / removed for `v` from the data files. */
export function syncManifestEntry(v) {
  const manifest = readManifest();
  const entry = manifest.versions.find((x) => x.version === v);
  if (!entry) throw new Error(`Version ${v} is not listed in data/versions.json`);
  const pick = (r) => ({ drugId: r.drugId, name: r.name });
  const records = readRecords(v);
  const prev = previousVersion(v);
  const prevRecords = prev ? readRecords(prev) : [];
  const ids = new Set(records.map((r) => r.drugId));
  const prevIds = new Set(prevRecords.map((r) => r.drugId));
  entry.drugCount = records.length;
  entry.added = prev ? records.filter((r) => !prevIds.has(r.drugId)).map(pick) : [];
  entry.removed = prev ? prevRecords.filter((r) => !ids.has(r.drugId)).map(pick) : [];
  writeManifest(manifest);
  return entry;
}
