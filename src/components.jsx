import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useVersion, VERSIONS, LATEST, formatDate, totalDrugs } from './versions';
import { STATUS_LABEL, classColor } from './lib/drugs';

/* ── Version controls ─────────────────────────────── */
export function VersionSelect() {
  const { version, setVersion } = useVersion();
  return (
    <label className="version-select" title="Database version">
      <span aria-hidden="true">dataset</span>
      <span className="sr-only">Database version</span>
      <select className="select" value={version} onChange={e => setVersion(e.target.value)}>
        {VERSIONS.map(v => (
          <option key={v.version} value={v.version}>v{v.version}{v.version === LATEST ? ' (latest)' : ''}</option>
        ))}
      </select>
    </label>
  );
}

export function VersionBanner() {
  const { version, isLatest, setVersion, info } = useVersion();
  if (isLatest) return null;
  return (
    <div className="version-banner" role="status">
      <div className="wrap">
        <span>
          You are viewing <strong>v{version}</strong>, an archived version of the database
          ({totalDrugs(version)} drugs, released {formatDate(info.released)}).
          The latest version is v{LATEST} with {totalDrugs(LATEST)} drugs.
        </span>
        <button className="btn btn-sm" onClick={() => setVersion(LATEST)}>View latest (v{LATEST})</button>
      </div>
    </div>
  );
}

/** Router `to` that keeps the selected version (?v=) plus extra params. */
export function useVersionLink() {
  const { version, isLatest } = useVersion();
  return (pathname, params = {}) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v === undefined || v === null || v === '' || (Array.isArray(v) && !v.length)) continue;
      sp.set(k, Array.isArray(v) ? v.join('|') : v);
    }
    if (!isLatest) sp.set('v', version);
    const s = sp.toString();
    return { pathname, search: s ? `?${s}` : '' };
  };
}

/** drugIds first added in the selected version. */
export function useNewIds() {
  const { info } = useVersion();
  return useMemo(() => new Set((info.added || []).map(d => d.drugId)), [info]);
}

/* ── Labels ───────────────────────────────────────── */
export const StatusLabel = ({ status }) => <span className={`lbl lbl-${status}`}>{STATUS_LABEL[status]}</span>;

export function ClassLabel({ cls }) {
  return <span className="lbl"><span className="sq" style={{ background: classColor(cls) }} aria-hidden="true" />{cls}</span>;
}

export const NewLabel = ({ version }) => <span className="lbl lbl-new" title={`Added in v${version}`}>new in v{version}</span>;

/* ── Compare list (up to 4 drugs, kept for the browser session) ── */
export const MAX_COMPARE = 4;
const CompareContext = createContext(null);

export function CompareProvider({ children }) {
  const [ids, setIds] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('hcm-compare') || '[]'); } catch { return []; }
  });
  useEffect(() => {
    try { sessionStorage.setItem('hcm-compare', JSON.stringify(ids)); } catch { /* storage unavailable */ }
  }, [ids]);
  const value = useMemo(() => ({
    ids,
    has: id => ids.includes(id),
    toggle: id => setIds(cur => (cur.includes(id) ? cur.filter(x => x !== id) : cur.length >= MAX_COMPARE ? cur : [...cur, id])),
    remove: id => setIds(cur => cur.filter(x => x !== id)),
    clear: () => setIds([]),
    full: ids.length >= MAX_COMPARE,
  }), [ids]);
  return <CompareContext.Provider value={value}>{children}</CompareContext.Provider>;
}

export const useCompare = () => useContext(CompareContext);
