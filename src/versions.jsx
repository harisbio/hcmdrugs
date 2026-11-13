import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import manifest from '../data/versions.json';

/*
 * Database versions.
 *   data/versions.json          manifest (latest + changelog), bundled eagerly
 *   data/v<version>/drugs.json  each version's records, loaded on demand
 * The selected version lives in the URL (?v=1.0.0) so it can be shared and
 * bookmarked; no ?v= means the latest version.
 */

const jsonLoaders = import.meta.glob('../data/v*/drugs.json', { import: 'default' });

export const LATEST = manifest.latest;
export const VERSIONS = manifest.versions; // newest first

export const versionInfo = (v) => VERSIONS.find(x => x.version === v);

// Displayed total drug count per version. Hardcoded on purpose: v1.0.0 is
// reported as 73 drugs (as published), even though its data file holds 72
// records. v1.1.0 = 73 + the 5 drugs added in that release.
// Add a line here for every new version.
export const TOTAL_DRUGS = {
  '1.0.0': 73,
  '1.1.0': 78,
};
export const totalDrugs = (v) => TOTAL_DRUGS[v] ?? versionInfo(v)?.drugCount;

/** The version in which a drug first appeared (oldest version if never listed as added). */
export function firstVersionOf(drugId) {
  const ascending = [...VERSIONS].reverse();
  const hit = ascending.find(v => (v.added || []).some(a => a.drugId === drugId));
  return hit ? hit.version : ascending[0].version;
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

const cache = new Map();
export function loadDrugs(version) {
  if (!cache.has(version)) {
    const loader = jsonLoaders[`../data/v${version}/drugs.json`];
    if (!loader) return Promise.reject(new Error(`No data for v${version}`));
    cache.set(version, loader().then(d => d?.records ?? d ?? []));
  }
  return cache.get(version);
}

const VersionContext = createContext(null);

export function VersionProvider({ children }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('v');
  const version = requested && versionInfo(requested) ? requested : LATEST;

  const setVersion = (v) => {
    const next = new URLSearchParams(params);
    if (v === LATEST) next.delete('v');
    else next.set('v', v);
    setParams(next);
  };

  const value = useMemo(() => ({
    version,
    info: versionInfo(version),
    isLatest: version === LATEST,
    setVersion,
    // query string to append to internal links so the version is kept
    search: version === LATEST ? '' : `?v=${version}`,
  }), [version, params]); // eslint-disable-line react-hooks/exhaustive-deps

  return <VersionContext.Provider value={value}>{children}</VersionContext.Provider>;
}

export const useVersion = () => useContext(VersionContext);

/** Records of the selected version; [] while loading. */
export function useDrugs() {
  const { version } = useVersion();
  const [state, setState] = useState({ version: null, drugs: [], error: null });

  useEffect(() => {
    let alive = true;
    loadDrugs(version)
      .then(drugs => alive && setState({ version, drugs, error: null }))
      .catch(error => alive && setState({ version, drugs: [], error }));
    return () => { alive = false; };
  }, [version]);

  return { drugs: state.version === version ? state.drugs : [], loading: state.version !== version, error: state.error };
}
