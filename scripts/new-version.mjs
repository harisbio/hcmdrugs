// Starts a new database version by copying the latest version's data.
//
//   npm run new-version -- 1.2.0 "Short title" "One-sentence summary"
//
// Creates data/v1.2.0/ (drugs.json + drugs.csv), adds it to
// data/versions.json and marks it as latest. Then edit that version's data
// and run `npm run clean:data` (which records the added/removed drug IDs).
// Older version folders are never modified by the other scripts unless you
// pass `--version` explicitly.

import fs from "node:fs";
import {
  compareVersions,
  csvPath,
  jsonPath,
  readManifest,
  readRecords,
  versionDir,
  writeManifest,
  writeRecords,
} from "./lib/versions.mjs";

const [version, title = "", summary = ""] = process.argv.slice(2);
if (!/^\d+\.\d+\.\d+$/.test(version || "")) {
  console.error('Usage: npm run new-version -- X.Y.Z "Title" "Summary"');
  process.exit(1);
}

const manifest = readManifest();
const latest = manifest.latest;
if (manifest.versions.some((v) => v.version === version)) throw new Error(`v${version} already exists`);
if (compareVersions(version, latest) <= 0) throw new Error(`v${version} must be newer than v${latest}`);
if (fs.existsSync(versionDir(version))) throw new Error(`${versionDir(version)} already exists`);

writeRecords(version, readRecords(latest));
fs.copyFileSync(csvPath(latest), csvPath(version));

manifest.latest = version;
manifest.versions.push({
  version,
  released: new Date().toISOString().slice(0, 10),
  title,
  summary,
  drugCount: readRecords(version).length,
  added: [],
  removed: [],
});
writeManifest(manifest);
console.log(`Created v${version} from v${latest} -> ${jsonPath(version)}`);
