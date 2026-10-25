import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, rupees } from '../api';
import { doctorName, titleCase } from '../format';
import { colors, space, text } from '../theme';
import useLoad from '../useLoad';
import { Card, Chips, Empty, ListRow, Loadable, Screen, Header, SectionTitle, Tag } from '../ui';

const line = { borderTopWidth: 1, borderTopColor: colors.lineSoft };
const monthShort = (m) => new Date(`${String(m).slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });

// Head office: stockist fill rate, spend vs business, and where effort pays back best.
export default function SupplyReports({ navigation }) {
    const [tab, setTab] = useState('fill');
    const [months, setMonths] = useState(3);
    const [view, setView] = useState('territories');
    const path = { fill: 'fill-rate', spend: 'spend', focus: 'focus' }[tab];
    const state = useLoad(async () => (await api.get(`/app/ledger/reports/${path}`, { params: { months } })).data, [path, months], "Couldn't load the report.");

    const views = tab === 'spend' ? ['territories', 'doctors', 'chemists'] : ['doctors', 'chemists', 'areas', 'products'];
    const current = views.includes(view) ? view : views[0];
    const nameOf = (row) => (current === 'doctors' ? doctorName(row.name) : titleCase(row.name));

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Sales & distribution" title="Supply & spend reports" onBack={() => navigation.goBack()} />
            <Chips
                options={[
                    { value: 'fill', label: 'Stockist fill rate' },
                    { value: 'spend', label: 'Spend vs business' },
                    { value: 'focus', label: 'Where to focus' },
                ]}
                value={tab}
                onChange={setTab}
            />
            <Chips options={[1, 3, 6, 12].map((m) => ({ value: m, label: `${m} month${m > 1 ? 's' : ''}` }))} value={months} onChange={setMonths} />
            <Loadable state={state} rows={5}>
                {(d) =>
                    tab === 'fill' ? (
                        <>
                            <Text style={[text.small, { marginBottom: space(1.5) }]}>{`Orders raised vs supplied per stockist. Flagged below ${d.minPct}%; unsupplied after ${d.unsuppliedDays} days counts as overdue.`}</Text>
                            {d.stockists.length ? (
                                <View style={{ gap: space(1.25) }}>
                                    {d.stockists.map((s) => (
                                        <Card key={s.StockistId} style={{ padding: space(1.5) }}>
                                            <View style={styles.top}>
                                                <Text style={[text.subtitle, { flex: 1 }]}>{titleCase(s.StockistName)}</Text>
                                                <Tag label={s.countPct == null ? '—' : `${s.countPct}%`} tone={s.flagged ? 'error' : 'success'} />
                                            </View>
                                            <Text style={text.small}>{`${s.supplied}/${s.raised} orders · ${rupees(s.suppliedValue)} of ${rupees(s.raisedValue)}${s.overdue ? ` · ${s.overdue} overdue` : ''}`}</Text>
                                            <Text style={text.small}>{s.months.map((m) => `${monthShort(m.month)} ${m.countPct ?? '—'}%`).join(' · ')}</Text>
                                        </Card>
                                    ))}
                                </View>
                            ) : (
                                <Card>
                                    <Empty icon="truck" title="No orders in this period" />
                                </Card>
                            )}
                        </>
                    ) : (
                        <>
                            <Chips options={views.map((v) => ({ value: v, label: titleCase(v) }))} value={current} onChange={setView} />
                            {tab === 'spend' ? <Text style={[text.small, { marginBottom: space(1.5) }]}>{`Samples + schemes + doctor spend as % of net business. Flagged above ${d.maxPct}%.`}</Text> : <Text style={[text.small, { marginBottom: space(1.5) }]}>Business per rupee of effort (spend plus visits): most responsive first.</Text>}
                            <SectionTitle title={titleCase(current)} />
                            {(d[current] || []).length ? (
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    {d[current].slice(0, 50).map((r, i) => (
                                        <View key={r.id} style={i > 0 && line}>
                                            <ListRow
                                                title={nameOf(r)}
                                                caption={
                                                    tab === 'spend'
                                                        ? `Spend ${rupees(r.spend)} (samples ${rupees(r.samples)}, schemes ${rupees(r.schemes)}, doctor ${rupees(r.doctorSpend)}) · business ${rupees(r.business)}`
                                                        : `Business ${rupees(r.business)} · spend ${rupees(r.spend)} · ${r.visits} visits${r.territory ? ` · ${titleCase(r.territory)}` : ''}`
                                                }
                                                right={tab === 'spend' ? <Tag label={r.pct == null ? 'No sales' : `${r.pct}%`} tone={r.flagged ? 'error' : 'success'} /> : <Tag label={`${r.score}`} tone="primary" />}
                                                chevron={false}
                                            />
                                        </View>
                                    ))}
                                </Card>
                            ) : (
                                <Card>
                                    <Empty icon="pie-chart" title="Nothing in this period" />
                                </Card>
                            )}
                        </>
                    )
                }
            </Loadable>
        </Screen>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
});
