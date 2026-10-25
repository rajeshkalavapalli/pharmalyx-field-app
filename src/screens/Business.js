import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, dateKey, errorMessage, monthKey, rupees } from '../api';
import { titleCase } from '../format';
import { PersonPicker, usePeople } from '../people';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, KeyValue, ListRow, Loadable, MiniBars, MonthSwitcher, Notice, ReasonDialog, Screen, SectionTitle, Select, StatGrid, Tag } from '../ui';

const MILESTONE = { MET: { label: 'Met', tone: 'success' }, MISSED: { label: 'Missed', tone: 'error' }, IN_PROGRESS: { label: 'This month', tone: 'warning' }, UPCOMING: { label: 'Upcoming', tone: 'neutral' } };
const RETURN_REASONS = [
    { value: 'EXPIRED', label: 'Expired' },
    { value: 'DAMAGED', label: 'Damaged' },
    { value: 'OTHER', label: 'Other' },
];
const line = { borderTopWidth: 1, borderTopColor: colors.lineSoft };
const monthShort = (m) => (m ? new Date(`${String(m).slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }) : '—');
const day = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

function Review({ userId }) {
    const [month, setMonth] = useState(monthKey());
    const state = useLoad(async () => (await api.get('/app/business/review', { params: { month, userId: userId || undefined } })).data, [month, userId], "Couldn't load the review.");
    return (
        <>
            <MonthSwitcher value={month} onChange={setMonth} />
            <Loadable state={state} rows={5}>
                {(d) => (
                    <>
                        <Text style={[text.small, { marginBottom: space(1.5) }]}>{`${titleCase(d.name)} · month ${d.monthNumber ?? '—'} since joining`}</Text>
                        <StatGrid
                            items={[
                                { icon: 'trending-up', label: 'Net sales', value: rupees(d.sales.net), caption: d.sales.pctOfCost == null ? 'Cost not set' : `${d.sales.pctOfCost}% of cost${d.sales.targetPct ? ` · target ${d.sales.targetPct}%` : ''}`, tone: 'success' },
                                { icon: 'credit-card', label: 'Cost', value: rupees(d.sales.cost), caption: 'Salary + TA/DA + spend' },
                                { icon: 'target', label: 'STP coverage', value: d.stpCoverage == null ? '—' : `${d.stpCoverage}%`, caption: `${d.validVisits} counted visits`, tone: 'info' },
                                { icon: 'shopping-bag', label: 'POB', value: rupees(d.pob.bookedValue), caption: `${d.pob.booked} booked · ${d.pob.supplied} supplied · ${d.pob.chemistsOrdered} chemists`, tone: 'warning' },
                            ]}
                        />
                        <Card style={{ marginBottom: space(1.5) }}>
                            <KeyValue rows={[['Dispatched', rupees(d.sales.dispatched)], ['Expired returns', rupees(d.sales.expired)], ['Damaged returns', rupees(d.sales.damaged)], ['Other returns', rupees(d.sales.other)], ['Near-expiry batches', d.nearExpiry]]} />
                        </Card>
                        {(d.flags || []).length ? (
                            <>
                                <SectionTitle title="Things to check" caption="Checks lead to a review, not a penalty." />
                                {d.flags.map((f) => (
                                    <Notice key={f.FlagId} tone={f.Severity === 'HIGH' ? 'error' : 'warning'} title={titleCase(String(f.FlagType).replace(/_/g, ' '))}>
                                        {typeof f.Details === 'string' ? f.Details : JSON.stringify(f.Details)}
                                    </Notice>
                                ))}
                            </>
                        ) : null}
                        {(d.milestones || []).length ? (
                            <>
                                <SectionTitle title="Milestones" />
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    {d.milestones.map((m, i) => (
                                        <View key={m.MilestoneId || i} style={i > 0 && line}>
                                            <ListRow title={m.label || `Month ${m.MonthNumber}`} caption={`${m.actual ?? '—'} of ${m.Target}${m.unit ? ` ${m.unit}` : ''}`} right={<Tag label={MILESTONE[m.status]?.label || m.status} tone={MILESTONE[m.status]?.tone} />} chevron={false} />
                                        </View>
                                    ))}
                                </Card>
                            </>
                        ) : null}
                    </>
                )}
            </Loadable>
        </>
    );
}

function Ramp({ userId }) {
    const state = useLoad(async () => (await api.get('/app/business/ramp-up', { params: { userId: userId || undefined } })).data, [userId], "Couldn't load ramp-up.");
    return (
        <Loadable state={state}>
            {(d) => (
                <>
                    {!d.joiningSet ? <Notice tone="warning">Joining date is not set yet (head office sets it in Business Data).</Notice> : null}
                    <Text style={[text.small, { marginBottom: space(1.5) }]}>{`Joined ${day(d.joiningDate)} · month ${d.monthNumber}`}</Text>
                    {d.milestones.length ? (
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {d.milestones.map((m, i) => (
                                <View key={m.MilestoneId || i} style={i > 0 && line}>
                                    <ListRow title={`Month ${m.MonthNumber} · ${m.label || m.Metric}`} caption={`${monthShort(m.month)} · target ${m.Target}${m.unit ? ` ${m.unit}` : ''} · actual ${m.actual ?? '—'}`} right={<Tag label={MILESTONE[m.status]?.label || m.status} tone={MILESTONE[m.status]?.tone} />} chevron={false} />
                                </View>
                            ))}
                        </Card>
                    ) : (
                        <Card>
                            <Empty icon="flag" title="No milestones set" />
                        </Card>
                    )}
                </>
            )}
        </Loadable>
    );
}

function Cost({ userId }) {
    const state = useLoad(async () => (await api.get('/app/business/cost', { params: { userId: userId || undefined } })).data, [userId], "Couldn't load cost vs business.");
    return (
        <Loadable state={state}>
            {(d) => (
                <>
                    {!d.salarySet ? <Notice tone="warning">Salary is not set yet, so cost may be understated.</Notice> : null}
                    {d.summary ? (
                        <StatGrid
                            items={[
                                { icon: 'credit-card', label: 'Total cost', value: rupees(d.summary.cumulativeCost), caption: 'Since joining' },
                                { icon: 'trending-up', label: 'Total business', value: rupees(d.summary.cumulativeNet), caption: d.summary.recoveredPercent != null ? `${d.summary.recoveredPercent}% recovered` : '', tone: 'success' },
                            ]}
                        />
                    ) : null}
                    <SectionTitle title="Month by month" caption="Cost (light) vs net business" />
                    <Card style={{ marginBottom: space(1.5) }}>
                        <MiniBars data={(d.series || []).slice(-12).map((s) => ({ label: monthShort(s.month), value: s.net, secondary: s.cost }))} />
                    </Card>
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {(d.series || [])
                            .slice()
                            .reverse()
                            .map((s, i) => (
                                <View key={s.month} style={i > 0 && line}>
                                    <ListRow title={monthShort(s.month)} caption={`Cost ${rupees(s.cost)} · business ${rupees(s.net)}${s.recoveredPercent != null ? ` · ${s.recoveredPercent}% recovered` : ''}`} chevron={false} />
                                </View>
                            ))}
                    </Card>
                </>
            )}
        </Loadable>
    );
}

function Incentives({ userId }) {
    const state = useLoad(async () => (await api.get('/app/business/incentives', { params: { userId: userId || undefined } })).data, [userId], "Couldn't load incentives.");
    return (
        <Loadable state={state}>
            {(d) => (
                <>
                    <StatGrid
                        items={[
                            { icon: 'award', label: 'Earned', value: rupees(d.totals.earned), tone: 'success' },
                            { icon: 'clock', label: 'Held', value: rupees(d.totals.held), caption: `Released after ${d.holdMonths} months`, tone: 'warning' },
                            { icon: 'check-circle', label: 'Released', value: rupees(d.totals.released) },
                            { icon: 'minus-circle', label: 'Deducted', value: rupees(d.totals.deducted), caption: 'Returns after payout', tone: 'error' },
                        ]}
                    />
                    <Text style={[text.small, { marginBottom: space(1.5) }]}>{`Slabs: ${d.slabs.map((s) => `${s.RatePercent}% from ${rupees(s.FromAmount)}`).join(' · ') || 'not set'}`}</Text>
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {d.months.map((m, i) => (
                            <View key={m.month} style={i > 0 && line}>
                                <ListRow title={monthShort(m.month)} caption={`Net ${rupees(m.netSales)} at ${m.rate ?? 0}% · earned ${rupees(m.earned)}${m.held ? ` · held ${rupees(m.held)}` : ''}${m.released ? ` · released ${rupees(m.released)}` : ''}${m.deducted ? ` · deducted ${rupees(m.deducted)}` : ''}`} chevron={false} />
                            </View>
                        ))}
                    </Card>
                </>
            )}
        </Loadable>
    );
}

function Expiry({ userId }) {
    const state = useLoad(async () => (await api.get('/app/business/near-expiry', { params: { userId: userId || undefined } })).data, [userId], "Couldn't load near-expiry stock.");
    return (
        <Loadable state={state}>
            {(d) =>
                d.batches.length ? (
                    <>
                        <Text style={[text.small, { marginBottom: space(1.5) }]}>{`Batches at your stockists expiring within ${d.days} days. Help liquidate them before they come back as returns.`}</Text>
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {d.batches.map((b, i) => (
                                <View key={`${b.BatchId}-${b.StockistId}`} style={i > 0 && line}>
                                    <ListRow title={`${b.ProductName} · ${b.BatchNumber}`} caption={`${titleCase(b.StockistName)} · ${b.Quantity} units · expires ${day(b.ExpiryDate)}`} right={<Tag label={b.expired ? 'Expired' : `${b.DaysLeft} d`} tone={b.expired ? 'error' : 'warning'} />} chevron={false} />
                                </View>
                            ))}
                        </Card>
                    </>
                ) : (
                    <Card>
                        <Empty icon="check-circle" title="Nothing near expiry" />
                    </Card>
                )
            }
        </Loadable>
    );
}

// Business tracker: an MR's business against their cost, ramp-up milestones, incentives and near-expiry stock.
export function BusinessTracker({ navigation }) {
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [tab, setTab] = useState('review');
    return (
        <Screen>
            <Header overline="Sales & distribution" title="Business tracker" onBack={() => navigation.goBack()} />
            <PersonPicker people={people} value={userId} onChange={setUserId} />
            <Chips
                options={[
                    { value: 'review', label: 'Month' },
                    { value: 'ramp', label: 'Ramp-up' },
                    { value: 'cost', label: 'Cost vs business' },
                    { value: 'incentives', label: 'Incentives' },
                    { value: 'expiry', label: 'Near expiry' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {tab === 'review' && <Review userId={userId} />}
            {tab === 'ramp' && <Ramp userId={userId} />}
            {tab === 'cost' && <Cost userId={userId} />}
            {tab === 'incentives' && <Incentives userId={userId} />}
            {tab === 'expiry' && <Expiry userId={userId} />}
        </Screen>
    );
}

function RecordSheet({ kind, onClose, onSaved }) {
    const [stockists, setStockists] = useState([]);
    const [territoryNames, setTerritoryNames] = useState({});
    const [products, setProducts] = useState([]);
    const [batches, setBatches] = useState([]);
    const [form, setForm] = useState({ StockistId: '', TerritoryId: '', ProductId: '', BatchId: '', Quantity: '', Value: '', Date: dateKey(), Reason: 'EXPIRED', Remarks: '' });
    const [busy, setBusy] = useState(false);
    const set = (p) => setForm((f) => ({ ...f, ...p }));

    useEffect(() => {
        api.get('/app/business/stockists')
            .then((r) => {
                setStockists(r.data?.stockists || []);
                setTerritoryNames(Object.fromEntries((r.data?.territories || []).map((t) => [String(t.TerritoryId).toLowerCase(), t.TerritoryName])));
            })
            .catch(() => {});
        api.get('/app/catalogue/products', { params: { active: '1' } }).then((r) => setProducts(r.data?.products || [])).catch(() => {});
    }, []);
    useEffect(() => {
        if (!form.ProductId) return;
        api.get('/app/business/batches', { params: { productId: form.ProductId } })
            .then((r) => setBatches(r.data?.batches || []))
            .catch(() => setBatches([]));
    }, [form.ProductId]);

    const st = stockists.find((s) => s.StockistId === form.StockistId);
    const territories = st ? (st.TerritoryIds || []).map((id) => ({ value: id, label: titleCase(territoryNames[String(id).toLowerCase()] || id) })) : [];
    const ok = form.StockistId && form.TerritoryId && form.ProductId && Number(form.Quantity) > 0 && Number(form.Value) >= 0 && form.Value !== '';

    const save = async () => {
        setBusy(true);
        try {
            const r = (await api.post(`/app/business/${kind}`, { ...form, BatchId: form.BatchId || null, Quantity: Number(form.Quantity), Value: Number(form.Value) })).data;
            toast(r?.message || 'Saved');
            onSaved();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal visible animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHead}>
                        <Text style={[text.title, { flex: 1 }]}>{kind === 'dispatches' ? 'Record dispatch' : 'Record return'}</Text>
                        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    <Select label="Stockist" value={form.StockistId} options={stockists.map((s) => ({ value: s.StockistId, label: titleCase(s.StockistName) }))} onChange={(v) => set({ StockistId: v, TerritoryId: '' })} />
                    <Select label="Territory" value={form.TerritoryId} options={territories} onChange={(v) => set({ TerritoryId: v })} disabled={!st} empty="This stockist has no territory yet." />
                    <Select label="Product" value={form.ProductId} options={products.map((p) => ({ value: p.ProductId, label: p.ProductName }))} onChange={(v) => set({ ProductId: v, BatchId: '' })} searchable />
                    <Select label="Batch (optional)" value={form.BatchId} options={batches.map((b) => ({ value: b.BatchId, label: b.BatchNumber, detail: `expires ${day(b.ExpiryDate)}` }))} onChange={(v) => set({ BatchId: v })} disabled={!form.ProductId} />
                    <View style={{ flexDirection: 'row', gap: space(1) }}>
                        <View style={{ flex: 1 }}>
                            <Field label="Quantity" value={form.Quantity} onChangeText={(v) => set({ Quantity: v.replace(/\D/g, '') })} keyboardType="number-pad" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <Field label="Value (₹)" value={form.Value} onChangeText={(v) => set({ Value: v.replace(/[^\d.]/g, '') })} keyboardType="decimal-pad" />
                        </View>
                    </View>
                    {kind === 'returns' ? <Chips options={RETURN_REASONS} value={form.Reason} onChange={(v) => set({ Reason: v })} /> : null}
                    <Field label="Remarks (optional)" value={form.Remarks} onChangeText={(v) => set({ Remarks: v.slice(0, 300) })} />
                    <Button title="Save" icon="check" onPress={save} busy={busy} disabled={!ok} />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// Head office business data: company dispatches (primary sales), returns / expiry, batches and people costs.
export function BusinessData({ navigation }) {
    const [tab, setTab] = useState('dispatches');
    const [month, setMonth] = useState(monthKey());
    const records = useLoad(async () => (['dispatches', 'returns'].includes(tab) ? (await api.get(`/app/business/${tab}`, { params: { month } })).data[tab] : null), [tab, month], "Couldn't load records.");
    const people = useLoad(async () => (tab === 'people' ? (await api.get('/app/business/people')).data.people : null), [tab], "Couldn't load people.");
    const batches = useLoad(async () => (tab === 'batches' ? (await api.get('/app/business/batches')).data.batches : null), [tab], "Couldn't load batches.");
    const [adding, setAdding] = useState(false);
    const [voiding, setVoiding] = useState(null);

    const voidIt = async (reason) => {
        try {
            const id = voiding.DispatchId || voiding.ReturnId;
            const r = (await api.post(`/app/business/${tab}/${id}/void`, { Reason: reason })).data;
            toast(r?.message || 'Voided');
            setVoiding(null);
            records.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    return (
        <Screen>
            <Header overline="Sales & distribution" title="Business data" onBack={() => navigation.goBack()} right={['dispatches', 'returns'].includes(tab) ? <Button title="Add" icon="plus" small onPress={() => setAdding(true)} /> : null} />
            <Chips
                options={[
                    { value: 'dispatches', label: 'Dispatches' },
                    { value: 'returns', label: 'Returns' },
                    { value: 'batches', label: 'Batches' },
                    { value: 'people', label: 'People costs' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {['dispatches', 'returns'].includes(tab) ? (
                <>
                    <MonthSwitcher value={month} onChange={setMonth} />
                    <Loadable state={records}>
                        {(rows) =>
                            rows.length ? (
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    {rows.map((r, i) => (
                                        <View key={r.DispatchId || r.ReturnId} style={[styles.pad, i > 0 && line]}>
                                            <View style={styles.top}>
                                                <Text style={[text.subtitle, { flex: 1 }]}>{`${r.ProductName}${r.BatchNumber ? ` · ${r.BatchNumber}` : ''}`}</Text>
                                                <Text style={text.subtitle}>{rupees(r.Value)}</Text>
                                            </View>
                                            <Text style={text.small}>{[day(r.DispatchDate || r.ReturnDate), titleCase(r.StockistName), titleCase(r.TerritoryName), `${r.Quantity} units`, r.Reason && titleCase(r.Reason), r.CreatedByName && `by ${titleCase(r.CreatedByName)}`].filter(Boolean).join(' · ')}</Text>
                                            {r.VoidedOn ? <Tag label={`Voided: ${r.VoidReason}`} tone="neutral" /> : <Button title="Void" small variant="ghost" onPress={() => setVoiding(r)} style={{ alignSelf: 'flex-start' }} />}
                                        </View>
                                    ))}
                                </Card>
                            ) : (
                                <Card>
                                    <Empty icon="truck" title={`No ${tab} this month`} />
                                </Card>
                            )
                        }
                    </Loadable>
                </>
            ) : null}
            {tab === 'batches' ? (
                <Loadable state={batches}>
                    {(rows) => (
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {rows.map((b, i) => (
                                <View key={b.BatchId} style={i > 0 && line}>
                                    <ListRow title={`${b.ProductName} · ${b.BatchNumber}`} caption={`Made ${day(b.MfgDate)} · expires ${day(b.ExpiryDate)}`} chevron={false} />
                                </View>
                            ))}
                        </Card>
                    )}
                </Loadable>
            ) : null}
            {tab === 'people' ? (
                <Loadable state={people}>
                    {(rows) => (
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {rows.map((p, i) => (
                                <View key={p.UserId} style={i > 0 && line}>
                                    <ListRow title={titleCase(p.Name)} caption={[p.JoiningDate ? `joined ${day(p.JoiningDate)}` : 'joining date not set', p.MonthlySalary != null ? `salary ${rupees(p.MonthlySalary)}` : 'salary not set'].join(' · ')} chevron={false} />
                                </View>
                            ))}
                        </Card>
                    )}
                </Loadable>
            ) : null}
            {adding ? (
                <RecordSheet
                    kind={tab}
                    onClose={() => setAdding(false)}
                    onSaved={() => {
                        setAdding(false);
                        records.reload();
                    }}
                />
            ) : null}
            <ReasonDialog visible={Boolean(voiding)} title="Void this record?" caption="It stays on record as voided; it is not deleted." label="Reason" submitLabel="Void" onSubmit={voidIt} onClose={() => setVoiding(null)} />
        </Screen>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    pad: { padding: space(1.5) },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4), maxHeight: '92%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
});
