import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, errorMessage, monthKey, rupees } from '../api';
import { doctorName, titleCase } from '../format';
import { PersonPicker, usePeople } from '../people';
import { usePermissions } from '../permissions';
import { colors, fonts, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, ListRow, Loadable, MonthSwitcher, Notice, ReasonDialog, Screen, SectionTitle, StatGrid, Tag } from '../ui';

const PLAN_STATUS = {
    NOT_STARTED: { label: 'Not started', tone: 'neutral' },
    DRAFT: { label: 'Draft', tone: 'neutral' },
    SUBMITTED: { label: 'Sent for review', tone: 'warning' },
    APPROVED: { label: 'Approved', tone: 'success' },
    RETURNED: { label: 'Returned', tone: 'error' },
};
const line = { borderTopWidth: 1, borderTopColor: colors.lineSoft };
const pctTone = (p) => (p == null ? 'neutral' : p >= 100 ? 'success' : p >= 70 ? 'warning' : 'error');
const monthLabel = (m) => new Date(`${String(m).slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

function NumInput({ value, onChange, width = 70 }) {
    return <TextInput style={[styles.num, { width }]} value={String(value ?? '')} onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.inkFaint} />;
}

// Plan one doctor: visits this month, products and units to grow, support needed.
function DoctorSheet({ doctor, month, products, onClose, onSaved }) {
    const [visits, setVisits] = useState(doctor.plannedVisits ? String(doctor.plannedVisits) : '');
    const [support, setSupport] = useState(doctor.support || '');
    const [units, setUnits] = useState(Object.fromEntries((doctor.products || []).filter((p) => p.plannedUnits).map((p) => [p.ProductId, String(p.plannedUnits)])));
    const [busy, setBusy] = useState(false);

    const save = async (remove) => {
        setBusy(true);
        try {
            const r = (
                await api.put('/app/plans/doctors/item', {
                    Month: month,
                    DoctorId: doctor.DoctorId,
                    PlannedVisits: remove ? 0 : Number(visits || 0),
                    Support: remove ? null : support.trim() || null,
                    Products: remove ? [] : Object.entries(units).filter(([, u]) => Number(u) > 0).map(([ProductId, u]) => ({ ProductId, PlannedUnits: Number(u) })),
                })
            ).data;
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
                        <Text style={[text.title, { flex: 1 }]}>{doctorName(doctor.DoctorName)}</Text>
                        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    <View style={styles.row}>
                        <Text style={[text.subtitle, { flex: 1 }]}>Visits this month</Text>
                        <NumInput value={visits} onChange={setVisits} />
                    </View>
                    <Text style={[styles.label, { marginTop: space(1.5) }]}>Units to grow (prescriptions)</Text>
                    <View style={{ maxHeight: 260 }}>
                        <ScrollView keyboardShouldPersistTaps="handled">
                            {products.map((p) => (
                                <View key={p.ProductId} style={styles.row}>
                                    <Text style={[text.body, { flex: 1 }]}>{p.ProductName}</Text>
                                    <NumInput value={units[p.ProductId] || ''} onChange={(v) => setUnits((u) => ({ ...u, [p.ProductId]: v }))} />
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                    <Field label="Support needed (optional)" value={support} onChangeText={(v) => setSupport(v.slice(0, 300))} autoCapitalize="sentences" />
                    <View style={styles.actions}>
                        {doctor.planned ? <Button title="Remove from plan" small variant="danger" onPress={() => save(true)} busy={busy} style={{ flex: 1 }} /> : null}
                        <Button title="Save" small icon="check" onPress={() => save(false)} busy={busy} disabled={!Number(visits)} style={{ flex: 1 }} />
                    </View>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function PlanBody({ data, editable, onEdit }) {
    const s = data.summary;
    return (
        <>
            <StatGrid
                items={[
                    { icon: 'users', label: 'Doctors planned', value: `${s.planned}/${s.doctors}`, caption: `${s.plannedVisits} visits planned` },
                    { icon: 'map-pin', label: 'Visits done', value: s.visitPercent == null ? '—' : `${s.visitPercent}%`, caption: `${s.actualVisits} of ${s.plannedVisits}`, tone: pctTone(s.visitPercent) === 'error' ? 'error' : 'success' },
                    { icon: 'trending-up', label: 'Rx achieved', value: s.rxPercent == null ? '—' : `${s.rxPercent}%`, caption: `${s.rxUnits} of ${s.plannedUnits} units`, tone: 'info' },
                    { icon: 'shopping-bag', label: 'POB units', value: `${s.pobUnits}` },
                ]}
            />
            <Card style={{ padding: 0, overflow: 'hidden' }}>
                {data.doctors.length ? (
                    data.doctors.map((d, i) => (
                        <View key={d.DoctorId} style={i > 0 && line}>
                            <ListRow
                                title={doctorName(d.DoctorName)}
                                caption={d.planned ? `${d.actualVisits}/${d.plannedVisits} visits · ${d.rxUnits}/${d.plannedUnits} units${d.support ? ` · ${d.support}` : ''}` : [titleCase(d.Speciality), d.Category && `Class ${d.Category}`, 'not in plan'].filter(Boolean).join(' · ')}
                                right={d.planned ? <Tag label={d.achievement == null ? 'Planned' : `${d.achievement}%`} tone={pctTone(d.achievement)} /> : null}
                                onPress={editable ? () => onEdit(d) : undefined}
                                chevron={editable}
                            />
                        </View>
                    ))
                ) : (
                    <Empty icon="users" title="No doctors" />
                )}
            </Card>
        </>
    );
}

// Doctor business plan: which doctors, how many visits and units each month; manager reviews.
export function DoctorPlan({ navigation }) {
    const permissions = usePermissions();
    const people = usePeople();
    const [tab, setTab] = useState('plan');
    const [userId, setUserId] = useState('');
    const [month, setMonth] = useState(monthKey());
    const [editing, setEditing] = useState(null);
    const [reviewing, setReviewing] = useState(null);
    const [deciding, setDeciding] = useState(null);
    const [busy, setBusy] = useState(false);
    const state = useLoad(async () => (await api.get('/app/plans/doctors', { params: { month, userId: userId || undefined } })).data, [month, userId], "Couldn't load the plan.");
    const reviews = useLoad(async () => (tab === 'reviews' ? (await api.get('/app/plans/doctors/reviews')).data.reviews : null), [tab], "Couldn't load plans to review.");
    const review = useLoad(async () => (reviewing ? (await api.get(`/app/plans/doctors/${reviewing}`)).data : null), [reviewing], "Couldn't load the plan.");

    const submit = async () => {
        setBusy(true);
        try {
            const r = (await api.post('/app/plans/doctors/submit', { Month: month })).data;
            toast(r?.message || 'Sent for review');
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };
    const decide = async (remarks) => {
        try {
            const r = (await api.post(`/app/plans/doctors/${reviewing}/${deciding}`, { Remarks: remarks || null })).data;
            toast(r?.message || 'Saved');
            setDeciding(null);
            setReviewing(null);
            reviews.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    if (reviewing)
        return (
            <Screen
                footer={
                    review.data?.canReview ? (
                        <View style={styles.actions}>
                            <Button title="Return" variant="danger" onPress={() => setDeciding('return')} style={{ flex: 1 }} />
                            <Button title="Approve" icon="check" onPress={() => setDeciding('approve')} style={{ flex: 1 }} />
                        </View>
                    ) : null
                }
            >
                <Header overline={review.data ? monthLabel(review.data.plan.PlanMonth) : 'Plan'} title={review.data ? titleCase(review.data.plan.UserName) : '…'} onBack={() => setReviewing(null)} />
                <Loadable state={review}>{(d) => <PlanBody data={d} editable={false} />}</Loadable>
                <ReasonDialog visible={Boolean(deciding)} title={deciding === 'approve' ? 'Approve this plan?' : 'Return for changes?'} label={deciding === 'approve' ? 'Remarks (optional)' : 'What should change'} minLength={deciding === 'return' ? 5 : 0} submitLabel={deciding === 'approve' ? 'Approve' : 'Return'} onSubmit={decide} onClose={() => setDeciding(null)} />
            </Screen>
        );

    const d = state.data;
    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Planning" title="Doctor business plan" onBack={() => navigation.goBack()} />
            {permissions.has('doctorplan.approve') ? (
                <Chips
                    options={[
                        { value: 'plan', label: 'Plan' },
                        { value: 'reviews', label: 'To review' },
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            ) : null}
            {tab === 'reviews' ? (
                <Loadable state={reviews}>
                    {(rows) =>
                        rows.length ? (
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {rows.map((r, i) => (
                                    <View key={r.PlanId} style={i > 0 && line}>
                                        <ListRow icon="target" title={titleCase(r.UserName)} caption={`${monthLabel(r.PlanMonth)} · ${r.Doctors} doctors · ${r.PlannedVisits} visits · ${r.PlannedUnits} units`} onPress={() => setReviewing(r.PlanId)} />
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <Card>
                                <Empty icon="check-circle" title="No plans waiting" />
                            </Card>
                        )
                    }
                </Loadable>
            ) : (
                <>
                    <PersonPicker people={people} value={userId} onChange={setUserId} />
                    <MonthSwitcher value={month} onChange={setMonth} allowFuture />
                    <Loadable state={state} rows={6}>
                        {() => (
                            <>
                                <View style={styles.tags}>
                                    <Tag label={PLAN_STATUS[d.status]?.label || d.status} tone={PLAN_STATUS[d.status]?.tone} />
                                </View>
                                {d.plan?.ReviewRemarks ? <Notice tone={d.status === 'RETURNED' ? 'error' : 'info'} title="Manager's remarks">{d.plan.ReviewRemarks}</Notice> : null}
                                {d.blockedReason ? <Text style={[text.small, { marginBottom: space(1.5) }]}>{d.blockedReason}</Text> : null}
                                <PlanBody data={d} editable={d.canEdit} onEdit={setEditing} />
                                {d.canSubmit ? <Button title="Send plan for review" icon="send" onPress={submit} busy={busy} style={{ marginTop: space(2) }} /> : null}
                            </>
                        )}
                    </Loadable>
                </>
            )}
            {editing ? (
                <DoctorSheet
                    doctor={editing}
                    month={month}
                    products={d?.products || []}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        state.reload();
                    }}
                />
            ) : null}
        </Screen>
    );
}

// Set a team member's product targets (quantity per product) for a month.
function TargetForm({ userId, month, onBack }) {
    const state = useLoad(async () => (await api.get('/app/plans/sales/targets', { params: { userId, month } })).data, [userId, month], "Couldn't load targets.");
    const [qty, setQty] = useState(null);
    const [busy, setBusy] = useState(false);
    const current = qty || Object.fromEntries((state.data?.current || []).map((c) => [c.ProductId, String(c.TargetQty)]));
    const total = (state.data?.products || []).reduce((s, p) => s + Number(current[p.ProductId] || 0) * Number(p.UnitPrice || 0), 0);

    const copyLast = () => setQty(Object.fromEntries((state.data?.previous || []).map((c) => [c.ProductId, String(c.TargetQty)])));
    const save = async () => {
        setBusy(true);
        try {
            const r = (await api.put('/app/plans/sales/targets', { UserId: userId, Month: month, Lines: Object.entries(current).map(([ProductId, v]) => ({ ProductId, TargetQty: Number(v || 0) })) })).data;
            toast(r?.message || 'Targets saved');
            onBack();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen footer={<Button title={`Save targets · ${rupees(total)}`} icon="check" onPress={save} busy={busy} />}>
            <Header overline={`Targets · ${monthLabel(month)}`} title={state.data ? titleCase(state.data.user.Name) : '…'} onBack={onBack} />
            <Loadable state={state}>
                {(d) => (
                    <>
                        {d.previous.length ? <Button title="Copy last month's targets" icon="copy" small variant="ghost" onPress={copyLast} style={{ alignSelf: 'flex-start', marginBottom: space(1) }} /> : null}
                        <Card>
                            {d.products.map((p) => (
                                <View key={p.ProductId} style={styles.row}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={text.body}>{p.ProductName}</Text>
                                        <Text style={text.small}>{rupees(p.UnitPrice)}</Text>
                                    </View>
                                    <NumInput value={current[p.ProductId] || ''} onChange={(v) => setQty({ ...current, [p.ProductId]: v })} width={84} />
                                </View>
                            ))}
                        </Card>
                    </>
                )}
            </Loadable>
        </Screen>
    );
}

// Sales plan: targets vs secondary sales and POB; the manager sets the team's targets.
export function SalesPlan({ navigation }) {
    const permissions = usePermissions();
    const [month, setMonth] = useState(monthKey());
    const [tab, setTab] = useState('mine');
    const [person, setPerson] = useState(null);
    const [targetFor, setTargetFor] = useState(null);
    const canTeam = permissions.has('salesplan.edit');
    const team = useLoad(async () => (canTeam && tab === 'team' ? (await api.get('/app/plans/sales/team', { params: { month } })).data : null), [canTeam, tab, month], "Couldn't load the team.");
    const plan = useLoad(async () => (await api.get('/app/plans/sales', { params: { month, userId: person || undefined } })).data, [month, person], "Couldn't load the plan.");

    if (targetFor) return <TargetForm userId={targetFor} month={month} onBack={() => { setTargetFor(null); team.reload(); plan.reload(); }} />;

    const planView = (
        <Loadable state={plan} rows={5}>
            {(d) => (
                <>
                    {person ? <Text style={[text.subtitle, { marginBottom: space(1) }]}>{titleCase(d.user.Name)}</Text> : null}
                    <StatGrid
                        items={[
                            { icon: 'flag', label: 'Target', value: rupees(d.summary.targetValue), caption: `${d.summary.targetedProducts} products` },
                            { icon: 'bar-chart', label: 'Secondary sales', value: rupees(d.summary.secondaryValue), caption: d.summary.secondaryPercent == null ? 'No target' : `${d.summary.secondaryPercent}% of target`, tone: pctTone(d.summary.secondaryPercent) === 'error' ? 'error' : 'success' },
                            { icon: 'shopping-bag', label: 'POB', value: rupees(d.summary.pobValue), caption: d.summary.pobPercent == null ? '' : `${d.summary.pobPercent}% of target`, tone: 'info' },
                            { icon: 'check-circle', label: 'Products on track', value: `${d.summary.onTrack}/${d.summary.targetedProducts}`, tone: 'warning' },
                        ]}
                    />
                    {d.setBy ? <Text style={[text.small, { marginBottom: space(1) }]}>{`Targets set by ${titleCase(d.setBy)}`}</Text> : null}
                    {d.canEdit ? <Button title="Set targets" icon="edit-2" small variant="outline" onPress={() => setTargetFor(d.user.UserId)} style={{ alignSelf: 'flex-start', marginBottom: space(1.5) }} /> : null}
                    {d.editableReason ? <Text style={[text.small, { marginBottom: space(1) }]}>{d.editableReason}</Text> : null}
                    <SectionTitle title="By product" />
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {d.products.length ? (
                            d.products.map((p, i) => (
                                <View key={p.ProductId} style={i > 0 && line}>
                                    <ListRow title={p.ProductName} caption={`Target ${p.targetQty} · sold ${p.secondaryQty} · POB ${p.pobQty}`} right={<Tag label={p.secondaryPercent == null ? '—' : `${p.secondaryPercent}%`} tone={pctTone(p.secondaryPercent)} />} chevron={false} />
                                </View>
                            ))
                        ) : (
                            <Empty icon="flag" title="No targets this month" caption="Your manager sets targets." />
                        )}
                    </Card>
                </>
            )}
        </Loadable>
    );

    return (
        <Screen refreshControl={plan.refreshControl}>
            <Header overline="Planning" title="Sales plan" onBack={() => (person ? setPerson(null) : navigation.goBack())} />
            {canTeam && !person ? (
                <Chips
                    options={[
                        { value: 'mine', label: 'Mine' },
                        { value: 'team', label: 'My team' },
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            ) : null}
            <MonthSwitcher value={month} onChange={setMonth} allowFuture />
            {tab === 'team' && !person ? (
                <Loadable state={team}>
                    {(d) => (
                        <>
                            <StatGrid
                                items={[
                                    { icon: 'flag', label: 'Team target', value: rupees(d.summary.targetValue), caption: `${d.summary.withTargets} of ${d.summary.members} have targets` },
                                    { icon: 'bar-chart', label: 'Secondary sales', value: rupees(d.summary.secondaryValue), caption: d.summary.secondaryPercent == null ? '' : `${d.summary.secondaryPercent}% of target`, tone: 'success' },
                                ]}
                            />
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {d.team.map((m, i) => (
                                    <View key={m.UserId} style={i > 0 && line}>
                                        <ListRow title={titleCase(m.Name)} caption={`Target ${rupees(m.targetValue)} · sold ${rupees(m.secondaryValue)} · POB ${rupees(m.pobValue)}`} right={<Tag label={m.secondaryPercent == null ? 'No target' : `${m.secondaryPercent}%`} tone={pctTone(m.secondaryPercent)} />} onPress={() => setPerson(m.UserId)} />
                                    </View>
                                ))}
                            </Card>
                        </>
                    )}
                </Loadable>
            ) : (
                planView
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    tags: { flexDirection: 'row', gap: 6, marginBottom: space(1.5) },
    row: { flexDirection: 'row', alignItems: 'center', gap: space(1), paddingVertical: space(0.75) },
    actions: { flexDirection: 'row', gap: space(1), marginTop: space(1) },
    label: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.inkSoft, marginBottom: 6 },
    num: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 8, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, textAlign: 'center', backgroundColor: colors.paper },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4), maxHeight: '92%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
});
