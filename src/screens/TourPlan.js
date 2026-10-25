import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, errorMessage, monthKey } from '../api';
import { titleCase } from '../format';
import { usePermissions } from '../permissions';
import { colors, fonts, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, ListRow, Loadable, MonthSwitcher, Notice, ReasonDialog, Screen, Select, StatGrid, Tag } from '../ui';

export const PLAN_STATUS = {
    NEW: { label: 'Not started', tone: 'info' },
    DRAFT: { label: 'Draft', tone: 'neutral' },
    SUBMITTED: { label: 'Sent for approval', tone: 'warning' },
    APPROVED: { label: 'Approved', tone: 'success' },
    REJECTED: { label: 'Returned for changes', tone: 'error' },
};
const WORKING = 'working';
const OFF = 'non-working';

const pad = (n) => String(n).padStart(2, '0');
const daysOf = (month) => {
    const [y, m] = month.split('-').map(Number);
    return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${month}-${pad(i + 1)}`);
};
const weekday = (key) => new Date(`${key}T00:00:00`).getDay(); // 0 = Sunday
const dayLabel = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
const shift = (month, by) => {
    const [y, m] = month.split('-').map(Number);
    const d = new Date(y, m - 1 + by, 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};
const toPlans = (details = []) =>
    Object.fromEntries(details.map((d) => [String(d.PlanDate).slice(0, 10), { dayType: d.DayType, territory: d.TerritoryId || '', area: d.AreaId || '', territoryName: d.TerritoryName || '', areaName: d.AreaName || '', remarks: d.Remarks || '' }]));
// Same weekday occurrence (2nd Tuesday -> 2nd Tuesday), like the web "copy last month".
const occurrence = (key) => `${weekday(key)}-${Math.floor((Number(key.slice(8)) - 1) / 7)}`;

function DaySheet({ visible, dates, initial, territories, onApply, onClose }) {
    const [dayType, setDayType] = useState(initial?.dayType || WORKING);
    const [territory, setTerritory] = useState(initial?.territory || '');
    const [area, setArea] = useState(initial?.area || '');
    const [remarks, setRemarks] = useState(initial?.remarks || '');
    const [areas, setAreas] = useState([]);

    useEffect(() => {
        if (!territory) return undefined;
        let live = true;
        api.get(`/app/get-areas-by-territory/${territory}`)
            .then((r) => live && setAreas(Array.isArray(r.data) ? r.data : []))
            .catch(() => live && setAreas([]));
        return () => {
            live = false;
        };
    }, [territory]);

    const ok = dayType === OFF || (territory && area);
    const apply = () =>
        onApply({
            dayType,
            territory: dayType === WORKING ? territory : '',
            area: dayType === WORKING ? area : '',
            territoryName: dayType === WORKING ? territories.find((t) => t.TerritoryId === territory)?.TerritoryName || '' : '',
            areaName: dayType === WORKING ? areas.find((a) => a.AreaId === area)?.AreaName || '' : '',
            remarks: remarks.trim(),
        });

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHead}>
                        <Text style={[text.title, { flex: 1 }]}>{dates.length === 1 ? dayLabel(dates[0]) : `${dates.length} days`}</Text>
                        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    <Chips
                        options={[
                            { value: WORKING, label: 'Working' },
                            { value: OFF, label: 'Off / leave' },
                        ]}
                        value={dayType}
                        onChange={setDayType}
                    />
                    {dayType === WORKING && (
                        <>
                            <Select label="Territory" value={territory} options={territories.map((t) => ({ value: t.TerritoryId, label: titleCase(t.TerritoryName) }))} onChange={(v) => { setTerritory(v); setArea(''); }} />
                            <Select label="Area" value={area} options={areas.map((a) => ({ value: a.AreaId, label: titleCase(a.AreaName) }))} onChange={setArea} disabled={!territory} empty="No areas in this territory." />
                        </>
                    )}
                    <Field label="Note (optional)" value={remarks} onChangeText={(v) => setRemarks(v.slice(0, 200))} autoCapitalize="sentences" />
                    <Button title="Apply" icon="check" onPress={apply} disabled={!ok} />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function PlanView({ navigation, userId, month, setMonth }) {
    const state = useLoad(async () => (await api.get('/app/tourplan', { params: { planMonth: `${month}-01`, userId: userId || undefined } })).data, [month, userId], "Couldn't load the tour plan.");
    const territories = useLoad(async () => (await api.get('/app/get-territories')).data?.territories || [], [], '');
    const [edits, setEdits] = useState(null); // plans being edited, by date
    const [picking, setPicking] = useState(null); // dates to edit
    const [selecting, setSelecting] = useState(false);
    const [selected, setSelected] = useState([]);
    const [busy, setBusy] = useState(false);
    const [deciding, setDeciding] = useState(null); // approve | reject

    const plan = state.data?.plan;
    const status = plan?.Status || 'NEW';
    const saved = useMemo(() => toPlans(plan?.details), [plan]);
    const plans = edits || saved;
    const canEdit = !plan || plan.canEdit;
    const days = daysOf(month);
    const working = days.filter((d) => plans[d]?.dayType === WORKING).length;
    const planned = days.filter((d) => plans[d]).length;

    const setDays = (dates, value) => {
        setEdits((current) => ({ ...(current || saved), ...Object.fromEntries(dates.map((d) => [d, value])) }));
        setPicking(null);
        setSelected([]);
        setSelecting(false);
    };

    const copyLast = async () => {
        try {
            const prev = shift(month, -1);
            const r = (await api.get('/app/tourplan', { params: { planMonth: `${prev}-01`, userId: userId || undefined } })).data;
            const source = toPlans(r.plan?.details);
            const byOcc = Object.fromEntries(Object.entries(source).map(([d, p]) => [occurrence(d), p]));
            const copied = Object.fromEntries(days.filter((d) => byOcc[occurrence(d)]).map((d) => [d, byOcc[occurrence(d)]]));
            if (!Object.keys(copied).length) return toast('Last month has no plan to copy.', 'info');
            setEdits({ ...saved, ...copied });
            toast(`Copied ${Object.keys(copied).length} days from last month`);
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    const save = async (submit) => {
        setBusy(true);
        try {
            const details = Object.entries(plans)
                .filter(([date]) => date.startsWith(month))
                .map(([date, p]) => ({ PlanDate: date, DayType: p.dayType, TerritoryId: p.dayType === WORKING ? p.territory || null : null, AreaId: p.dayType === WORKING ? p.area || null : null, Remarks: p.remarks || null }));
            const r = (await api.post('/app/tourplan', { PlanMonth: `${month}-01`, Submit: submit, details })).data;
            toast(r?.data?.message || r?.message || 'Tour plan saved');
            setEdits(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err, "Couldn't save the tour plan."), 'error');
        } finally {
            setBusy(false);
        }
    };

    const decide = async (remarks) => {
        try {
            const r = (await api.post(`/app/tourplan/${plan.TourPlanId}/${deciding}`, { remarks: remarks || null })).data;
            toast(r?.message || 'Done');
            setDeciding(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    const tap = (d) => {
        if (!canEdit) return;
        if (selecting) setSelected((s) => (s.includes(d) ? s.filter((x) => x !== d) : [...s, d]));
        else setPicking([d]);
    };

    return (
        <>
            <MonthSwitcher value={month} onChange={(m) => { setEdits(null); setMonth(m); }} allowFuture />
            <Loadable state={state} rows={6}>
                {() => (
                    <>
                        <View style={styles.tags}>
                            <Tag label={PLAN_STATUS[status]?.label || status} tone={PLAN_STATUS[status]?.tone} />
                            {edits ? <Tag label="Unsaved changes" tone="warning" /> : null}
                        </View>
                        {plan?.ReviewRemarks ? <Notice tone={status === 'REJECTED' ? 'error' : 'info'} title={`Remarks${plan.ReviewedByName ? ` · ${titleCase(plan.ReviewedByName)}` : ''}`}>{plan.ReviewRemarks}</Notice> : null}
                        <StatGrid
                            items={[
                                { icon: 'calendar', label: 'Days planned', value: `${planned}/${days.length}`, tone: planned === days.length ? 'success' : 'warning' },
                                { icon: 'briefcase', label: 'Working days', value: `${working}`, caption: `${planned - working} off` },
                            ]}
                        />
                        {canEdit ? (
                            <View style={styles.toolbar}>
                                <Button title={selecting ? `Set ${selected.length} days` : 'Select days'} icon="check-square" small variant={selecting ? 'primary' : 'outline'} onPress={() => (selecting ? selected.length && setPicking(selected) : setSelecting(true))} />
                                {selecting ? <Button title="Cancel" small variant="ghost" onPress={() => { setSelecting(false); setSelected([]); }} /> : <Button title="Copy last month" icon="copy" small variant="ghost" onPress={copyLast} />}
                            </View>
                        ) : null}
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {days.map((d, i) => {
                                const p = plans[d];
                                const on = selected.includes(d);
                                return (
                                    <Pressable key={d} onPress={() => tap(d)} disabled={!canEdit} style={[styles.day, i > 0 && styles.line, weekday(d) === 0 && { backgroundColor: colors.bg }, on && { backgroundColor: colors.jadeMist }]}>
                                        <Text style={styles.dayLabel}>{dayLabel(d)}</Text>
                                        <Text style={[text.small, { flex: 1, color: p ? colors.ink : colors.inkFaint }]} numberOfLines={1}>
                                            {!p ? 'Not planned' : p.dayType === OFF ? 'Off / leave' : [titleCase(p.territoryName), titleCase(p.areaName)].filter(Boolean).join(' · ')}
                                        </Text>
                                        {canEdit ? <Feather name={selecting ? (on ? 'check-square' : 'square') : 'chevron-right'} size={16} color={colors.inkFaint} /> : null}
                                    </Pressable>
                                );
                            })}
                        </Card>
                        {canEdit ? (
                            <View style={[styles.toolbar, { marginTop: space(2) }]}>
                                <Button title="Save draft" variant="outline" onPress={() => save(false)} busy={busy} style={{ flex: 1 }} />
                                <Button title="Save & confirm" icon="send" onPress={() => save(true)} busy={busy} style={{ flex: 1 }} />
                            </View>
                        ) : null}
                        {plan?.canApprove ? (
                            <View style={[styles.toolbar, { marginTop: space(2) }]}>
                                <Button title="Return" variant="danger" onPress={() => setDeciding('reject')} style={{ flex: 1 }} />
                                <Button title="Approve" icon="check" onPress={() => setDeciding('approve')} style={{ flex: 1 }} />
                            </View>
                        ) : null}
                    </>
                )}
            </Loadable>
            {picking ? <DaySheet visible dates={picking} initial={plans[picking[0]]} territories={territories.data || []} onApply={(v) => setDays(picking, v)} onClose={() => setPicking(null)} /> : null}
            <ReasonDialog
                visible={Boolean(deciding)}
                title={deciding === 'approve' ? 'Approve this tour plan?' : 'Return for changes?'}
                label={deciding === 'approve' ? 'Remarks (optional)' : 'What should change'}
                minLength={deciding === 'reject' ? 5 : 0}
                submitLabel={deciding === 'approve' ? 'Approve' : 'Return'}
                onSubmit={decide}
                onClose={() => setDeciding(null)}
            />
        </>
    );
}

function TeamView({ navigation, month, setMonth }) {
    const state = useLoad(async () => (await api.get('/app/tourplan/team', { params: { planMonth: `${month}-01` } })).data, [month], "Couldn't load team plans.");
    return (
        <>
            <MonthSwitcher value={month} onChange={setMonth} allowFuture />
            <Loadable state={state}>
                {(data) => {
                    const rows = data.plans || data.team || data || [];
                    return rows.length ? (
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {rows.map((r, i) => (
                                <View key={r.UserId} style={i > 0 && styles.line}>
                                    <ListRow
                                        icon="user"
                                        title={titleCase(r.Name)}
                                        caption={`${r.DaysPlanned}/${r.TotalDays} days planned · ${r.WorkingDays} working`}
                                        right={<Tag label={PLAN_STATUS[r.Status]?.label || r.Status} tone={r.canApprove ? 'warning' : PLAN_STATUS[r.Status]?.tone} />}
                                        onPress={() => navigation.push('TourPlan', { userId: r.UserId, name: r.Name, month })}
                                    />
                                </View>
                            ))}
                        </Card>
                    ) : (
                        <Card>
                            <Empty icon="users" title="No team plans" caption="Plans from people who report to you appear here." />
                        </Card>
                    );
                }}
            </Loadable>
        </>
    );
}

// Monthly tour plan: which territory / area each day (or off). Managers also see and approve their team's plans.
export default function TourPlan({ navigation, route }) {
    const permissions = usePermissions();
    const viewingOther = Boolean(route.params?.userId);
    const [tab, setTab] = useState(route.params?.team ? 'team' : 'mine');
    const [month, setMonth] = useState(route.params?.month || monthKey());
    const canTeam = !viewingOther && permissions.has('tourplan.approve');

    return (
        <Screen>
            <Header overline="Tour plan" title={viewingOther ? titleCase(route.params.name) : 'My tour plan'} onBack={() => navigation.goBack()} />
            {canTeam ? (
                <Chips
                    options={[
                        { value: 'mine', label: 'My plan' },
                        { value: 'team', label: 'Team plans' },
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            ) : null}
            {tab === 'team' && canTeam ? <TeamView navigation={navigation} month={month} setMonth={setMonth} /> : <PlanView navigation={navigation} userId={route.params?.userId} month={month} setMonth={setMonth} />}
        </Screen>
    );
}

const styles = StyleSheet.create({
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space(1.5) },
    toolbar: { flexDirection: 'row', alignItems: 'center', gap: space(1), marginBottom: space(1.5) },
    day: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(1.75), paddingVertical: space(1.4) },
    dayLabel: { width: 64, fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft },
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4) },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
});
