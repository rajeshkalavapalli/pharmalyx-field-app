import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, dateKey, errorMessage } from '../api';
import { doctorName, titleCase } from '../format';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, Loadable, MultiSelect, Screen, SectionTitle, StatGrid, Tag } from '../ui';

const addDays = (key, n) => {
    const d = new Date(`${key}T00:00:00`);
    d.setDate(d.getDate() + n);
    return dateKey(d);
};
const dayLabel = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

function PlanSheet({ doctor, date, onClose, onSaved }) {
    const products = useLoad(async () => (await api.get('/app/catalogue/products', { params: { active: '1' } })).data?.products || [], [], '');
    const plan = doctor.callPlan;
    const [objective, setObjective] = useState(plan?.objective || '');
    const [messages, setMessages] = useState(plan?.keyMessages || '');
    const [productIds, setProductIds] = useState(plan?.productIds?.map((id) => String(id).toLowerCase()) || []);
    const [busy, setBusy] = useState(false);

    const save = async () => {
        setBusy(true);
        try {
            const r = (await api.put('/app/precall/plan', { PlanDate: date, DoctorId: doctor.DoctorId, Objective: objective.trim(), KeyMessages: messages.trim() || null, ProductIds: productIds })).data;
            toast(r?.message || 'Call planned');
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
                        <Text style={[text.title, { flex: 1 }]}>{`Plan call · ${doctorName(doctor.DoctorName)}`}</Text>
                        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    <Field label="Objective *" value={objective} onChangeText={(v) => setObjective(v.slice(0, 500))} multiline autoCapitalize="sentences" placeholder="What should this call achieve?" />
                    <Field label="Key messages" value={messages} onChangeText={(v) => setMessages(v.slice(0, 1000))} multiline autoCapitalize="sentences" />
                    <MultiSelect
                        label="Products to detail (up to 10)"
                        value={productIds}
                        options={(products.data || []).map((p) => ({ value: String(p.ProductId).toLowerCase(), label: p.ProductName, detail: p.PackSize }))}
                        onChange={setProductIds}
                        max={10}
                        empty="No active products in the catalogue."
                    />
                    <Button title="Save call plan" icon="check" onPress={save} busy={busy} disabled={!objective.trim()} />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function Brief({ doctor, canPlan, onPlan, onRemove, onMove, index, last }) {
    const [open, setOpen] = useState(false);
    const plan = doctor.callPlan;
    return (
        <Card style={{ padding: space(1.5) }}>
            <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button">
                <View style={styles.row}>
                    <View style={{ flex: 1 }}>
                        <Text style={text.subtitle} numberOfLines={1}>{doctorName(doctor.DoctorName)}</Text>
                        <Text style={text.small} numberOfLines={1}>{[titleCase(doctor.Speciality), titleCase(doctor.AreaName)].filter(Boolean).join(' · ')}</Text>
                    </View>
                    {doctor.visitedOnDay ? <Tag label="Visited" tone="success" /> : doctor.mustMeet ? <Tag label="Must meet" tone="error" /> : null}
                    <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.inkFaint} />
                </View>
                <View style={styles.tags}>
                    {doctor.reasons.map((r) => (
                        <Tag key={r.code + r.label} label={r.label} tone={r.tone === 'error' ? 'error' : r.tone === 'warning' ? 'warning' : r.tone === 'primary' ? 'primary' : 'info'} />
                    ))}
                </View>
            </Pressable>
            {plan ? (
                <View style={styles.plan}>
                    <Text style={[text.small, { color: colors.jadeDark }]}>{`Call ${plan.order} · ${plan.status === 'VISITED' ? 'visited' : 'planned'}`}</Text>
                    <Text style={text.body}>{plan.objective}</Text>
                    {plan.productNames ? <Text style={text.small}>Products: {plan.productNames}</Text> : null}
                </View>
            ) : null}
            {open && (
                <View style={{ marginTop: space(1) }}>
                    {doctor.lastVisit ? <Text style={text.small}>{`Last visit ${doctor.lastVisit.date}${doctor.lastVisit.feedback ? ` · ${titleCase(doctor.lastVisit.feedback)}` : ''}${doctor.lastVisit.notes ? `: “${doctor.lastVisit.notes}”` : ''}`}</Text> : <Text style={text.small}>Not visited yet.</Text>}
                    {doctor.lastVisit?.itemsGiven ? <Text style={text.small}>Given last time: {doctor.lastVisit.itemsGiven}</Text> : null}
                    {doctor.talkingPoints.map((p) => (
                        <Text key={p} style={[text.small, { color: colors.warningDark, marginTop: 4 }]}>
                            💡 {p}
                        </Text>
                    ))}
                    {doctor.visits ? <Text style={[text.small, { marginTop: 4 }]}>{`${doctor.visits.done} of ${doctor.visits.target || '—'} visits this month`}</Text> : null}
                </View>
            )}
            {canPlan && plan?.status !== 'VISITED' ? (
                <View style={styles.actions}>
                    <Button title={plan ? 'Edit plan' : 'Plan call'} small icon={plan ? 'edit-2' : 'plus'} variant={plan ? 'outline' : 'primary'} onPress={onPlan} style={{ flex: 1 }} />
                    {plan ? <Button title="Remove" small variant="ghost" onPress={onRemove} /> : null}
                    {plan && onMove ? (
                        <>
                            <Button title="↑" small variant="ghost" disabled={index === 0} onPress={() => onMove(index, -1)} />
                            <Button title="↓" small variant="ghost" disabled={last} onPress={() => onMove(index, 1)} />
                        </>
                    ) : null}
                </View>
            ) : null}
        </Card>
    );
}

// Plan the day's calls: who to meet (priority and reasons), the objective and products for each call.
export default function PreCall({ navigation }) {
    const [date, setDate] = useState(dateKey());
    const state = useLoad(async () => (await api.get('/app/precall', { params: { date } })).data, [date], "Couldn't load the day.");
    const [planning, setPlanning] = useState(null);

    const run = async (fn, done) => {
        try {
            await fn();
            toast(done);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    const remove = (doctor) => run(() => api.delete(`/app/precall/plan/${doctor.callPlan.PreCallId}`), 'Removed from plan');
    const move = (index, dir) => {
        const ids = state.data.myPlan.map((d) => d.callPlan.PreCallId);
        [ids[index], ids[index + dir]] = [ids[index + dir], ids[index]];
        run(() => api.put('/app/precall/plan/order', { PlanDate: date, Order: ids }), 'Order saved');
    };

    const dates = [0, 1, 2, 3].map((n) => ({ value: addDays(dateKey(), n), label: n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : dayLabel(addDays(dateKey(), n)) }));

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Pre-call planning" title={dayLabel(date)} onBack={() => navigation.goBack()} />
            <Chips options={dates} value={date} onChange={setDate} />
            <Loadable state={state} rows={5}>
                {(data) => (
                    <>
                        <Card style={{ marginBottom: space(1.5) }}>
                            <Text style={text.small}>Tour plan</Text>
                            <Text style={text.subtitle}>{data.plan ? (data.plan.dayType === 'non-working' ? 'Off day' : [titleCase(data.plan.territoryName), titleCase(data.plan.areaName)].filter(Boolean).join(' · ')) : 'No tour plan for this day'}</Text>
                        </Card>
                        <StatGrid
                            items={[
                                { icon: 'clipboard', label: 'Calls planned', value: `${data.summary.plannedCalls}`, caption: `${data.summary.plannedVisited} visited` },
                                { icon: 'alert-circle', label: 'Must meet', value: `${data.summary.mustMeet}`, caption: `${data.summary.followUpsDue} follow-ups due`, tone: data.summary.mustMeet ? 'error' : 'success' },
                            ]}
                        />
                        {!data.plansEnabled ? <Text style={[text.small, { marginBottom: space(1) }]}>Call plans are not set up on the server yet; you can still see who to meet.</Text> : null}

                        {data.myPlan.length > 0 && (
                            <>
                                <SectionTitle title="My call plan" caption="In the order you will visit." />
                                <View style={{ gap: space(1.25) }}>
                                    {data.myPlan.map((d, i) => (
                                        <Brief key={d.DoctorId} doctor={d} index={i} last={i === data.myPlan.length - 1} canPlan={data.canPlan} onPlan={() => setPlanning(d)} onRemove={() => remove(d)} onMove={move} />
                                    ))}
                                </View>
                            </>
                        )}

                        <SectionTitle title="Doctors to meet" caption="In today's planned area, most important first." />
                        {data.planned.filter((d) => !d.callPlan).length ? (
                            <View style={{ gap: space(1.25) }}>
                                {data.planned
                                    .filter((d) => !d.callPlan)
                                    .map((d) => (
                                        <Brief key={d.DoctorId} doctor={d} canPlan={data.canPlan && data.plansEnabled} onPlan={() => setPlanning(d)} />
                                    ))}
                            </View>
                        ) : (
                            <Card>
                                <Empty icon="map" title={data.plan ? 'Everyone here is planned' : 'No planned area'} caption={data.plan ? undefined : 'Set your tour plan to see who to meet.'} />
                            </Card>
                        )}

                        {data.followUpsElsewhere.length > 0 && (
                            <>
                                <SectionTitle title="Follow-ups in other areas" />
                                <View style={{ gap: space(1.25) }}>
                                    {data.followUpsElsewhere.map((d) => (
                                        <Brief key={d.DoctorId} doctor={d} canPlan={data.canPlan && data.plansEnabled} onPlan={() => setPlanning(d)} />
                                    ))}
                                </View>
                            </>
                        )}
                    </>
                )}
            </Loadable>
            {planning ? (
                <PlanSheet
                    doctor={planning}
                    date={date}
                    onClose={() => setPlanning(null)}
                    onSaved={() => {
                        setPlanning(null);
                        state.reload();
                    }}
                />
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    plan: { marginTop: space(1), padding: space(1.25), borderRadius: radius.md, backgroundColor: colors.jadeWash, gap: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: space(1), marginTop: space(1.25) },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4), maxHeight: '90%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
});
