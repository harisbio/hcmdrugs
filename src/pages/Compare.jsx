import React, { useEffect, useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { useVersion, useDrugs, firstVersionOf } from '../versions';
import { useVersionLink, useCompare, StatusLabel, ClassLabel, MAX_COMPARE } from '../components';
import { normClass, normStatus, normNature, splitRefs, splitBrands, idNumber } from '../lib/drugs';

const ROWS = [
  { label: 'Class', get: d => normClass(d.drugClass), render: d => <ClassLabel cls={normClass(d.drugClass)} />, cmp: true },
  { label: 'Recorded class', get: d => d.drugClass },
  { label: 'FDA status', get: d => normStatus(d.status), render: d => <StatusLabel status={normStatus(d.status)} />, cmp: true },
  { label: 'Origin', get: d => normNature(d.nature), cmp: true },
  { label: 'Source', get: d => d.source || '—', cmp: true },
  { label: 'First in version', get: d => `v${firstVersionOf(d.drugId)}`, cmp: true },
  { label: 'Brand names', get: d => String(splitBrands(d.brandNames).length), render: d => <span className="num">{splitBrands(d.brandNames).length}</span> },
  { label: 'References', get: d => String(splitRefs(d.references).length), render: d => <span className="num">{splitRefs(d.references).length}</span> },
  { label: 'Effects in HCM', get: d => d.effects, long: true },
  { label: 'Molecular targets', get: d => d.molecularTargets, long: true },
];

function ShareLink({ ids, version }) {
  const [done, setDone] = React.useState(false);
  const url = `${window.location.origin}${window.location.pathname}#/compare?ids=${ids.join(',')}&v=${version}`;
  const copy = async () => {
    try { await navigator.clipboard.writeText(url); setDone(true); setTimeout(() => setDone(false), 1600); } catch { /* blocked */ }
  };
  return <button className="btn btn-sm" onClick={copy}>{done ? 'Link copied' : 'Copy share link'}</button>;
}

export default function Compare() {
  const { version } = useVersion();
  const { drugs, loading } = useDrugs();
  const compare = useCompare();
  const to = useVersionLink();
  const [params, setParams] = useSearchParams();

  // A shared link (?ids=) replaces the current compare list.
  const urlIds = (params.get('ids') || '').split(/[,|]/).filter(Boolean).slice(0, MAX_COMPARE);
  useEffect(() => {
    if (!urlIds.length) return;
    const same = urlIds.length === compare.ids.length && urlIds.every(id => compare.has(id));
    if (!same) { compare.clear(); urlIds.forEach(id => compare.toggle(id)); }
    // From here on the page follows the compare list, so removing a drug updates the table.
    const next = new URLSearchParams(params);
    next.delete('ids');
    setParams(next, { replace: true });
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const ids = urlIds.length ? urlIds : compare.ids;
  const selected = useMemo(() => ids.map(id => drugs.find(d => d.drugId === id)).filter(Boolean)
    .sort((a, b) => idNumber(a.drugId) - idNumber(b.drugId)), [ids, drugs]);
  const missing = ids.filter(id => !drugs.some(d => d.drugId === id));

  return (
    <div className="wrap">
      <header className="doc-head">
        <h1>Side-by-side comparison</h1>
        <p className="dek">
          Compare up to {MAX_COMPARE} drugs field by field. Rows where the drugs differ are highlighted.
          Add drugs from the Explorer or from any monograph.
        </p>
      </header>

      {!loading && selected.length === 0 && (
        <div className="frame empty" style={{ margin: '24px 0 56px' }}>
          <p>No drugs selected yet.</p>
          <Link className="btn btn-ink btn-sm" style={{ marginTop: 12 }} to={to('/explorer')}>Choose drugs in the Explorer</Link>
        </div>
      )}

      {selected.length > 0 && (
        <div className="actions" style={{ marginTop: 18 }}>
          <ShareLink ids={selected.map(d => d.drugId)} version={version} />
          <button className="btn btn-sm" onClick={compare.clear}>Clear all</button>
        </div>
      )}

      {missing.length > 0 && !loading && (
        <p className="caption" style={{ marginTop: 16 }}>Not in v{version}: {missing.join(', ')}.</p>
      )}

      {selected.length > 0 && (
        <div className="compare-wrap">
          <table className="compare">
            <thead>
              <tr>
                <th style={{ minWidth: 150 }}><span className="kicker">Field</span></th>
                {selected.map(d => (
                  <th key={d.drugId}>
                    <div className="row" style={{ justifyContent: 'space-between' }}>
                      <span className="lbl lbl-id">{d.drugId}</span>
                      <button className="btn btn-sm" onClick={() => compare.remove(d.drugId)} aria-label={`Remove ${d.name}`}><X size={12} /></button>
                    </div>
                    <h2><Link to={to(`/drug/${d.drugId}`)} style={{ color: 'var(--ink)', textDecoration: 'none' }}>{d.name}</Link></h2>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ROWS.map(r => {
                const differs = r.cmp && selected.length > 1 && new Set(selected.map(r.get)).size > 1;
                return (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th>
                    {selected.map(d => (
                      <td key={d.drugId} className={`${r.long ? 'long' : ''}${differs ? ' diff' : ''}`}>
                        {r.render ? r.render(d) : (r.get(d) || '—')}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
