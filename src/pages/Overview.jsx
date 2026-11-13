import React, { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useVersion, useDrugs, totalDrugs, formatDate } from '../versions';
import { useVersionLink, useNewIds, ClassLabel } from '../components';
import {
  normClass, normStatus, normNature, classColor, splitRefs, splitBrands, idNumber,
  parseQuery, matchesQuery,
} from '../lib/drugs';

const DOI = '10.1142/S2737416525500954';
const EXAMPLES = ['class:myosin', 'status:not', 'target:"calcium channel"', 'nature:natural', 'effect:LVOT', 'new:yes'];
const STATUS_DOT = { approved: 'var(--ok)', not_approved: 'var(--no)', unknown: 'var(--ink-3)' };

function shade(n, max) {
  if (!n) return 'transparent';
  const a = 0.12 + 0.55 * (n / max);
  return `rgba(14, 92, 99, ${a.toFixed(2)})`;
}

export default function Overview() {
  const { version, info, isLatest } = useVersion();
  const { drugs } = useDrugs();
  const newIds = useNewIds();
  const to = useVersionLink();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState('');

  const hlTokens = useMemo(() => parseQuery(highlight), [highlight]);

  const groups = useMemo(() => {
    const m = new Map();
    for (const d of [...drugs].sort((a, b) => idNumber(a.drugId) - idNumber(b.drugId))) {
      const c = normClass(d.drugClass);
      if (!m.has(c)) m.set(c, []);
      m.get(c).push(d);
    }
    return [...m.entries()].sort((a, b) => b[1].length - a[1].length || a[0].localeCompare(b[0]));
  }, [drugs]);

  const matrix = useMemo(() => {
    const cols = [
      { key: 'approved', label: 'FDA appr.', test: d => normStatus(d.status) === 'approved', params: { status: 'approved' } },
      { key: 'not', label: 'Not appr.', test: d => normStatus(d.status) === 'not_approved', params: { status: 'not_approved' } },
      { key: 'syn', label: 'Synthetic', test: d => normNature(d.nature) === 'Synthetic', params: { nature: 'Synthetic' } },
      { key: 'nat', label: 'Natural', test: d => normNature(d.nature) === 'Natural', params: { nature: 'Natural' } },
    ];
    const rows = groups.map(([cls, list]) => ({ cls, n: list.length, cells: cols.map(c => list.filter(c.test).length) }));
    const max = Math.max(1, ...rows.flatMap(r => r.cells));
    const totals = cols.map((_, i) => rows.reduce((s, r) => s + r.cells[i], 0));
    return { cols, rows, max, totals };
  }, [groups]);

  const stats = useMemo(() => {
    const brands = new Set();
    let refs = 0;
    for (const d of drugs) {
      splitBrands(d.brandNames).forEach(b => brands.add(b.toLowerCase()));
      refs += splitRefs(d.references).length;
    }
    return { brands: brands.size, refs, classes: groups.length };
  }, [drugs, groups]);

  const submit = (e) => { e.preventDefault(); navigate(to('/explorer', { q: query.trim() })); };
  const ready = drugs.length > 0;
  const added = info.added || [];

  return (
    <div className="wrap">
      {/* ── Title block ── */}
      <section className="title-block">
        <div>
          <h1>A curated, versioned database of drugs for <em>hypertrophic cardiomyopathy</em>.</h1>
          <div className="abstract">
            <span className="kicker">Abstract</span>
            <p>
              HCMdrugs catalogs {totalDrugs(version)} drugs used or studied in the treatment of hypertrophic
              cardiomyopathy. Each record gives the drug's effects in HCM, its molecular targets, pharmacological
              class, FDA status, origin and brand names, with references to the published literature. Every release
              is preserved, so analyses can cite the exact version they used.
            </p>
          </div>
          <div className="title-actions">
            <Link className="btn btn-ink" to={to('/explorer')}>Open the Explorer <ArrowRight size={15} /></Link>
            <Link className="btn" to={to('/about')}>Methods &amp; citation</Link>
          </div>
        </div>

        <aside className="frame dataset-card" aria-label="Dataset summary">
          <h2>Dataset record</h2>
          <dl>
            <dt>Version</dt><dd>{version}{isLatest ? ' (latest)' : ''}</dd>
            <dt>Released</dt><dd>{formatDate(info.released)}</dd>
            <dt>Records</dt><dd>{totalDrugs(version)}</dd>
            <dt>Drug classes</dt><dd>{ready ? stats.classes : '–'}</dd>
            <dt>FDA approved</dt><dd>{ready ? matrix.totals[0] : '–'}</dd>
            <dt>Natural origin</dt><dd>{ready ? matrix.totals[3] : '–'}</dd>
            <dt>Brand names</dt><dd>{ready ? stats.brands : '–'}</dd>
            <dt>References</dt><dd>{ready ? stats.refs : '–'}</dd>
            <dt>Article DOI</dt><dd><a href={`https://doi.org/${DOI}`} target="_blank" rel="noopener noreferrer">{DOI}</a></dd>
          </dl>
        </aside>
      </section>

      {/* ── Query ── */}
      <section className="block">
        <div className="block-head">
          <span className="secno">§0</span>
          <h2>Query the database</h2>
          <p>Type words to search every field, or use qualifiers to search one field.</p>
        </div>
        <div className="block-body">
          <form onSubmit={submit} role="search">
            <div className="query">
              <span className="prompt" aria-hidden="true">›</span>
              <label className="sr-only" htmlFor="ov-query">Query</label>
              <input id="ov-query" value={query} onChange={e => setQuery(e.target.value)} placeholder='e.g. class:antiarrhythmic status:approved target:potassium' autoComplete="off" spellCheck="false" />
              <button className="btn btn-ink btn-sm" type="submit">Run</button>
            </div>
          </form>
          <div className="examples">
            <span>Examples:</span>
            {EXAMPLES.map(x => <Link key={x} to={to('/explorer', { q: x })}>{x}</Link>)}
          </div>
        </div>
      </section>

      {/* ── Landscape ── */}
      <section className="block">
        <div className="block-head">
          <span className="secno">§1</span>
          <h2>The therapeutic landscape</h2>
          <p>Every drug in v{version}, grouped by class. Select a tile to open its monograph.</p>
        </div>
        <div className="block-body">
          <div className="query" style={{ marginBottom: 14, maxWidth: 560 }}>
            <span className="prompt" aria-hidden="true">≈</span>
            <label className="sr-only" htmlFor="hl-query">Highlight drugs matching a query</label>
            <input id="hl-query" value={highlight} onChange={e => setHighlight(e.target.value)} placeholder="Highlight: e.g. target:sodium" autoComplete="off" spellCheck="false" />
            {highlight && <button className="btn btn-sm" onClick={() => setHighlight('')}>Clear</button>}
          </div>
          <div className="legend">
            <span><span className="dot" style={{ background: 'var(--ok)' }} /> FDA approved</span>
            <span><span className="dot" style={{ background: 'var(--no)' }} /> Not FDA approved</span>
            <span><span className="lbl lbl-new" style={{ padding: '0 4px', fontSize: '0.6rem' }}>NEW</span> added in v{version}</span>
            <span><span className="sq" style={{ background: 'var(--ink-3)' }} /> edge colour = class</span>
          </div>
          <div className="landscape">
            {groups.map(([cls, list]) => (
              <div key={cls} className="group">
                <div className="group-name">
                  <strong><span className="sq" style={{ background: classColor(cls), marginRight: 6 }} />{cls}</strong>
                  <span>n = {list.length}</span>
                </div>
                <div className="tiles">
                  {list.map(d => {
                    const isNew = newIds.has(d.drugId);
                    const dim = hlTokens.length > 0 && !matchesQuery(d, hlTokens, isNew);
                    return (
                      <Link
                        key={d.drugId}
                        to={to(`/drug/${d.drugId}`)}
                        className={`tile${isNew ? ' is-new' : ''}${dim ? ' dim' : ''}`}
                        style={{ '--c': classColor(cls) }}
                        title={`${d.name} (${d.drugId}) · ${cls}`}
                      >
                        <span className="t-num">{idNumber(d.drugId)}</span>
                        <span className="t-stat dot" style={{ background: STATUS_DOT[normStatus(d.status)] }} />
                        <span className={`t-name${d.name.length > 17 ? ' xxlong' : d.name.length > 15 ? ' xlong' : d.name.length > 11 ? ' long' : ''}`}>{d.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Composition ── */}
      <section className="block">
        <div className="block-head">
          <span className="secno">§2</span>
          <h2>Composition</h2>
          <p>Drugs per class by regulatory status and origin. Cells link to the matching records.</p>
        </div>
        <div className="block-body two-col">
          <div>
            <table className="matrix">
              <thead>
                <tr><th>Class</th>{matrix.cols.map(c => <th key={c.key}>{c.label}</th>)}<th>n</th></tr>
              </thead>
              <tbody>
                {matrix.rows.map(r => (
                  <tr key={r.cls}>
                    <td><Link to={to('/explorer', { class: r.cls })} style={{ textDecoration: 'none', color: 'inherit' }}><ClassLabel cls={r.cls} /></Link></td>
                    {r.cells.map((n, i) => (
                      <td key={i}>
                        <Link className={`cell${n ? '' : ' zero'}`} style={{ background: shade(n, matrix.max), color: n / matrix.max > 0.55 ? '#fff' : undefined }}
                          to={to('/explorer', { class: r.cls, ...matrix.cols[i].params })} aria-label={`${n} ${r.cls}, ${matrix.cols[i].label}`}>{n}</Link>
                      </td>
                    ))}
                    <td className="num">{r.n}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr><td>Total</td>{matrix.totals.map((t, i) => <td key={i}>{t}</td>)}<td>{drugs.length}</td></tr>
              </tfoot>
            </table>
            <p className="caption"><b>Table 1.</b> Counts of records in the data file of v{version}.</p>
          </div>
          <div className="facts">
            <div className="fact"><div className="v">{totalDrugs(version)}</div><div className="k">drugs in v{version}</div></div>
            <div className="fact"><div className="v">{ready ? stats.classes : '–'}</div><div className="k">pharmacological classes</div></div>
            <div className="fact"><div className="v">{ready ? stats.refs : '–'}</div><div className="k">literature references</div></div>
            <div className="fact"><div className="v">{ready ? stats.brands : '–'}</div><div className="k">brand names</div></div>
          </div>
        </div>
      </section>

      {/* ── Change log ── */}
      <section className="block">
        <div className="block-head">
          <span className="secno">§3</span>
          <h2>Changes in v{version}</h2>
          <p>{info.summary}</p>
        </div>
        <div className="block-body">
          {added.length > 0 ? (
            <ul className="changes">
              {added.map(a => {
                const d = drugs.find(x => x.drugId === a.drugId);
                return (
                  <li key={a.drugId}>
                    <span className="op">+ added</span>
                    <span className="lbl lbl-id">{a.drugId}</span>
                    <Link to={to(`/drug/${a.drugId}`)} style={{ fontWeight: 600, color: 'var(--ink)' }}>{a.name}</Link>
                    {d ? <ClassLabel cls={normClass(d.drugClass)} /> : <span />}
                  </li>
                );
              })}
              {(info.removed || []).map(r => (
                <li key={r.drugId}><span className="op rm">− removed</span><span className="lbl lbl-id">{r.drugId}</span><span>{r.name}</span><span /></li>
              ))}
            </ul>
          ) : (
            <p style={{ color: 'var(--ink-2)' }}>Initial release. All {totalDrugs(version)} drugs first appear in this version.</p>
          )}
          <p className="caption" style={{ marginTop: 14 }}>
            Full history in <Link to={to('/about')} state={{ scrollTo: 'versions' }}>Methods &amp; citation › Version history</Link>.
          </p>
        </div>
      </section>
    </div>
  );
}
