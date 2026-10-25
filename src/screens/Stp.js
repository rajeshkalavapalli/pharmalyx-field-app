import { useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, errorMessage, monthKey } from '../api';
import { titleCase } from '../format';
import { usePermissions } from '../permissions';
import { colors, fonts, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Header, ListRow, Loadable, Notice, ReasonDialog, Screen, SectionTitle, Select, Tag } from '../ui';

const STATUS = { DRAFT: { label: 'Draft', tone: 'neutral' }, SUBMITTED: { label: 'With head office', tone: 'warning' }, RETURNED: { label: 'Returned', tone: 'error' }, APPROVED: { label: 'Approved', tone: 'success' } };
const PATCH_LABEL = { HQ: 'HQ', EX_HQ: 'Ex-HQ', OUTSTATION: 'Outstation' };
const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const low = (v) => String(v || '').toLowerCase();

function DayPicker({ slot, patches, onPick, onClose }) {
    return (
        <Modal visible animationType="slide" transparent onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} />
            <View style={styles.sheet}>
                <View style={styles.sheetHead}>
                    <Text style={[text.title, { flex: 1 }]}>{`Week ${slot.week} · ${WEEKDAYS[slot.weekday - 1]}`}</Text>
                    <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                        <Feather name="x" size={20} color={colors.inkMuted} />
                    </Pressable>
                </View>
                <Card style={{ padding: 0, overflow: 'hidden' }}>
                    <ListRow icon="moon" tone="neutral" title="No field work" chevron={false} onPress={() => onPick(null)} />
                    {patches.map((p) => (
                        <View key={p.AreaId} style={styles.line}>
                            <ListRow icon="map" title={titleCase(p.AreaName)} caption={PATCH_LABEL[p.PatchType]} chevron={false} onPress={() => onPick(p.AreaId)} />
                        </View>
                    ))}
                </Card>
            </View>
        </Modal>
    );
}

function PlanEditor({ data, userId, onDone }) {
    const source = data.open || data.approved;
    const [cycle, setCycle] = useState(source?.CycleWeeks || 4);
    const [patches, setPatches] = useState(() => (source?.patches || []).map((p) => ({ AreaId: p.AreaId, AreaName: p.AreaName, PatchType: p.PatchType })));
    const [days, setDays] = useState(() => Object.fromEntries((source?.days || []).map((d) => [`${d.CycleWeek}:${d.Weekday}`, d.AreaId])));
    const [newArea, setNewArea] = useState('');
    const [newType, setNewType] = useState('HQ');
    const [slot, setSlot] = useState(null);
    const [busy, setBusy] = useState(false);
    const nameOf = useMemo(() => new Map(patches.map((p) => [low(p.AreaId), p])), [patches]);

    const addPatch = () => {
        const area = data.areas.find((a) => a.AreaId === newArea);
        if (!area) return;
        setPatches((p) => [...p, { AreaId: area.AreaId, AreaName: area.AreaName, PatchType: newType }]);
        setNewArea('');
    };
    const removePatch = (areaId) => {
        setPatches((p) => p.filter((x) => low(x.AreaId) !== low(areaId)));
        setDays((d) => Object.fromEntries(Object.entries(d).filter(([, a]) => low(a) !== low(areaId))));
    };

    const save = async (submitAfter) => {
        setBusy(true);
        try {
            const payload = {
                UserId: userId || undefined,
                CycleWeeks: cycle,
                Patches: patches.map((p) => ({ AreaId: p.AreaId, PatchType: p.PatchType })),
                Days: Object.entries(days)
                    .filter(([key, area]) => area && Number(key.split(':')[0]) <= cycle)
                    .map(([key, area]) => ({ CycleWeek: Number(key.split(':')[0]), Weekday: Number(key.split(':')[1]), AreaId: area })),
            };
            const r = (await api.put('/app/stp', payload)).data;
            if (submitAfter) {
                const stpId = r?.StpId || r?.stpId || data.open?.StpId;
                const s = (await api.post(`/app/stp/${stpId}/submit`)).data;
                toast(s?.message || 'Sent to head office');
            } else toast(r?.message || 'Draft saved');
            onDone();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const free = data.areas.filter((a) => !nameOf.has(low(a.AreaId)));

    return (
        <>
            <SectionTitle title="Cycle" caption="How many weeks before the pattern repeats." />
            <Chips options={[1, 2, 3, 4].map((n) => ({ value: n, label: `${n} week${n > 1 ? 's' : ''}` }))} value={cycle} onChange={setCycle} />

            <SectionTitle title="Patches" caption="Areas of your territory you cover, and how far they are." />
            <Card style={{ marginBottom: space(1.5) }}>
                {patches.map((p) => (
                    <View key={p.AreaId} style={styles.patch}>
                        <Text style={[text.subtitle, { flex: 1 }]}>{titleCase(p.AreaName)}</Text>
                        <Tag label={PATCH_LABEL[p.PatchType]} tone={p.PatchType === 'OUTSTATION' ? 'warning' : p.PatchType === 'EX_HQ' ? 'info' : 'primary'} />
                        <Pressable onPress={() => removePatch(p.AreaId)} hitSlop={8} accessibilityLabel={`Remove ${p.AreaName}`}>
                            <Feather name="trash-2" size={16} color={colors.errorDark} />
                        </Pressable>
                    </View>
                ))}
                {free.length ? (
                    <>
                        <Select label="Add an area" value={newArea} options={free.map((a) => ({ value: a.AreaId, label: titleCase(a.AreaName), detail: titleCase(a.TerritoryName) }))} onChange={setNewArea} />
                        <Chips options={Object.entries(PATCH_LABEL).map(([value, label]) => ({ value, label }))} value={newType} onChange={setNewType} />
                        <Button title="Add patch" icon="plus" small variant="outline" onPress={addPatch} disabled={!newArea} />
                    </>
                ) : (
                    <Text style={text.small}>{data.areas.length ? 'All your areas are patches.' : 'No areas are mapped to this territory yet.'}</Text>
                )}
            </Card>

            <SectionTitle title="Week by week" caption="Tap a day to choose the patch." />
            {Array.from({ length: cycle }, (_, w) => w + 1).map((week) => (
                <Card key={week} style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.25) }}>
                    <Text style={styles.weekHead}>Week {week}</Text>
                    {WEEKDAYS.map((label, i) => {
                        const area = days[`${week}:${i + 1}`];
                        const p = area ? nameOf.get(low(area)) : null;
                        return (
                            <Pressable key={label} onPress={() => setSlot({ week, weekday: i + 1 })} style={[styles.dayRow, styles.line]}>
                                <Text style={styles.dayLabel}>{label}</Text>
                                <Text style={[text.small, { flex: 1, color: p ? colors.ink : colors.inkFaint }]}>{p ? `${titleCase(p.AreaName)} · ${PATCH_LABEL[p.PatchType]}` : 'No field work'}</Text>
                                <Feather name="chevron-right" size={16} color={colors.inkFaint} />
                            </Pressable>
                        );
                    })}
                </Card>
            ))}
            <View style={styles.actions}>
                <Button title="Save draft" variant="outline" onPress={() => save(false)} busy={busy} style={{ flex: 1 }} />
                <Button title="Send to head office" icon="send" onPress={() => save(true)} busy={busy} disabled={!patches.length} style={{ flex: 1 }} />
            </View>
            {slot ? (
                <DayPicker
                    slot={slot}
                    patches={patches}
                    onClose={() => setSlot(null)}
                    onPick={(areaId) => {
                        setDays((d) => ({ ...d, [`${slot.week}:${slot.weekday}`]: areaId }));
                        setSlot(null);
                    }}
                />
            ) : null}
        </>
    );
}

function PlanView({ stp, title }) {
    const nameOf = new Map((stp.patches || []).map((p) => [low(p.AreaId), p]));
    return (
        <>
            <SectionTitle title={title} caption={`${stp.CycleWeeks}-week cycle · ${stp.patches.length} patches`} />
            {Array.from({ length: stp.CycleWeeks }, (_, w) => w + 1).map((week) => (
                <Card key={week} style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.25) }}>
                    <Text style={styles.weekHead}>Week {week}</Text>
                    {WEEKDAYS.map((label, i) => {
                        const day = stp.days.find((d) => d.CycleWeek === week && d.Weekday === i + 1);
                        const p = day?.AreaId ? nameOf.get(low(day.AreaId)) : null;
                        return (
                            <View key={label} style={[styles.dayRow, styles.line]}>
                                <Text style={styles.dayLabel}>{label}</Text>
                                <Text style={[text.small, { flex: 1, color: p ? colors.ink : colors.inkFaint }]}>{p ? `${titleCase(p.AreaName)} · ${PATCH_LABEL[p.PatchType]}${day.overnight ? ' · overnight' : ''}` : 'No field work'}</Text>
                            </View>
                        );
                    })}
                </Card>
            ))}
        </>
    );
}

// Standard tour plan: the repeating weekly pattern of patches. Head office approves; the month is generated from it.
export default function Stp({ navigation, route }) {
    const permissions = usePermissions();
    const [userId, setUserId] = useState(route.params?.userId || '');
    const [tab, setTab] = useState('plan');
    const state = useLoad(async () => (await api.get('/app/stp', { params: { userId: userId || undefined } })).data, [userId], "Couldn't load the standard tour plan.");
    const submitted = useLoad(async () => (permissions.has('stp.approve') ? (await api.get('/app/stp/submitted')).data.plans : []), [permissions.codes ? 1 : 0], '');
    const [editing, setEditing] = useState(false);
    const [deciding, setDeciding] = useState(null);

    const act = async (fn, done) => {
        try {
            const r = await fn();
            toast(r?.data?.message || done);
            state.reload();
            submitted.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    const decide = async (remarks) => {
        await act(() => api.post(`/app/stp/${state.data.open.StpId}/${deciding}`, { Remarks: remarks || null }), deciding === 'approve' ? 'Approved' : 'Sent back');
        setDeciding(null);
    };

    const data = state.data;
    const open = data?.open;
    const own = !userId;
    const teamOptions = data ? [{ value: '', label: 'Me' }, ...(data.team || []).map((t) => ({ value: t.UserId, label: titleCase(t.Name) }))] : [];

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Standard tour plan" title={data?.user ? titleCase(data.user.Name) : 'STP'} onBack={() => navigation.goBack()} />
            {permissions.has('stp.approve') ? (
                <Chips
                    options={[
                        { value: 'plan', label: 'Plan' },
                        { value: 'queue', label: `To approve${submitted.data?.length ? ` ${submitted.data.length}` : ''}` },
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            ) : null}

            {tab === 'queue' ? (
                <Loadable state={submitted}>
                    {(plans) =>
                        plans.length ? (
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {plans.map((p, i) => (
                                    <View key={p.StpId} style={i > 0 && styles.line}>
                                        <ListRow icon="repeat" title={titleCase(p.UserName)} caption={`${p.CycleWeeks}-week cycle · ${p.Patches} patches · manager ${titleCase(p.ManagerName) || '—'}`} onPress={() => { setUserId(p.UserId); setTab('plan'); }} />
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
                    {(data?.team || []).length ? <Select label="Plan of" value={userId} options={teamOptions} onChange={(v) => { setEditing(false); setUserId(v); }} icon="user" /> : null}
                    <Loadable state={state}>
                        {() =>
                            editing ? (
                                <PlanEditor data={data} userId={userId} onDone={() => { setEditing(false); state.reload(); }} />
                            ) : (
                                <>
                                    {open ? (
                                        <View style={styles.tags}>
                                            <Tag label={STATUS[open.Status]?.label} tone={STATUS[open.Status]?.tone} />
                                            {data.approved ? <Tag label="An approved plan is in use" tone="success" /> : null}
                                        </View>
                                    ) : null}
                                    {open?.ReviewRemarks ? <Notice tone={open.Status === 'RETURNED' ? 'error' : 'info'} title={`Head office${open.ReviewedByName ? ` · ${titleCase(open.ReviewedByName)}` : ''}`}>{open.ReviewRemarks}</Notice> : null}
                                    {!open && !data.approved ? (
                                        <Card>
                                            <Empty icon="repeat" title="No standard tour plan yet" caption="Set the patches you cover and your weekly pattern. Head office approves it, then each month's tour plan is generated from it." />
                                        </Card>
                                    ) : null}
                                    {open ? <PlanView stp={open} title={open.Status === 'SUBMITTED' ? 'Sent for approval' : 'Working copy'} /> : null}
                                    {data.approved && !open ? <PlanView stp={data.approved} title="Approved plan" /> : null}
                                    <View style={[styles.actions, { flexWrap: 'wrap' }]}>
                                        {data.canEdit ? <Button title={open || data.approved ? 'Edit plan' : 'Create plan'} icon="edit-2" onPress={() => setEditing(true)} style={{ flex: 1 }} /> : null}
                                        {own && open?.Status === 'SUBMITTED' ? <Button title="Withdraw" variant="outline" onPress={() => act(() => api.post(`/app/stp/${open.StpId}/withdraw`), 'Withdrawn')} style={{ flex: 1 }} /> : null}
                                        {own && data.approved && permissions.has('stp.create') ? (
                                            <Button title={`Generate ${new Date().toLocaleDateString('en-IN', { month: 'long' })} tour plan`} icon="calendar" variant="outline" onPress={() => act(() => api.post('/app/stp/generate', { Month: `${monthKey()}-01` }), 'Tour plan generated')} style={{ flex: 1 }} />
                                        ) : null}
                                    </View>
                                    {data.canApprove ? (
                                        <View style={styles.actions}>
                                            <Button title="Send back" variant="danger" onPress={() => setDeciding('return')} style={{ flex: 1 }} />
                                            <Button title="Approve" icon="check" onPress={() => setDeciding('approve')} style={{ flex: 1 }} />
                                        </View>
                                    ) : null}
                                </>
                            )
                        }
                    </Loadable>
                </>
            )}
            <ReasonDialog
                visible={Boolean(deciding)}
                title={deciding === 'approve' ? 'Approve this plan?' : 'Send back with remarks?'}
                label={deciding === 'approve' ? 'Remarks (optional)' : 'What needs to change'}
                minLength={deciding === 'return' ? 10 : 0}
                submitLabel={deciding === 'approve' ? 'Approve' : 'Send back'}
                onSubmit={decide}
                onClose={() => setDeciding(null)}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space(1.5) },
    patch: { flexDirection: 'row', alignItems: 'center', gap: space(1), paddingBottom: space(1.25), marginBottom: space(1.25), borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
    weekHead: { fontFamily: fonts.bold, fontSize: 12, letterSpacing: 1, color: colors.jadeDark, paddingHorizontal: space(1.75), paddingVertical: space(1), backgroundColor: colors.jadeWash },
    dayRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(1.75), paddingVertical: space(1.25) },
    dayLabel: { width: 40, fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft },
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
    actions: { flexDirection: 'row', gap: space(1), marginTop: space(1.5) },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4), maxHeight: '80%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
});

