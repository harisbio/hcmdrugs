# HCMdrugs Database

HCMdrugs is a curated, versioned database of drugs used or studied in the treatment of hypertrophic cardiomyopathy (HCM). Each record describes a drug's effects in HCM, its molecular targets, pharmacological class, FDA status, origin and brand names, with references to the published literature.

## Overview

The database is a static web application (React + Vite) that runs entirely in the browser and is deployed to GitHub Pages. It has five sections:

- **Overview**: dataset summary, a query bar, the therapeutic landscape (every drug grouped by class), a class × status composition table, and the changes in the selected version.
- **Explorer**: a workbench with faceted filters, a field-qualified query language (e.g. `class:myosin`, `target:"potassium channel"`, `-status:approved`), a sortable table or card view with selectable columns, a preview pane and keyboard navigation.
- **Drug monographs**: one page per drug with effects, molecular targets, regulatory status and source, nomenclature and numbered references.
- **Compare**: up to four drugs side by side, with differing fields highlighted.
- **Methods & citation**: scope, data model, classification, versioning policy, citation formats and version history.

## Citation

If you use this database in your research, please cite our published manuscript:

> Haris, M., Rahman, S., Qamar, M. T. u., & Azeem, F. (2026). HCMdrugs: A Web-Based Database Cataloging the Drugs Available for the Treatment of Hypertrophic Cardiomyopathy. *Journal of Computational Biophysics and Chemistry*, 25(09), 1341-1350. DOI: 10.1142/S2737416525500954

[![DOI](https://img.shields.io/badge/DOI-10.1142%2FS2737416525500954-blue.svg)](https://doi.org/10.1142/S2737416525500954)

## Getting Started

### Prerequisites

To run this project locally, ensure you have the following installed:
- [Node.js](https://nodejs.org/) 20.19 or later (or 22.12 or later)
- npm

### Installation

1. Clone the repository to your local machine:
   ```bash
   git clone https://github.com/harisbio/HCMdrugs.git
   ```
2. Navigate into the project directory:
   ```bash
   cd HCMdrugs
   ```
3. Install the required dependencies:
   ```bash
   npm install
   ```

## Usage

### Development Server

To launch the database interface locally in development mode, run:

```bash
npm run dev
```
This will start a local server where you can view and interact with the database.

### Building for Production

To create an optimized production build of the database interface:

```bash
npm run build
```
The compiled assets will be generated in the `dist` directory, ready to be deployed to your preferred hosting environment.

### Deploying to GitHub Pages

This repository is configured to automatically deploy to GitHub Pages using GitHub Actions whenever you push to the `main` branch.

To enable this:
1. Push this repository to GitHub.
2. Go to your repository **Settings** > **Pages** on GitHub.
3. Under **Build and deployment**, set the **Source** to **GitHub Actions**.
4. The `.github/workflows/deploy.yml` workflow will automatically run and publish your site!

*Note: `vite.config.js` uses a relative `base` (`'./'`) and the site uses hash-based routes, so it works under any repository name without changes.*

## Database Versions

Every release of the database is kept, so work that cites a specific version stays reproducible.
The site opens on the latest version; the dataset selector in the header (and the **Version history**
section of the Methods & citation page) lets visitors browse any earlier version. A version can be
linked directly with `?v=`, e.g. `https://<site>/#/explorer?v=1.0.0`.

```
data/
  versions.json        manifest: latest version + changelog (title, summary, added/removed drugs)
  v1.0.0/drugs.json    the original release (shown as 73 drugs, as published in Haris et al. 2026)
  v1.0.0/drugs.csv
  v1.1.0/drugs.json    adds mavacamten, aficamten, dofetilide, cibenzoline, ranolazine (shown as 78 drugs)
  v1.1.0/drugs.csv
```

Versions follow semantic versioning: adding or removing drugs bumps the minor number (1.1.0 → 1.2.0);
corrections to existing entries bump the patch number (1.1.0 → 1.1.1).

### Releasing a new version

1. `npm run new-version -- 1.2.0 "Short title" "One-sentence summary"` copies the latest version into
   `data/v1.2.0/` and makes it the latest.
2. Edit `data/v1.2.0/drugs.csv` (or the Google Sheet), then run `npm run import:csv`.
   New drugs get the next `HCMxxxx` ID; existing drugs keep their IDs.
3. `npm run clean:data` runs as part of the import. It standardizes the data and records which drugs
   were added or removed in `data/versions.json`, which the site shows as "New in v1.2.0" badges and in
   the version history.
4. Run `npm run export:csv` if you edited the JSON directly, then commit.

Never edit an older version's folder after it is released.

The drug totals shown on the site are hardcoded per version in `TOTAL_DRUGS` (`src/versions.jsx`); add a line there for each new version.

## Data Scripts

All scripts act on the **latest** version unless you add `--version X.Y.Z`
(e.g. `npm run export:csv -- --version 1.0.0`).

- `npm run new-version -- X.Y.Z "Title" "Summary"`: Starts a new version from the latest one.
- `npm run import:csv`: Imports `data/v<version>/drugs.csv` into JSON, then cleans it.
- `npm run export:csv`: Writes `data/v<version>/drugs.csv` from the JSON.
- `npm run import:sheet -- <published-csv-url>`: Downloads a Google Sheet CSV into the latest version's folder (then run `npm run import:csv`).
- `npm run clean:data`: Cleans and standardizes the version's JSON in place and updates its changelog entry (safe to re-run).
- `npm run extract:sql`: Rebuilds v1.0.0 from the legacy Laravel SQL dump.

### Data conventions

`scripts/clean-drugs.mjs` enforces these rules:

| Field | Format |
|---|---|
| `name` | Upper case, e.g. `NADOLOL` |
| `nature` | `Synthetic` or `Natural` |
| `status` | `FDA approved` or `Not FDA approved` |
| `drugClass` | A fixed vocabulary, e.g. `Beta Blocker`, `Calcium Channel Blocker`, `Cardiac Myosin Inhibitor`, `Class III Antiarrhythmic`, `Angiotensin II Receptor Blocker (ARB)`. New classes must be added to `CLASS_MAP` in `scripts/clean-drugs.mjs` |
| `brandNames` | Comma-separated, no duplicates |
| `references` | Separated by ` \| ` (space, pipe, space); bare DOIs written as `https://doi.org/...` |
| Missing values | Empty string (not `N/A` or `NULL`) |

When editing data in the CSV or Google Sheet, separate references with ` | `, not `;`, because many citations contain semicolons themselves.

## License

This project is open-source and available under the [MIT License](LICENSE).
