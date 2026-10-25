import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, dateKey, errorMessage, monthKey } from '../api';
import { titleCase } from '../format';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, Loadable, MonthSwitcher, ReasonDialog, Screen, Select, StatGrid, Tag } from '../ui';

const STATUS = { PENDING: { label: 'Pending review', tone: 'warning' }, APPROVED: { label: 'Approved', tone: 'success' }, REJECTED: { label: 'Rejected', tone: 'error' } };
const TYPES = [
    { value: 'Territory Change', label: 'Territory change' },
    { value: 'Area Change', label: 'Area change' },
];
const BACK = [0, 1, 2, 3].map((n) => ({ value: n, label: n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago` }));
const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return dateKey(d);
};
const dayLabel = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

function NewDeviation({ visible, onClose, onSaved }) {
    const [back, setBack] = useState(0);
    const [type, setType] = useState('Area Change');
    const [territory, setTerritory] = useState('');
    const [area, setArea] = useState('');
    const [reason, setReason] = useState('');
    const [remarks, setRemarks] = useState('');
    const [busy, setBusy] = useState(false);
    const [territories, setTerritories] = useState([]);
    const [areas, setAreas] = useState([]);

    useEffect(() => {
        api.get('/app/get-territories')
            .then((r) => setTerritories(r.data?.territories || []))
            .catch(() => setTerritories([]));
    }, []);
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

    const ok = territory && (type === 'Territory Change' || area) && reason.trim().length > 0;
    const save = async () => {
        setBusy(true);
        try {
            const r = (await api.post('/app/deviations', { DeviationDate: daysAgo(back), DeviationType: type, ActualTerritoryId: territory, ActualAreaId: area || null, Reason: reason.trim(), Remarks: remarks.trim() || null })).data;
            toast(r?.message || 'Deviation sent for review');
            onSaved();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHead}>
                        <Text style={[text.title, { flex: 1 }]}>Worked outside the plan</Text>
                        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    <Chips options={BACK} value={back} onChange={setBack} />
                    <Chips options={TYPES} value={type} onChange={setType} />
                    <Select label="Where you actually worked: territory" value={territory} options={territories.map((t) => ({ value: t.TerritoryId, label: titleCase(t.TerritoryName) }))} onChange={(v) => { setTerritory(v); setArea(''); }} />
                    <Select label={type === 'Area Change' ? 'Area' : 'Area (optional)'} value={area} options={areas.map((a) => ({ value: a.AreaId, label: titleCase(a.AreaName) }))} onChange={setArea} disabled={!territory} />
                    <Field label="Reason *" value={reason} onChangeText={(v) => setReason(v.slice(0, 200))} autoCapitalize="sentences" placeholder="e.g. Doctor camp in the next town" />
                    <Field label="Remarks (optional)" value={remarks} onChangeText={(v) => setRemarks(v.slice(0, 1000))} multiline autoCapitalize="sentences" />
                    <Button title="Send for review" icon="send" onPress={save} busy={busy} disabled={!ok} />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// Days worked outside the tour plan: request, see the decision; managers approve / reject.
export default function Deviations({ navigation }) {
    const [month, setMonth] = useState(monthKey());
    const [status, setStatus] = useState('');
    const state = useLoad(async () => (await api.get('/app/deviations', { params: { month: `${month}-01`, status: status || undefined } })).data, [month, status], "Couldn't load deviations.");
    const [adding, setAdding] = useState(false);
    const [deciding, setDeciding] = useState(null); // { row, action }

    const decide = async (remarks) => {
        try {
            const r = (await api.post(`/app/deviations/${deciding.row.DeviationId}/${deciding.action}`, { remarks: remarks || null })).data;
            toast(r?.message || 'Done');
            setDeciding(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Field operations" title="Plan deviation" onBack={() => navigation.goBack()} right={<Button title="New" icon="plus" small onPress={() => setAdding(true)} />} />
            <MonthSwitcher value={month} onChange={setMonth} />
            <Chips
                options={[
                    { value: '', label: 'All' },
                    { value: 'PENDING', label: 'Pending' },
                    { value: 'APPROVED', label: 'Approved' },
                    { value: 'REJECTED', label: 'Rejected' },
                ]}
                value={status}
                onChange={setStatus}
            />
            <Loadable state={state}>
                {(data) => (
                    <>
                        <StatGrid
                            items={[
                                { icon: 'shuffle', label: 'This month', value: `${data.summary.total}`, caption: `${data.summary.approved} approved` },
                                { icon: 'clock', label: 'Pending', value: `${data.summary.pending}`, caption: `${data.summary.rejected} rejected`, tone: data.summary.pending ? 'warning' : 'brand' },
                            ]}
                        />
                        {data.deviations.length ? (
                            <View style={{ gap: space(1.25) }}>
                                {data.deviations.map((d) => (
                                    <Card key={d.DeviationId} style={{ padding: space(1.5) }}>
                                        <View style={styles.top}>
                                            <Text style={[text.subtitle, { flex: 1 }]}>{titleCase(d.UserName)}</Text>
                                            <Tag label={STATUS[d.Status]?.label} tone={STATUS[d.Status]?.tone} />
                                        </View>
                                        <Text style={text.small}>{`${dayLabel(d.DeviationDate)} · ${d.DeviationType} · ${d.Source}`}</Text>
                                        <Text style={[text.body, { marginTop: 6 }]}>
                                            {`${titleCase([d.PlannedTerritoryName, d.PlannedAreaName].filter(Boolean).join(' / ')) || 'No plan'} → ${titleCase([d.ActualTerritoryName, d.ActualAreaName].filter(Boolean).join(' / ')) || '—'}`}
                                        </Text>
                                        {d.Reason ? <Text style={text.small}>“{d.Reason}”</Text> : null}
                                        {d.ReviewRemarks ? <Text style={[text.small, { marginTop: 4 }]}>{`${titleCase(d.ReviewedByName) || 'Manager'}: “${d.ReviewRemarks}”`}</Text> : null}
                                        {d.canReview ? (
                                            <View style={styles.actions}>
                                                <Button title="Reject" small variant="danger" onPress={() => setDeciding({ row: d, action: 'reject' })} style={{ flex: 1 }} />
                                                <Button title="Approve" small icon="check" onPress={() => setDeciding({ row: d, action: 'approve' })} style={{ flex: 1 }} />
                                            </View>
                                        ) : null}
                                    </Card>
                                ))}
                            </View>
                        ) : (
                            <Card>
                                <Empty icon="shuffle" title="No deviations" caption="If you work in a different territory or area than planned, tell your manager here." />
                                <Button title="Request a deviation" icon="plus" variant="outline" onPress={() => setAdding(true)} />
                            </Card>
                        )}
                    </>
                )}
            </Loadable>
            {adding ? (
                <NewDeviation
                    visible
                    onClose={() => setAdding(false)}
                    onSaved={() => {
                        setAdding(false);
                        state.reload();
                    }}
                />
            ) : null}
            <ReasonDialog
                visible={Boolean(deciding)}
                title={deciding?.action === 'approve' ? 'Approve this deviation?' : 'Reject this deviation?'}
                label={deciding?.action === 'approve' ? 'Remarks (optional)' : 'Reason'}
                minLength={deciding?.action === 'reject' ? 5 : 0}
                submitLabel={deciding?.action === 'approve' ? 'Approve' : 'Reject'}
                onSubmit={decide}
                onClose={() => setDeciding(null)}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    actions: { flexDirection: 'row', gap: space(1), marginTop: space(1.25) },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4), maxHeight: '90%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
});
