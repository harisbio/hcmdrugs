// Shared helpers for presenting drug records.

/** Short display class used for filters, charts and badges. */
export function normClass(c) {
  if (!c) return 'Unknown';
  const lc = c.toLowerCase();
  if (lc.includes('myosin')) return 'Cardiac Myosin Inhibitor';
  if (lc.includes('alpha')) return 'Alpha & Beta Blocker';
  if (lc.includes('beta') && lc.includes('antiarr')) return 'Beta Blocker + Antiarrhythmic';
  if (lc.includes('beta')) return 'Beta Blocker';
  if (lc.includes('calcium')) return 'Calcium Channel Blocker';
  if (lc.includes('anticoag')) return 'Anticoagulant';
  if (lc.includes('antiarr')) return 'Antiarrhythmic';
  if (lc.includes('diuretic') && lc.includes('loop')) return 'Loop Diuretic';
  if (lc.includes('diuretic') && lc.includes('thiaz')) return 'Thiazide Diuretic';
  if (lc.includes('diuretic') || lc.includes('potassium')) return 'Diuretic';
  if (lc.includes('angiotensin') && lc.includes('receptor')) return 'ARB';
  if (lc.includes('angiotensin') || lc.includes('ace') || lc.includes('enzymes')) return 'ACE Inhibitor';
  if (lc.includes('glycoside')) return 'Cardiac Glycoside';
  if (lc.includes('antianginal')) return 'Antianginal';
  return c;
}

export function normStatus(s) {
  if (!s || s === 'NULL') return 'unknown';
  const lc = s.toLowerCase();
  if (lc.includes('not')) return 'not_approved';
  if (lc.includes('approv')) return 'approved';
  return 'unknown';
}

export function normNature(n) {
  if (!n) return 'Unknown';
  return n.toLowerCase().includes('nat') ? 'Natural' : 'Synthetic';
}

export const STATUS_LABEL = {
  approved: 'FDA approved',
  not_approved: 'Not FDA approved',
  unknown: 'Status unknown',
};

// Colours chosen to stay readable (≥4.5:1) as text on white.
const CLASS_COLORS = {
  'Beta Blocker': '#1d4ed8',
  'Beta Blocker + Antiarrhythmic': '#6d28d9',
  'Alpha & Beta Blocker': '#4338ca',
  'Calcium Channel Blocker': '#b45309',
  'Cardiac Myosin Inhibitor': '#be123c',
  'Antiarrhythmic': '#a21caf',
  'Anticoagulant': '#b91c1c',
  'Loop Diuretic': '#0e7490',
  'Thiazide Diuretic': '#0369a1',
  'Diuretic': '#0f766e',
  'ACE Inhibitor': '#7c3aed',
  'ARB': '#5b21b6',
  'Cardiac Glycoside': '#15803d',
  'Antianginal': '#c2410c',
};
export const classColor = (cls) => CLASS_COLORS[cls] || '#334155';

/** References are stored separated by " | " (see scripts/clean-drugs.mjs). */
export const splitRefs = (refs) => (refs ? refs.split('|').map(r => r.trim()).filter(Boolean) : []);

export const splitBrands = (brands) => (brands ? brands.split(',').map(b => b.trim()).filter(Boolean) : []);

/** Drug number for sorting ("HCM0007" → 7). */
export const idNumber = (drugId) => parseInt(String(drugId).replace(/\D/g, ''), 10) || 0;

/* ── Query language ──────────────────────────────────
   Free words match any field. Qualifiers narrow to one field:
     class:beta  status:approved|not  nature:natural  target:sodium
     brand:camzyos  id:HCM0012  source:plant  new:yes
   Prefix with "-" to exclude (e.g. -status:approved). Quote phrases: target:"potassium channel". */
export const QUERY_FIELDS = {
  class: d => `${d.drugClass} ${normClass(d.drugClass)}`,
  status: d => `${normStatus(d.status)} ${STATUS_LABEL[normStatus(d.status)]} ${normStatus(d.status) === 'not_approved' ? 'not' : ''}`,
  nature: d => normNature(d.nature),
  target: d => d.molecularTargets,
  effect: d => d.effects,
  brand: d => d.brandNames,
  id: d => d.drugId,
  name: d => d.name,
  source: d => d.source,
  ref: d => d.references,
};

export function parseQuery(q) {
  const tokens = [];
  const re = /(-?)(?:(\w+):)?(?:"([^"]*)"|(\S+))/g;
  let m;
  while ((m = re.exec(q || ''))) {
    const [, neg, field, quoted, bare] = m;
    const value = (quoted ?? bare ?? '').toLowerCase();
    if (!value) continue;
    const f = field && (field.toLowerCase() in QUERY_FIELDS || field.toLowerCase() === 'new') ? field.toLowerCase() : null;
    tokens.push({ neg: Boolean(neg), field: f, value: f ? value : (field ? `${field.toLowerCase()}:${value}` : value) });
  }
  return tokens;
}

export function matchesQuery(d, tokens, isNew) {
  return tokens.every(t => {
    let hit;
    if (t.field === 'new') hit = ['yes', 'true', '1'].includes(t.value) ? isNew : !isNew;
    else if (t.field === 'status' && (t.value === 'approved' || t.value === 'not')) {
      hit = t.value === 'approved' ? normStatus(d.status) === 'approved' : normStatus(d.status) === 'not_approved';
    } else if (t.field) hit = (QUERY_FIELDS[t.field](d) || '').toLowerCase().includes(t.value);
    else hit = Object.values(QUERY_FIELDS).some(fn => (fn(d) || '').toLowerCase().includes(t.value));
    return t.neg ? !hit : hit;
  });
}
