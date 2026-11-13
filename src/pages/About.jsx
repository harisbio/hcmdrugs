import React, { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ArrowUpRight, Check, Copy, Eye } from 'lucide-react';
import { useVersion, useDrugs, VERSIONS, LATEST, formatDate, totalDrugs } from '../versions';
import { useVersionLink, ClassLabel } from '../components';
import { normClass } from '../lib/drugs';

const DOI = '10.1142/S2737416525500954';
const PAPER = 'Haris, M., Rahman, S., Qamar, M. T. u., & Azeem, F. (2026). HCMdrugs: A web-based database cataloging the drugs available for the treatment of hypertrophic cardiomyopathy. Journal of Computational Biophysics and Chemistry, 25(09), 1341–1350. https://doi.org/10.1142/S2737416525500954';
const BIBTEX = `@article{haris2026hcmdrugs,
  author  = {Haris, Muhammad and Rahman, Shahroz and Qamar, Muhammad Tahir ul and Azeem, Farrukh},
  title   = {{HCMdrugs}: A Web-Based Database Cataloging the Drugs Available for the Treatment of Hypertrophic Cardiomyopathy},
  journal = {Journal of Computational Biophysics and Chemistry},
  year    = {2026},
  volume  = {25},
  number  = {09},
  pages   = {1341--1350},
  doi     = {${DOI}}
}`;

const SECTIONS = [
  ['overview', 'Overview'],
  ['scope', 'Scope and inclusion'],
  ['model', 'Data model'],
  ['classes', 'Classification'],
  ['versioning', 'Versioning policy'],
  ['cite', 'How to cite'],
  ['versions', 'Version history'],
  ['team', 'Authors'],
  ['licence', 'Licence'],
];

const FIELDS = [
  ['drugId', 'string', 'Stable record identifier; never reused.', 'HCM0024'],
  ['name', 'string', 'Generic (non-proprietary) name, upper case.', 'VERAPAMIL'],
  ['effects', 'text', 'Effects of the drug in HCM and the clinical evidence for them.', '—'],
  ['molecularTargets', 'text', 'Receptors, channels or enzymes acted on, and the resulting mechanism.', '—'],
  ['drugClass', 'controlled', 'Pharmacological class from a fixed vocabulary (§4).', 'Calcium Channel Blocker'],
  ['status', 'controlled', 'FDA approval for any indication.', 'FDA approved | Not FDA approved'],
  ['nature', 'controlled', 'Origin of the compound.', 'Synthetic | Natural'],
  ['source', 'string', 'How the compound is obtained.', 'Synthetic compound'],
  ['brandNames', 'list', 'Marketed names, comma-separated, de-duplicated.', 'Calan, Isoptin, …'],
  ['references', 'list', 'Supporting publications, separated by " | "; DOIs as https://doi.org/….', '—'],
];

function CopyButton({ text, label }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* blocked */ }
  };
  return <button className="btn btn-sm" onClick={copy}>{done ? <Check size={13} /> : <Copy size={13} />} {done ? 'Copied' : label}</button>;
}

function VersionHistory() {
  const { version: current, setVersion } = useVersion();
  return (
    <ol className="timeline">
      {VERSIONS.map(v => (
        <li key={v.version}>
          <div className="head">
            <h3>v{v.version}</h3>
            <span style={{ fontFamily: 'var(--serif)', fontSize: '1.02rem' }}>{v.title}</span>
            {v.version === LATEST && <span className="lbl lbl-latest">latest</span>}
            {v.version === current && <span className="lbl lbl-id">viewing</span>}
          </div>
          <p className="meta">released {formatDate(v.released)} · {totalDrugs(v.version)} drugs{v.added?.length ? ` · +${v.added.length}` : ''}{v.removed?.length ? ` · −${v.removed.length}` : ''}</p>
          {v.summary && <p>{v.summary}</p>}
          {v.added?.length > 0 && <p><b>Added:</b> {v.added.map(d => `${d.name} (${d.drugId})`).join(', ')}.</p>}
          {v.removed?.length > 0 && <p><b>Removed:</b> {v.removed.map(d => `${d.name} (${d.drugId})`).join(', ')}.</p>}
          {v.version !== current && (
            <div className="actions">
              <button className="btn btn-sm" onClick={() => setVersion(v.version)}><Eye size={13} /> View this version</button>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}

export default function About() {
  const { version } = useVersion();
  const { drugs } = useDrugs();
  const to = useVersionLink();
  const location = useLocation();

  const classes = useMemo(() => {
    const m = new Map();
    for (const d of drugs) {
      const k = normClass(d.drugClass);
      if (!m.has(k)) m.set(k, { raw: new Set(), n: 0 });
      m.get(k).raw.add(d.drugClass);
      m.get(k).n += 1;
    }
    return [...m.entries()].map(([cls, v]) => ({ cls, raw: [...v.raw].sort(), n: v.n })).sort((a, b) => b.n - a.n || a.cls.localeCompare(b.cls));
  }, [drugs]);

  useEffect(() => {
    if (location.state?.scrollTo) setTimeout(() => document.getElementById(location.state.scrollTo)?.scrollIntoView({ block: 'start' }), 50);
  }, [location.state]);


  return (
    <div className="wrap">
      <header className="doc-head">
        <h1>Methods, data model and citation</h1>
        <p className="dek">How the database is organized, what each field means, how versions are managed, and how to cite HCMdrugs.</p>
      </header>

      <div className="methods">
        <nav className="toc" aria-label="Contents">
          <span className="kicker" style={{ display: 'block', marginBottom: 8 }}>Contents</span>
          {SECTIONS.map(([id, label], i) => (
            <a key={id} href={`#${id}`} onClick={e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ block: 'start' }); }}><span>{i + 1}</span>{label}</a>
          ))}
        </nav>

        <div className="paper">
          <section id="overview">
            <h2><span>1</span>Overview</h2>
            <p>
              HCMdrugs is a web-based database that catalogs the drugs available for the treatment of hypertrophic
              cardiomyopathy (HCM), the most common inherited disease of the heart muscle. Each record describes a
              single drug: its effects in HCM, its molecular targets, its pharmacological class and regulatory status,
              its origin and source, the names it is marketed under, and the published studies that support the entry.
            </p>
            <p>
              The database and its first release are described in a peer-reviewed article in the <i>Journal of
              Computational Biophysics and Chemistry</i> (2026). All records are open access and can be read without
              registration.
            </p>
          </section>

          <section id="scope">
            <h2><span>2</span>Scope and inclusion</h2>
            <p>A drug is included when it is used, or has been studied, in the management of HCM. This covers:</p>
            <ul>
              <li>drugs developed specifically for HCM, such as the cardiac myosin inhibitors;</li>
              <li>established cardiovascular drugs used to control symptoms, outflow tract obstruction or arrhythmias in HCM, such as beta blockers, calcium channel blockers and antiarrhythmics;</li>
              <li>drugs used for complications of HCM, such as anticoagulants for atrial fibrillation and diuretics for congestion;</li>
              <li>drugs that are not FDA approved but have been used or investigated in HCM; their status is recorded in each entry.</li>
            </ul>
            <p>
              Inclusion does not imply that a drug is recommended for HCM. Where trials in HCM were neutral or negative,
              the effects field states this. HCMdrugs is a research resource and not a substitute for clinical
              guidelines or medical advice.
            </p>
          </section>

          <section id="model">
            <h2><span>3</span>Data model</h2>
            <p>Each record has the following fields. Controlled fields take values from a fixed vocabulary; list fields hold several values.</p>
            <table className="spec">
              <thead><tr><th>Field</th><th>Type</th><th>Definition</th><th>Example / values</th></tr></thead>
              <tbody>
                {FIELDS.map(([f, t, def, ex]) => (
                  <tr key={f}><td><code>{f}</code></td><td className="mono" style={{ fontSize: '0.78rem' }}>{t}</td><td>{def}</td><td>{ex}</td></tr>
                ))}
              </tbody>
            </table>
            <p className="caption"><b>Table 2.</b> Record schema. Missing values are stored as empty strings.</p>
          </section>

          <section id="classes">
            <h2><span>4</span>Classification</h2>
            <p>
              Drugs are recorded with a pharmacological class and grouped into broader display classes for filtering
              and figures. The groups in v{version}, with the classes they contain, are listed below.
            </p>
            <table className="spec">
              <thead><tr><th>Display class</th><th>n</th><th>Recorded classes</th></tr></thead>
              <tbody>
                {classes.map(c => (
                  <tr key={c.cls}>
                    <td><Link to={to('/explorer', { class: c.cls })} style={{ textDecoration: 'none', color: 'inherit' }}><ClassLabel cls={c.cls} /></Link></td>
                    <td className="num">{c.n}</td>
                    <td>{c.raw.join('; ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="caption"><b>Table 3.</b> Classification in v{version}. Select a class to open its records.</p>
          </section>

          <section id="versioning">
            <h2><span>5</span>Versioning policy</h2>
            <p>
              HCMdrugs is released in numbered versions. Every version is preserved unchanged and remains available
              from the dataset selector, so a result can always be checked against the data it was based on.
            </p>
            <ul>
              <li><b>Minor versions</b> (1.0 → 1.1) add or remove drugs.</li>
              <li><b>Patch versions</b> (1.1.0 → 1.1.1) correct existing records without changing the set of drugs.</li>
              <li><b>Record IDs</b> are permanent: an ID always refers to the same drug, and IDs of removed drugs are not reused.</li>
            </ul>
          </section>

          <section id="cite">
            <h2><span>6</span>How to cite</h2>
            <p>Please cite the article that describes the database:</p>
            <div className="ref-block">{PAPER}</div>
            <div className="actions">
              <CopyButton text={PAPER} label="Copy citation" />
              <a className="btn btn-sm" href={`https://doi.org/${DOI}`} target="_blank" rel="noopener noreferrer">Article <ArrowUpRight size={13} /></a>
            </div>
            <h3>BibTeX</h3>
            <div className="code"><pre>{BIBTEX}</pre><CopyButton text={BIBTEX} label="Copy" /></div>
          </section>

          <section id="versions">
            <h2><span>7</span>Version history</h2>
            <p>The database opens on the latest version. Earlier versions can be viewed here or from the dataset selector.</p>
            <div style={{ marginTop: 20 }}><VersionHistory /></div>
          </section>

          <section id="team">
            <h2><span>8</span>Authors</h2>
            <p>
              Muhammad Haris, Shahroz Rahman, Muhammad Tahir ul Qamar and Farrukh Azeem. For other projects by the
              developer, see the <a href="https://harisbio.github.io/" target="_blank" rel="noopener noreferrer">developer's portfolio</a>.
            </p>
          </section>

          <section id="licence">
            <h2><span>9</span>Licence</h2>
            <p>
              The website's source code is released under the MIT License. All records are freely readable without
              registration. When reusing the data, please cite the article and the dataset version used.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
