// Display formatting only: the data itself is not changed.

const SMALL = new Set(['and', 'of', 'the', 'in', 'on', 'at', 'for']);
const KEEP_UPPER = /^(hq|ex-hq|mbbs|md|ms|dm|mch|bams|bhms|bds|mds|dnb|frcs|mrcp|ent|ii|iii|iv)$/i;

// "tirupathi" -> "Tirupathi", "NORTH zone" -> "North Zone", "ex-hq" stays "EX-HQ".
export const titleCase = (value) => {
    const s = String(value ?? '').trim().replace(/\s+/g, ' ');
    if (!s) return '';
    return s
        .split(' ')
        .map((word, i) => {
            if (KEEP_UPPER.test(word.replace(/[^a-z-]/gi, ''))) return word.toUpperCase();
            const lower = word.toLowerCase();
            if (i > 0 && SMALL.has(lower)) return lower;
            return lower.replace(/(^|[-'(./])([a-z])/g, (m, sep, ch) => sep + ch.toUpperCase());
        })
        .join(' ');
};

// "dr g r prasad" / "Dr.G.R.PRASAD" / "g.r. prasad" -> "Dr. G.R. Prasad".
export const doctorName = (value) => {
    let s = String(value ?? '').trim().replace(/\s+/g, ' ');
    s = s.replace(/^dr\.?\s*/i, '');
    if (!s) return 'Doctor';
    const parts = s.split(/[\s.]+/).filter(Boolean);
    const initials = [];
    while (parts.length > 1 && parts[0].length === 1) initials.push(parts.shift().toUpperCase());
    const rest = titleCase(parts.join(' '));
    return `Dr. ${initials.length ? `${initials.join('.')}. ` : ''}${rest}`;
};

// First letter for an avatar.
export const initial = (value) => String(value ?? '').replace(/^dr\.?\s*/i, '').trim().charAt(0).toUpperCase() || '?';

export const clock = (value) => (value ? new Date(value).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

// "just now", "5 min ago", "2 h ago"
export const ago = (value) => {
    if (!value) return '';
    const minutes = Math.round((Date.now() - new Date(value).getTime()) / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes} min ago`;
    return `${Math.round(minutes / 60)} h ago`;
};

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
