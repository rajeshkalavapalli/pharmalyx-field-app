import { View } from 'react-native';

import { rupees } from './api';
import { doctorName, titleCase } from './format';
import { colors, space } from './theme';
import { Card, Empty, ListRow, SectionTitle, StatGrid } from './ui';

// Renders report / insight payloads (flat number objects as tiles, arrays as lists) in a readable way.

const MONEY = /(value|amount|pob|sales|revenue|cost|spend|business|secondary|expected|actual|net)$/i;
const PERCENT = /(percent|pct|share|rate|achievement|coverage|change)$/i;
const SKIP = new Set(['filters', 'thresholds', 'period', 'rowLimit', 'truncated', 'canAct', 'viewAll']);

// camelCase / PascalCase -> "Words like this"
export const humanize = (key) => {
    const s = String(key)
        .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
        .replace(/_/g, ' ')
        .trim()
        .toLowerCase();
    return s.charAt(0).toUpperCase() + s.slice(1);
};

export const formatValue = (key, value) => {
    if (value == null || value === '') return '—';
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    if (typeof value === 'number') {
        if (PERCENT.test(key)) return `${value}%`;
        if (MONEY.test(key)) return rupees(value);
        return Number.isInteger(value) ? value.toLocaleString('en-IN') : String(Math.round(value * 10) / 10);
    }
    if (/^\d{4}-\d{2}-\d{2}/.test(String(value))) return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    return String(value);
};

const TITLE_KEYS = ['Name', 'EmployeeName', 'name', 'DoctorName', 'ProductName', 'CustomerName', 'StockistName', 'TerritoryName', 'AreaName', 'PharmacyName', 'subject', 'title', 'label', 'month', 'day', 'date', 'feedback', 'key'];

const titleOf = (row) => {
    for (const k of TITLE_KEYS) {
        if (row[k] != null && row[k] !== '') {
            if (k === 'DoctorName') return doctorName(row[k]);
            if (k === 'month') return new Date(`${String(row[k]).slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
            if (k === 'day' || k === 'date') return formatValue('date', row[k]);
            return titleCase(row[k]);
        }
    }
    return '—';
};

const captionOf = (row, limit = 5) =>
    Object.entries(row)
        .filter(([k, v]) => !TITLE_KEYS.includes(k) && !/Id$/.test(k) && v != null && v !== '' && (typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean'))
        .slice(0, limit)
        .map(([k, v]) => `${humanize(k)} ${formatValue(k, v)}`)
        .join(' · ');

// Number tiles for an object like { calls: 120, gpsPercent: 92, ... }.
export function KpiTiles({ data, icon = 'bar-chart-2', max = 8 }) {
    if (!data) return null;
    const items = Object.entries(data)
        .filter(([, v]) => typeof v === 'number' || v == null)
        .slice(0, max)
        .map(([k, v], i) => ({ icon, label: humanize(k), value: formatValue(k, v), tone: ['brand', 'success', 'info', 'warning'][i % 4] }));
    return items.length ? <StatGrid items={items} /> : null;
}

// One list section for an array of rows.
export function RowList({ title, rows, limit = 30, onPress }) {
    if (!Array.isArray(rows)) return null;
    return (
        <>
            <SectionTitle title={title} caption={rows.length > limit ? `Top ${limit} of ${rows.length}` : undefined} />
            <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.5) }}>
                {rows.length ? (
                    rows.slice(0, limit).map((row, i) => (
                        <View key={i} style={i > 0 && { borderTopWidth: 1, borderTopColor: colors.lineSoft }}>
                            <ListRow title={typeof row === 'object' ? titleOf(row) : String(row)} caption={typeof row === 'object' ? captionOf(row) : undefined} chevron={Boolean(onPress)} onPress={onPress ? () => onPress(row) : undefined} />
                        </View>
                    ))
                ) : (
                    <Empty icon="inbox" title="Nothing here" />
                )}
            </Card>
        </>
    );
}

// Whole payload: number objects as tiles, arrays as lists (in the given order, then the rest).
export function DataView({ data, order = [], titles = {} }) {
    if (!data) return null;
    const keys = [...order.filter((k) => k in data), ...Object.keys(data).filter((k) => !order.includes(k))].filter((k) => !SKIP.has(k));
    return (
        <>
            {keys.map((k) => {
                const v = data[k];
                if (Array.isArray(v)) return <RowList key={k} title={titles[k] || humanize(k)} rows={v} />;
                if (v && typeof v === 'object' && Object.values(v).some((x) => typeof x === 'number')) {
                    return (
                        <View key={k}>
                            <SectionTitle title={titles[k] || humanize(k)} />
                            <KpiTiles data={v} />
                        </View>
                    );
                }
                return null;
            })}
        </>
    );
}
