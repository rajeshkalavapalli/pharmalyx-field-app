import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, errorMessage } from '../api';
import { DataView, KpiTiles } from '../dataView';
import { titleCase } from '../format';
import { usePermissions } from '../permissions';
import { colors, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, Loadable, ReasonDialog, Screen, Select, Tag } from '../ui';

const REPORTS = {
    mis: { title: 'MIS report', order: ['summary', 'months', 'employees'] },
    calls: { title: 'DCR / call report', order: ['kpis', 'employees', 'days', 'rows'], titles: { rows: 'Calls' } },
    coverage: { title: 'Coverage', order: ['kpis', 'byCategory', 'employees', 'rows'], titles: { rows: 'Doctors' } },
    kpi: { title: 'KPI', order: ['kpis', 'employees'] },
    'missed-visits': { title: 'Missed visits', order: ['kpis', 'employees', 'doctors', 'missedDays', 'plannedCalls'] },
    pob: { title: 'POB report', order: ['kpis', 'months', 'employees', 'products', 'customers', 'orders'] },
    sales: { title: 'Sales report', order: ['kpis', 'months', 'employees', 'products', 'stockists', 'rows'] },
    graphical: { title: 'Graphical report', order: ['summary', 'months', 'coverageByCategory', 'feedback', 'topEmployees'] },
};

const pad = (n) => String(n).padStart(2, '0');
const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const RANGES = {
    this_month: () => {
        const n = new Date();
        return [key(new Date(n.getFullYear(), n.getMonth(), 1)), key(n)];
    },
    last_month: () => {
        const n = new Date();
        return [key(new Date(n.getFullYear(), n.getMonth() - 1, 1)), key(new Date(n.getFullYear(), n.getMonth(), 0))];
    },
    this_quarter: () => {
        const n = new Date();
        return [key(new Date(n.getFullYear(), Math.floor(n.getMonth() / 3) * 3, 1)), key(n)];
    },
};

// Any of the 8 reports, with the same filters as the web (period, person, territory).
export function Report({ navigation, route }) {
    const report = route.params?.report || 'mis';
    const def = REPORTS[report] || REPORTS.mis;
    const [range, setRange] = useState('this_month');
    const [userId, setUserId] = useState('');
    const [territoryId, setTerritoryId] = useState('');
    const [from, to] = RANGES[range]();
    const options = useLoad(async () => (await api.get('/app/reports/options')).data, [], '');
    const state = useLoad(async () => (await api.get(`/app/reports/${report}`, { params: { from, to, userId: userId || undefined, territoryId: territoryId || undefined } })).data, [report, from, to, userId, territoryId], "Couldn't load the report.");

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Reports" title={route.params?.title || def.title} onBack={() => navigation.goBack()} />
            <Chips
                options={[
                    { value: 'this_month', label: 'This month' },
                    { value: 'last_month', label: 'Last month' },
                    { value: 'this_quarter', label: 'This quarter' },
                ]}
                value={range}
                onChange={setRange}
            />
            {(options.data?.users || []).length > 1 ? <Select label="Employee" value={userId} options={[{ value: '', label: 'Everyone' }, ...options.data.users.map((u) => ({ value: u.UserId, label: titleCase(u.Name) }))]} onChange={setUserId} icon="user" searchable /> : null}
            {(options.data?.territories || []).length > 1 ? <Select label="Territory" value={territoryId} options={[{ value: '', label: 'All territories' }, ...options.data.territories.map((t) => ({ value: t.TerritoryId, label: titleCase(t.TerritoryName) }))]} onChange={setTerritoryId} icon="map" searchable /> : null}
            <Text style={[text.small, { marginBottom: space(1.5) }]}>{`${from} to ${to}`}</Text>
            <Loadable state={state} rows={6}>
                {(d) => (
                    <>
                        {d.truncated ? <Text style={[text.small, { color: colors.warningDark, marginBottom: space(1) }]}>{`Showing the first ${d.rowLimit} rows. Narrow the filters to see everything.`}</Text> : null}
                        <DataView data={d} order={def.order} titles={def.titles} />
                    </>
                )}
            </Loadable>
        </Screen>
    );
}

const SEVERITY = { HIGH: 'error', MEDIUM: 'warning', LOW: 'info' };

function Alerts({ navigation }) {
    const state = useLoad(async () => (await api.get('/app/insights/alerts')).data, [], "Couldn't load alerts.");
    const [group, setGroup] = useState('ALL');
    const [acting, setActing] = useState(null);
    const act = async (note) => {
        try {
            const r = (await api.post('/app/insights/alerts/action', { AlertKey: acting.alert.key, Status: acting.status, Note: note || null })).data;
            toast(r?.message || 'Saved');
            setActing(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    return (
        <Loadable state={state} rows={5}>
            {(d) => {
                const groups = [...new Set(d.alerts.map((a) => a.groupLabel))];
                const shown = d.alerts.filter((a) => group === 'ALL' || a.groupLabel === group);
                return (
                    <>
                        <KpiTiles data={d.summary} icon="alert-triangle" />
                        {groups.length > 1 ? <Chips options={[{ value: 'ALL', label: 'All' }, ...groups.map((g) => ({ value: g, label: g }))]} value={group} onChange={setGroup} /> : null}
                        {shown.length ? (
                            <View style={{ gap: space(1.25) }}>
                                {shown.map((a) => (
                                    <Card key={a.key} style={{ padding: space(1.5) }}>
                                        <View style={styles.top}>
                                            <Tag label={a.title} tone={SEVERITY[a.severity] || 'neutral'} />
                                            {a.status !== 'OPEN' ? <Tag label={titleCase(a.status)} tone="neutral" /> : null}
                                        </View>
                                        <Text style={[text.subtitle, { marginTop: 6 }]}>{a.subject}</Text>
                                        <Text style={text.small}>{[a.employee && titleCase(a.employee), a.detail].filter(Boolean).join(' · ')}</Text>
                                        {a.note ? <Text style={text.small}>{`${titleCase(a.actedBy) || ''}: “${a.note}”`}</Text> : null}
                                        {d.canAct ? (
                                            <View style={styles.actions}>
                                                {a.status === 'OPEN' ? <Button title="Acknowledge" small variant="outline" onPress={() => setActing({ alert: a, status: 'ACKNOWLEDGED' })} style={{ flex: 1 }} /> : null}
                                                <Button title="Resolve" small icon="check" onPress={() => setActing({ alert: a, status: 'RESOLVED' })} style={{ flex: 1 }} />
                                            </View>
                                        ) : null}
                                    </Card>
                                ))}
                            </View>
                        ) : (
                            <Card>
                                <Empty icon="check-circle" title="No open alerts" />
                            </Card>
                        )}
                        <ReasonDialog visible={Boolean(acting)} title={acting?.status === 'RESOLVED' ? 'Resolve this alert?' : 'Acknowledge this alert?'} label="Note (optional)" minLength={0} submitLabel="Save" onSubmit={act} onClose={() => setActing(null)} />
                    </>
                );
            }}
        </Loadable>
    );
}

const INSIGHTS = {
    performance: { title: 'Performance insights', order: ['totals', 'findings', 'employees'] },
    field: { title: 'Field intelligence', order: ['totals', 'highlights', 'weekdays', 'slots', 'territories', 'specialities', 'highEffort'] },
    analytics: { title: 'Advanced analytics', order: ['segments', 'pareto', 'forecast', 'doctors'] },
};

// Insights: performance, field intelligence, risk & alerts, advanced analytics.
export function Insights({ navigation, route }) {
    const section = route.params?.section || 'performance';
    const def = INSIGHTS[section];
    const state = useLoad(async () => (section === 'alerts' ? null : (await api.get(`/app/insights/${section}`)).data), [section], "Couldn't load insights.");
    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Insights" title={route.params?.title || def?.title || 'Risk & alerts'} onBack={() => navigation.goBack()} />
            {section === 'alerts' ? (
                <Alerts navigation={navigation} />
            ) : (
                <Loadable state={state} rows={6}>
                    {(d) => (
                        <>
                            {d.period ? <Text style={[text.small, { marginBottom: space(1.5) }]}>{`${d.period.from} to ${d.period.to}`}</Text> : null}
                            {Array.isArray(d.findings) && d.findings.length ? (
                                <Card style={{ marginBottom: space(1.5) }}>
                                    {d.findings.map((f, i) => (
                                        <Text key={i} style={[text.body, { marginBottom: 4 }]}>
                                            • {typeof f === 'string' ? f : f.text || f.title || JSON.stringify(f)}
                                        </Text>
                                    ))}
                                </Card>
                            ) : null}
                            <DataView data={{ ...d, findings: undefined }} order={def.order} />
                        </>
                    )}
                </Loadable>
            )}
        </Screen>
    );
}

// Admin: switch alert rules on / off and set their thresholds.
export function InsightRules({ navigation }) {
    const permissions = usePermissions();
    const canEdit = permissions.has('insightrules.edit');
    const state = useLoad(async () => (await api.get('/app/insights/rules')).data.rules, [], "Couldn't load rules.");
    const [editing, setEditing] = useState(null);
    const [busy, setBusy] = useState(false);

    const save = async (body) => {
        setBusy(true);
        try {
            const r = (await api.put(`/app/insights/rules/${editing.code}`, body)).data;
            toast(r?.message || 'Rule saved');
            setEditing(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Insights" title="Insight rules" onBack={() => navigation.goBack()} />
            <Loadable state={state}>
                {(rules) => (
                    <View style={{ gap: space(1.25) }}>
                        {rules.map((r) => (
                            <Card key={r.code} style={{ padding: space(1.5) }}>
                                <View style={styles.top}>
                                    <Text style={[text.subtitle, { flex: 1 }]}>{r.title}</Text>
                                    <Tag label={r.enabled ? 'On' : 'Off'} tone={r.enabled ? 'success' : 'neutral'} />
                                </View>
                                <Text style={text.small}>{[r.groupLabel, r.labels?.[0] && `${r.labels[0]}: ${r.t1}`, r.labels?.[1] && `${r.labels[1]}: ${r.t2}`].filter(Boolean).join(' · ')}</Text>
                                {r.description ? <Text style={text.small}>{r.description}</Text> : null}
                                {canEdit ? (
                                    editing?.code === r.code ? (
                                        <View style={{ marginTop: space(1.25) }}>
                                            {r.labels?.[0] ? <Field label={r.labels[0]} value={String(editing.t1 ?? '')} onChangeText={(v) => setEditing((e) => ({ ...e, t1: v.replace(/[^\d.]/g, '') }))} keyboardType="decimal-pad" /> : null}
                                            {r.labels?.[1] ? <Field label={r.labels[1]} value={String(editing.t2 ?? '')} onChangeText={(v) => setEditing((e) => ({ ...e, t2: v.replace(/[^\d.]/g, '') }))} keyboardType="decimal-pad" /> : null}
                                            <View style={styles.actions}>
                                                <Button title={editing.enabled ? 'Turn off' : 'Turn on'} small variant="outline" onPress={() => setEditing((e) => ({ ...e, enabled: !e.enabled }))} style={{ flex: 1 }} />
                                                <Button title="Save" small icon="check" busy={busy} onPress={() => save({ IsEnabled: editing.enabled, Threshold1: editing.t1 === '' ? null : Number(editing.t1), Threshold2: editing.t2 === '' ? null : Number(editing.t2) })} style={{ flex: 1 }} />
                                            </View>
                                            <Button title="Reset to defaults" small variant="ghost" onPress={() => save({ Reset: true })} />
                                        </View>
                                    ) : (
                                        <Button title="Change" small variant="ghost" onPress={() => setEditing({ code: r.code, enabled: r.enabled, t1: r.t1, t2: r.t2 })} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                                    )
                                ) : null}
                            </Card>
                        ))}
                    </View>
                )}
            </Loadable>
        </Screen>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6 },
    actions: { flexDirection: 'row', gap: space(1), marginTop: space(1.25) },
});

