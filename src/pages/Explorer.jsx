import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Columns3, HelpCircle, LayoutGrid, SlidersHorizontal, Table2, X } from 'lucide-react';
import { useVersion, useDrugs, totalDrugs, firstVersionOf } from '../versions';
import { useVersionLink, useNewIds, useCompare, StatusLabel, ClassLabel, NewLabel, MAX_COMPARE } from '../components';
import {
  normClass, normStatus, normNature, classColor, splitRefs, splitBrands, idNumber, STATUS_LABEL,
  parseQuery, matchesQuery,
} from '../lib/drugs';

const PAGE = 50;
const LIST_KEYS = ['class', 'status', 'nature'];
const FACETS = [
  { key: 'class', title: 'Pharmacological class', get: d => normClass(d.drugClass), label: v => v, color: v => classColor(v) },
  { key: 'status', title: 'FDA status', get: d => normStatus(d.status), label: v => STATUS_LABEL[v] },
  { key: 'nature', title: 'Origin', get: d => normNature(d.nature), label: v => v },
];
const COLUMNS = [
  { key: 'id', label: 'ID', sort: (a, b) => idNumber(a.drugId) - idNumber(b.drugId), fixed: true },
  { key: 'name', label: 'Drug', sort: (a, b) => a.name.localeCompare(b.name), fixed: true },
  { key: 'class', label: 'Class', sort: (a, b) => normClass(a.drugClass).localeCompare(normClass(b.drugClass)) || a.name.localeCompare(b.name) },
  { key: 'status', label: 'FDA status', sort: (a, b) => normStatus(a.status).localeCompare(normStatus(b.status)) || a.name.localeCompare(b.name) },
  { key: 'nature', label: 'Origin', sort: (a, b) => normNature(a.nature).localeCompare(normNature(b.nature)) },
  { key: 'source', label: 'Source', sort: (a, b) => (a.source || '').localeCompare(b.source || '') },
  { key: 'brands', label: 'Brands', sort: (a, b) => splitBrands(a.brandNames).length - splitBrands(b.brandNames).length },
  { key: 'refs', label: 'Refs', sort: (a, b) => splitRefs(a.references).length - splitRefs(b.references).length },
  { key: 'since', label: 'Since', sort: (a, b) => firstVersionOf(a.drugId).localeCompare(firstVersionOf(b.drugId)) },
];
const DEFAULT_COLS = ['id', 'name', 'class', 'status', 'refs'];

function loadCols() {
  try {
    const saved = JSON.parse(localStorage.getItem('hcm-cols-v2') || 'null');
    if (Array.isArray(saved)) return saved.filter(k => COLUMNS.some(c => c.key === k));
  } catch { /* storage unavailable */ }
  return DEFAULT_COLS;
}

function useNarrow(query) {
  const [m, setM] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setM(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [query]);
  return m;
}

function Cell({ col, d }) {
  switch (col) {
    case 'id': return <span className="lbl lbl-id">{d.drugId}</span>;
    case 'name': return <span className="name">{d.name}</span>;
    case 'class': return <ClassLabel cls={normClass(d.drugClass)} />;
    case 'status': return <StatusLabel status={normStatus(d.status)} />;
    case 'nature': return normNature(d.nature);
    case 'source': return <span className="clamp">{d.source || '—'}</span>;
    case 'brands': return d.brandNames ? <span className="clamp" title={d.brandNames}>{d.brandNames}</span> : <span className="muted">—</span>;
    case 'refs': return <span className="num">{splitRefs(d.references).length || '—'}</span>;
    case 'since': return <span className="num">v{firstVersionOf(d.drugId)}</span>;
    default: return null;
  }
}

export default function Explorer() {
  const { version } = useVersion();
  const { drugs, loading } = useDrugs();
  const newIds = useNewIds();
  const compare = useCompare();
  const to = useVersionLink();
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const narrow = useNarrow('(max-width: 1180px)');

  const [showFacets, setShowFacets] = useState(false);
  const [showSyntax, setShowSyntax] = useState(false);
  const [showCols, setShowCols] = useState(false);
  const [cols, setCols] = useState(loadCols);
  const [selId, setSelId] = useState(null);
  const tableRef = useRef(null);

  useEffect(() => { try { localStorage.setItem('hcm-cols-v2', JSON.stringify(cols)); } catch { /* ignore */ } }, [cols]);

  // ── URL-backed state ──
  const q = params.get('q') || '';
  const sel = Object.fromEntries(LIST_KEYS.map(k => [k, (params.get(k) || '').split('|').filter(Boolean)]));
  const sortKey = COLUMNS.some(c => c.key === params.get('sort')) ? params.get('sort') : 'id';
  const desc = params.get('dir') === 'desc';
  const view = params.get('view') === 'cards' ? 'cards' : 'table';
  const page = Math.max(1, parseInt(params.get('page') || '1', 10));

  const update = (changes, keepPage = false) => {
    const next = new URLSearchParams(params);
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) next.delete(k);
      else next.set(k, Array.isArray(v) ? v.join('|') : v);
    }
    if (!keepPage) next.delete('page');
    setParams(next, { replace: true });
  };

  const [text, setText] = useState(q);
  useEffect(() => { setText(q); }, [q]);
  useEffect(() => {
    if (text === q) return undefined;
    const t = setTimeout(() => update({ q: text.trim() }), 250);
    return () => clearTimeout(t);
  }, [text]); // eslint-disable-line react-hooks/exhaustive-deps

  const tokens = useMemo(() => parseQuery(q), [q]);
  const toggleFacet = (key, value) => {
    const cur = sel[key];
    update({ [key]: cur.includes(value) ? cur.filter(v => v !== value) : [...cur, value] });
  };
  const clearAll = () => update({ q: '', class: [], status: [], nature: [] });

  const passes = (d, skip) =>
    matchesQuery(d, tokens, newIds.has(d.drugId)) &&
    FACETS.every(f => f.key === skip || !sel[f.key].length || sel[f.key].includes(f.get(d)));

  const filtered = useMemo(() => {
    const list = drugs.filter(d => passes(d));
    list.sort(COLUMNS.find(c => c.key === sortKey).sort);
    if (desc) list.reverse();
    return list;
  }, [drugs, params, newIds]); // eslint-disable-line react-hooks/exhaustive-deps

  const facetRows = useMemo(() => Object.fromEntries(FACETS.map(f => {
    const all = new Map(drugs.map(d => [f.get(d), 0]));
    for (const d of drugs) if (passes(d, f.key)) all.set(f.get(d), all.get(f.get(d)) + 1);
    return [f.key, [...all.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0])))];
  })), [drugs, params, newIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Drop facet selections that don't exist in the version being viewed.
  useEffect(() => {
    if (loading) return;
    const stale = {};
    for (const f of FACETS) {
      const valid = new Set(drugs.map(f.get));
      const keep = sel[f.key].filter(v => valid.has(v));
      if (keep.length !== sel[f.key].length) stale[f.key] = keep;
    }
    if (Object.keys(stale).length) update(stale);
  }, [loading, version]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const cur = Math.min(page, pages);
  const shown = filtered.slice((cur - 1) * PAGE, cur * PAGE);
  const selected = filtered.find(d => d.drugId === selId) || shown[0] || null;
  const hasFilters = Boolean(q || LIST_KEYS.some(k => sel[k].length));
  const total = totalDrugs(version);
  const back = { back: location.search };
  const openDrug = (d) => navigate(to(`/drug/${d.drugId}`), { state: back });
  const pick = (d) => (narrow ? openDrug(d) : setSelId(d.drugId));

  const onKey = (e) => {
    if (!shown.length || !['ArrowDown', 'ArrowUp', 'Enter'].includes(e.key)) return;
    e.preventDefault();
    if (e.key === 'Enter') { if (selected) openDrug(selected); return; }
    const i = Math.max(0, shown.findIndex(d => d.drugId === selected?.drugId));
    const next = shown[Math.min(shown.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
    setSelId(next.drugId);
    tableRef.current?.querySelector(`[data-id="${next.drugId}"]`)?.scrollIntoView({ block: 'nearest' });
  };

  const sortBy = (key) => update({ sort: key === 'id' ? '' : key, dir: sortKey === key && !desc ? 'desc' : '' }, true);
  const activeCols = COLUMNS.filter(c => c.fixed || cols.includes(c.key));
  const maxOf = (rows) => Math.max(1, ...rows.map(r => r[1]));

  return (
    <div className="wrap">
      <header className="doc-head" style={{ paddingBottom: 18 }}>
        <span className="kicker">Explorer · dataset v{version}</span>
        <h1>Workbench</h1>
        <p className="dek">Filter by facet or query any field. Select a row to preview it; press Enter or double-click to open the full monograph. Tick rows to compare up to {MAX_COMPARE} drugs side by side.</p>
      </header>

      <div className={`workbench${showFacets ? ' show-facets' : ''}`}>
        {/* ── Facets ── */}
        <div className="pane facets-pane">
          <div className="pane-head">
            <span>Facets</span>
            {hasFilters && <button className="btn-link" onClick={clearAll}>reset</button>}
          </div>
          <div className="facets">
            {FACETS.map(f => {
              const rows = facetRows[f.key];
              const m = maxOf(rows);
              return (
                <div key={f.key} className="facet">
                  <h3>{f.title}</h3>
                  {rows.map(([value, n]) => (
                    <label key={value} className={`fopt${n ? '' : ' zero'}`}>
                      <input type="checkbox" checked={sel[f.key].includes(value)} onChange={() => toggleFacet(f.key, value)} />
                      <span className="name">{f.color && <span className="sq" style={{ background: f.color(value) }} />}{f.label(value)}</span>
                      <span className="n">{n}</span>
                      <span className="bar" aria-hidden="true"><i style={{ width: `${(n / m) * 100}%` }} /></span>
                    </label>
                  ))}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Results ── */}
        <div className="pane">
          <div className="results-tools">
            <button className="btn btn-sm facets-toggle" onClick={() => setShowFacets(s => !s)} aria-expanded={showFacets}><SlidersHorizontal size={14} /> Facets</button>
            <div className="query">
              <span className="prompt" aria-hidden="true">›</span>
              <label className="sr-only" htmlFor="wb-query">Query</label>
              <input id="wb-query" type="search" value={text} onChange={e => setText(e.target.value)} placeholder="query, e.g. class:beta -status:approved" autoComplete="off" spellCheck="false" />
              <button className="btn btn-sm" onClick={() => setShowSyntax(s => !s)} aria-expanded={showSyntax} title="Query syntax"><HelpCircle size={14} /></button>
            </div>
            <div className="seg" role="group" aria-label="View">
              <button className={view === 'table' ? 'on' : ''} aria-pressed={view === 'table'} onClick={() => update({ view: '' }, true)}><Table2 size={13} /> Table</button>
              <button className={view === 'cards' ? 'on' : ''} aria-pressed={view === 'cards'} onClick={() => update({ view: 'cards' }, true)}><LayoutGrid size={13} /> Cards</button>
            </div>
            {view === 'table' && (
              <div className="col-menu">
                <button className="btn btn-sm" onClick={() => setShowCols(s => !s)} aria-expanded={showCols}><Columns3 size={14} /> Columns</button>
                {showCols && (
                  <div className="menu">
                    {COLUMNS.filter(c => !c.fixed).map(c => (
                      <label key={c.key}>
                        <input type="checkbox" checked={cols.includes(c.key)} onChange={() => setCols(cs => (cs.includes(c.key) ? cs.filter(k => k !== c.key) : [...cs, c.key]))} />
                        {c.label}
                      </label>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {showSyntax && (
            <div className="syntax">
              Words match any field. Qualifiers restrict to one field; <code>-</code> excludes; quotes keep phrases together.
              <table><tbody>
                <tr><td><code>class:myosin</code></td><td>pharmacological class</td><td><code>target:"potassium channel"</code></td><td>molecular targets</td></tr>
                <tr><td><code>status:approved</code> / <code>status:not</code></td><td>FDA status</td><td><code>effect:LVOT</code></td><td>effects in HCM</td></tr>
                <tr><td><code>nature:natural</code></td><td>origin</td><td><code>brand:camzyos</code></td><td>brand names</td></tr>
                <tr><td><code>new:yes</code></td><td>added in this version</td><td><code>id:HCM0012</code>, <code>ref:2023</code></td><td>ID, references</td></tr>
              </tbody></table>
            </div>
          )}

          <div className="results-meta">
            <span className="num">{hasFilters ? `${filtered.length} of ${total} records` : `${total} records`}</span>
            {hasFilters && (
              <div className="chips">
                {q && <button className="chip" onClick={() => update({ q: '' })}>q: {q} <X size={11} /></button>}
                {FACETS.flatMap(f => sel[f.key].map(v => (
                  <button key={`${f.key}${v}`} className="chip" onClick={() => toggleFacet(f.key, v)}>{f.key}: {f.label(v)} <X size={11} /></button>
                )))}
              </div>
            )}
          </div>

          {!loading && filtered.length === 0 && (
            <div className="empty">
              <p>No records match this query.</p>
              <button className="btn btn-sm" style={{ marginTop: 12 }} onClick={clearAll}>Reset all filters</button>
            </div>
          )}

          {filtered.length > 0 && view === 'table' && (
            <div ref={tableRef} tabIndex={0} onKeyDown={onKey} style={{ overflowX: 'auto' }} aria-label="Results table. Arrow keys move, Enter opens.">
              <table className="grid-table">
                <thead>
                  <tr>
                    <th><span className="sr-only">Compare</span></th>
                    {activeCols.map(c => (
                      <th key={c.key} aria-sort={sortKey === c.key ? (desc ? 'descending' : 'ascending') : 'none'}>
                        <button onClick={() => sortBy(c.key)}>{c.label}{sortKey === c.key && (desc ? <ArrowDown size={11} /> : <ArrowUp size={11} />)}</button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map(d => (
                    <tr key={d.drugId} data-id={d.drugId} className={selected?.drugId === d.drugId && !narrow ? 'sel' : ''}
                      onClick={() => pick(d)} onDoubleClick={() => openDrug(d)}>
                      <td onClick={e => e.stopPropagation()}>
                        <input type="checkbox" aria-label={`Compare ${d.name}`} checked={compare.has(d.drugId)}
                          disabled={!compare.has(d.drugId) && compare.full} onChange={() => compare.toggle(d.drugId)} />
                      </td>
                      {activeCols.map(c => (
                        <td key={c.key}>
                          <Cell col={c.key} d={d} />
                          {c.key === 'name' && newIds.has(d.drugId) && <div style={{ marginTop: 3 }}><NewLabel version={version} /></div>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {filtered.length > 0 && view === 'cards' && (
            <div className="cards">
              {shown.map(d => {
                const cls = normClass(d.drugClass);
                return (
                  <button key={d.drugId} className={`card${selected?.drugId === d.drugId && !narrow ? ' sel' : ''}`} style={{ '--c': classColor(cls) }}
                    onClick={() => pick(d)} onDoubleClick={() => openDrug(d)}>
                    <span className="row"><span className="lbl lbl-id">{d.drugId}</span>{newIds.has(d.drugId) && <NewLabel version={version} />}</span>
                    <h3>{d.name}</h3>
                    <span className="row"><ClassLabel cls={cls} /><StatusLabel status={normStatus(d.status)} /></span>
                    <p>{d.effects}</p>
                  </button>
                );
              })}
            </div>
          )}

          {filtered.length > PAGE && (
            <div className="pager">
              <span className="num">rows {(cur - 1) * PAGE + 1}–{Math.min(cur * PAGE, filtered.length)} of {filtered.length}</span>
              <span className="row">
                <button className="btn btn-sm" disabled={cur === 1} onClick={() => update({ page: cur - 1 === 1 ? '' : cur - 1 }, true)}>← Prev</button>
                <button className="btn btn-sm" disabled={cur === pages} onClick={() => update({ page: cur + 1 }, true)}>Next →</button>
              </span>
            </div>
          )}
        </div>

        {/* ── Preview ── */}
        <div className="pane preview-pane">
          <div className="pane-head"><span>Preview</span>{selected && <span className="num">{selected.drugId}</span>}</div>
          <div className="preview">
            {selected ? (
              <div className="preview-body">
                <div className="row"><ClassLabel cls={normClass(selected.drugClass)} /><StatusLabel status={normStatus(selected.status)} />{newIds.has(selected.drugId) && <NewLabel version={version} />}</div>
                <h2>{selected.name}</h2>
                <h3>Effects in HCM</h3>
                <p>{selected.effects || 'Not available.'}</p>
                <h3>Molecular targets</h3>
                <p>{selected.molecularTargets || 'Not available.'}</p>
                <h3>Record</h3>
                <p className="num" style={{ fontSize: '0.8rem' }}>
                  origin {normNature(selected.nature).toLowerCase()} · {splitBrands(selected.brandNames).length} brands · {splitRefs(selected.references).length} refs · since v{firstVersionOf(selected.drugId)}
                </p>
                <div className="preview-actions">
                  <Link className="btn btn-ink btn-sm" to={to(`/drug/${selected.drugId}`)} state={back}>Open monograph →</Link>
                  <button className="btn btn-sm" onClick={() => compare.toggle(selected.drugId)} disabled={!compare.has(selected.drugId) && compare.full}>
                    {compare.has(selected.drugId) ? 'Remove from compare' : 'Add to compare'}
                  </button>
                </div>
              </div>
            ) : <p className="preview-empty">Select a record to preview it.</p>}
          </div>
        </div>
      </div>

      {compare.ids.length > 0 && (
        <div className="tray" role="region" aria-label="Compare selection">
          <span className="num">{compare.ids.length}/{MAX_COMPARE}</span>
          <span className="names">{compare.ids.map(id => drugs.find(d => d.drugId === id)?.name || id).join(' · ')}</span>
          <Link className="btn btn-sm" to={to('/compare', { ids: compare.ids.join(',') })}>Compare →</Link>
          <button className="btn btn-sm btn-clear" onClick={compare.clear}>Clear</button>
        </div>
      )}
    </div>
  );
}
