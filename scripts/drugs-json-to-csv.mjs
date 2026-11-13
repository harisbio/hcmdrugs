// Writes data/v<version>/drugs.csv from that version's drugs.json
// (latest version by default, or `--version X.Y.Z`).

import fs from "node:fs";
import { csvPath, readRecords, targetVersion } from "./lib/versions.mjs";

const version = targetVersion();
const records = readRecords(version);
const outPath = csvPath(version);

export const CSV_HEADERS = [
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

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

const lines = [CSV_HEADERS.join(",")];
for (const row of records) {
  lines.push(CSV_HEADERS.map((h) => csvEscape(row[h])).join(","));
}

fs.writeFileSync(outPath, lines.join("\n") + "\n");
console.log(`Wrote ${records.length} rows to ${outPath}`);
