import fs from "node:fs";
import https from "node:https";
import { csvPath, positionalArgs, targetVersion } from "./lib/versions.mjs";

// Saves a published Google Sheet CSV as data/v<version>/drugs.csv
// (latest version by default, or `--version X.Y.Z`).
const outCsvPath = csvPath(targetVersion());

const url = positionalArgs()[0];
if (!url) {
  console.error("Usage: node scripts/import-google-sheet-csv.mjs <published-csv-url>");
  process.exit(1);
}

https
  .get(url, (res) => {
    if (res.statusCode !== 200) {
      console.error(`Download failed. Status: ${res.statusCode}`);
      process.exit(1);
    }
    let body = "";
    res.on("data", (chunk) => {
      body += chunk;
    });
    res.on("end", () => {
      fs.writeFileSync(outCsvPath, body);
      console.log(`Saved CSV to ${outCsvPath}`);
      console.log("Now run: npm run import:csv");
    });
  })
  .on("error", (err) => {
    console.error(`Request error: ${err.message}`);
    process.exit(1);
  });
