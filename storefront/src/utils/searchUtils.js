const RECENT_KEY = 'ehub_recent_searches';
const MAX_RECENT = 8;

/** Common typos and aliases → canonical term used for matching */
export const SEARCH_SYNONYMS = {
  capasitor: 'capacitor',
  capaciter: 'capacitor',
  resister: 'resistor',
  diod: 'diode',
  trasformer: 'transformer',
  batery: 'battery',
  battrey: 'battery',
  usb: 'usb',
  hdmi: 'hdmi',
  led: 'led',
};

export const normalizeSearchText = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

export const applySynonymsToQuery = (raw) => {
  const q = String(raw || '').trim();
  if (!q) return q;
  return q
    .split(/\s+/)
    .map((w) => {
      const key = w.toLowerCase().replace(/[^a-z0-9]/g, '');
      return SEARCH_SYNONYMS[key] || w;
    })
    .join(' ');
};

export const levenshteinDistance = (a, b) => {
  const s = normalizeSearchText(a);
  const t = normalizeSearchText(b);
  if (!s.length) return t.length;
  if (!t.length) return s.length;
  const matrix = Array.from({ length: s.length + 1 }, () => Array(t.length + 1).fill(0));
  for (let i = 0; i <= s.length; i += 1) matrix[i][0] = i;
  for (let j = 0; j <= t.length; j += 1) matrix[0][j] = j;
  for (let i = 1; i <= s.length; i += 1) {
    for (let j = 1; j <= t.length; j += 1) {
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      );
    }
  }
  return matrix[s.length][t.length];
};

export const isFuzzyPartMatch = (query, rawTarget) => {
  const target = normalizeSearchText(rawTarget);
  if (!query || !target) return false;
  if (target.includes(query)) return true;
  if (query.length < 3) return false;
  const words = String(rawTarget || '')
    .toLowerCase()
    .split(/[\s/>-]+/)
    .filter(Boolean);
  return words.some((word) => {
    const distance = levenshteinDistance(query, word);
    return distance <= (query.length >= 6 ? 2 : 1);
  });
};

export const rememberSearch = (q) => {
  const trimmed = String(q || '').trim();
  if (trimmed.length < 2) return;
  try {
    const prev = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const list = Array.isArray(prev) ? prev : [];
    const next = [trimmed, ...list.filter((x) => x.toLowerCase() !== trimmed.toLowerCase())].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch (e) {
    if (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      console.warn('Storage quota exceeded when saving recent searches');
    }
  }
};

export const getRecentSearches = () => {
  try {
    const prev = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    return Array.isArray(prev) ? prev : [];
  } catch {
    return [];
  }
};
