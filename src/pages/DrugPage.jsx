import React, { useMemo, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { Check, Copy } from 'lucide-react';
import { useVersion, useDrugs, LATEST, firstVersionOf, formatDate } from '../versions';
import { useVersionLink, useNewIds, useCompare, StatusLabel, ClassLabel, NewLabel } from '../components';
import { normClass, normStatus, normNature, splitRefs, splitBrands, idNumber, STATUS_LABEL } from '../lib/drugs';

/** Turns URLs inside a reference into links. */
function Linkified({ text }) {
  return text.split(/(https?:\/\/[^\s]+)/g).map((p, i) => {
    if (!/^https?:\/\//.test(p)) return <React.Fragment key={i}>{p}</React.Fragment>;
    const url = p.replace(/[.,;]+$/, '');
    return <React.Fragment key={i}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a>{p.slice(url.length)}</React.Fragment>;
  });
}

function CopyButton({ text, label = 'Copy' }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* blocked */ }
  };
  return <button className="btn btn-sm" onClick={copy}>{done ? <Check size={13} /> : <Copy size={13} />} {done ? 'Copied' : label}</button>;
}

const SECTIONS = [
  ['effects', 'Effects in HCM'],
  ['targets', 'Molecular targets'],
  ['regulatory', 'Regulatory status & source'],
  ['nomenclature', 'Nomenclature'],
  ['evidence', 'Evidence'],
];

export default function DrugPage() {
  const { drugId } = useParams();
  const { version, setVersion } = useVersion();
  const { drugs, loading } = useDrugs();
  const newIds = useNewIds();
  const compare = useCompare();
  const to = useVersionLink();
  const location = useLocation();

  const ordered = useMemo(() => [...drugs].sort((a, b) => idNumber(a.drugId) - idNumber(b.drugId)), [drugs]);
  const idx = ordered.findIndex(d => d.drugId === drugId);
  const drug = ordered[idx];
  const backTo = location.state?.back !== undefined ? { pathname: '/explorer', search: location.state.back } : to('/explorer');

  if (loading) return <div className="wrap" style={{ padding: '64px 0' }}>Loading…</div>;

  if (!drug) {
    return (
      <div className="wrap">
        <header className="doc-head">
          <span className="kicker">Monograph · {drugId}</span>
          <h1>{drugId} is not in version {version}</h1>
          <p className="dek">This record does not exist in the dataset version you are viewing.</p>
          <div className="actions" style={{ marginTop: 18 }}>
            {version !== LATEST && <button className="btn btn-ink" onClick={() => setVersion(LATEST)}>Look in the latest version (v{LATEST})</button>}
            <Link className="btn" to={to('/explorer')}>Back to the Explorer</Link>
          </div>
        </header>
      </div>
    );
  }

  const cls = normClass(drug.drugClass);
  const status = normStatus(drug.status);
  const refs = splitRefs(drug.references);
  const brands = splitBrands(drug.brandNames);
  const since = firstVersionOf(drug.drugId);
  const updated = (drug.updatedAt || '').slice(0, 10);
  const prev = ordered[idx - 1];
  const next = ordered[idx + 1];
  const permalink = `${window.location.origin}${window.location.pathname}#/drug/${drug.drugId}?v=${version}`;
  const titleCase = drug.name.charAt(0) + drug.name.slice(1).toLowerCase();

  return (
    <div className="wrap">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to={backTo}>explorer</Link><span>/</span><span>monograph</span><span>/</span><span>{drug.drugId}</span>
      </nav>

      <header className="mono-head">
        <span className="kicker">Monograph · {drug.drugId} · dataset v{version}</span>
        <h1>{drug.name}</h1>
        <p className="classline">{drug.drugClass}</p>
        <div className="row" style={{ marginTop: 12 }}>
          <ClassLabel cls={cls} /><StatusLabel status={status} />
          {newIds.has(drug.drugId) && <NewLabel version={version} />}
        </div>
        <dl className="meta-strip">
          <div><dt>Record</dt><dd className="num">{drug.drugId}</dd></div>
          <div><dt>FDA status</dt><dd>{STATUS_LABEL[status]}</dd></div>
          <div><dt>Origin</dt><dd>{normNature(drug.nature)}</dd></div>
          <div><dt>First in</dt><dd className="num">v{since}</dd></div>
          <div><dt>Last updated</dt><dd className="num">{updated ? formatDate(updated) : '—'}</dd></div>
          <div><dt>References</dt><dd className="num">{refs.length}</dd></div>
        </dl>
      </header>

      <div className="mono-layout">
        <nav className="mono-index" aria-label="Sections">
          {SECTIONS.map(([id, label], i) => (
            <a key={id} href={`#${id}`} onClick={e => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ block: 'start' }); }}>
              <span>{i + 1}</span>{label}
            </a>
          ))}
          <div className="tools">
            <button className="btn btn-sm" onClick={() => compare.toggle(drug.drugId)} disabled={!compare.has(drug.drugId) && compare.full}>
              {compare.has(drug.drugId) ? 'Remove from compare' : 'Add to compare'}
            </button>
            {compare.ids.length > 0 && <Link className="btn btn-sm" to={to('/compare', { ids: compare.ids.join(',') })}>Open compare ({compare.ids.length})</Link>}
            <CopyButton text={permalink} label="Copy permalink" />
          </div>
        </nav>

        <article>
          <section id="effects" className="msec">
            <h2><span>1</span>Effects in HCM</h2>
            <p>{drug.effects || 'Not available.'}</p>
          </section>

          <section id="targets" className="msec">
            <h2><span>2</span>Molecular targets</h2>
            <p>{drug.molecularTargets || 'Not available.'}</p>
          </section>

          <section id="regulatory" className="msec">
            <h2><span>3</span>Regulatory status &amp; source</h2>
            <table className="kv-table"><tbody>
              <tr><th>Pharmacological class</th><td>{drug.drugClass}</td></tr>
              <tr><th>FDA status</th><td>{STATUS_LABEL[status]} (any indication)</td></tr>
              <tr><th>Origin</th><td>{normNature(drug.nature)}</td></tr>
              <tr><th>Source</th><td>{drug.source || '—'}</td></tr>
            </tbody></table>
          </section>

          <section id="nomenclature" className="msec">
            <h2><span>4</span>Nomenclature</h2>
            <table className="kv-table" style={{ marginBottom: 12 }}><tbody>
              <tr><th>Generic name</th><td>{titleCase}</td></tr>
              <tr><th>Brand names</th><td className="num">{brands.length}</td></tr>
            </tbody></table>
            {brands.length
              ? <div className="brands">{brands.map(b => <span key={b} className="lbl">{b}</span>)}</div>
              : <p className="muted" style={{ fontFamily: 'var(--sans)', fontSize: '0.9rem' }}>No brand names recorded.</p>}
          </section>

          <section id="evidence" className="msec">
            <h2><span>5</span>Evidence</h2>
            {refs.length
              ? <ol className="refs">{refs.map((r, i) => <li key={i}><span><Linkified text={r} /></span></li>)}</ol>
              : <p className="muted" style={{ fontFamily: 'var(--sans)', fontSize: '0.9rem' }}>No references recorded for this drug.</p>}
          </section>

          <nav className="prevnext" aria-label="Adjacent records">
            {prev ? <Link to={to(`/drug/${prev.drugId}`)} state={location.state}>← {prev.drugId} {prev.name}</Link> : <span />}
            {next ? <Link to={to(`/drug/${next.drugId}`)} state={location.state}>{next.drugId} {next.name} →</Link> : <span />}
          </nav>
        </article>
      </div>
    </div>
  );
}
