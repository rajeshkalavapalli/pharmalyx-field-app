import { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, dateKey, errorMessage, rupees, uploadImage } from '../api';
import { takePhoto } from '../camera';
import { doctorName, titleCase } from '../format';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, KeyValue, ListRow, Loadable, Notice, Screen, SectionTitle, Select, StatGrid, Tag } from '../ui';

const STATUS = {
    REQUESTED: { label: 'Waiting for manager', tone: 'warning' },
    RECOMMENDED: { label: 'Recommended · with head office', tone: 'info' },
    NOT_RECOMMENDED: { label: 'Not recommended · with head office', tone: 'warning' },
    APPROVED: { label: 'Approved · to be paid', tone: 'primary' },
    REJECTED: { label: 'Rejected', tone: 'error' },
    DISBURSED: { label: 'Paid', tone: 'success' },
};
const OUTCOME = { ON_TRACK: { label: 'On track', tone: 'success' }, PARTLY_MET: { label: 'Partly met', tone: 'warning' }, CLAIM_FAILED: { label: 'Claim failed', tone: 'error' }, NOT_STARTED: { label: 'Not started', tone: 'neutral' } };
const METHOD = { BANK: 'Bank transfer', CHEQUE: 'Cheque', UPI: 'UPI', VENDOR: 'Paid to vendor' };
const scoreText = (s) => (!s || s.pct == null ? 'No finished claims yet' : `${s.pct}% met (${s.met} of ${s.claims})`);

function Sheet({ title, onClose, children }) {
    return (
        <Modal visible animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHead}>
                        <Text style={[text.title, { flex: 1 }]}>{title}</Text>
                        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    {children}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function NewRequest({ config, onClose, onSaved }) {
    const [doctor, setDoctor] = useState('');
    const [type, setType] = useState('');
    const [amount, setAmount] = useState('');
    const [purpose, setPurpose] = useState('');
    const [expected, setExpected] = useState('');
    const [period, setPeriod] = useState(config.periods?.[0] || 3);
    const [busy, setBusy] = useState(false);
    const t = config.types.find((x) => x.TypeId === type);
    const ok = doctor && type && Number(amount) > 0 && (!t?.MaxAmount || Number(amount) <= t.MaxAmount) && purpose.trim().length >= 10 && Number(expected) > 0;

    const save = async () => {
        setBusy(true);
        try {
            const r = (await api.post('/app/spend/requests', { DoctorId: doctor, TypeId: type, Amount: Number(amount), Purpose: purpose.trim(), ExpectedBusiness: Number(expected), PeriodMonths: period })).data;
            toast(r?.message || 'Request sent to your manager');
            onSaved();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet title="New spend request" onClose={onClose}>
            {config.ucpmpNote ? <Text style={[text.small, { marginBottom: space(1.5) }]}>{config.ucpmpNote}</Text> : null}
            <Select label="Doctor" value={doctor} options={config.doctors.map((d) => ({ value: d.DoctorId, label: doctorName(d.DoctorName), detail: titleCase(d.TerritoryName) }))} onChange={setDoctor} />
            <Select label="Activity" value={type} options={config.types.map((x) => ({ value: x.TypeId, label: x.TypeName, detail: x.MaxAmount ? `Up to ${rupees(x.MaxAmount)}` : x.Description }))} onChange={setType} />
            <Field label="Amount (₹)" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, '').slice(0, 10))} keyboardType="decimal-pad" error={t?.MaxAmount && Number(amount) > t.MaxAmount ? `At most ${rupees(t.MaxAmount)}` : ''} />
            <Field label="Purpose" value={purpose} onChangeText={(v) => setPurpose(v.slice(0, 500))} multiline autoCapitalize="sentences" hint="At least 10 characters" />
            <Field label="Expected business (₹)" value={expected} onChangeText={(v) => setExpected(v.replace(/[^\d.]/g, '').slice(0, 10))} keyboardType="decimal-pad" />
            <Chips options={(config.periods || [3, 6]).map((p) => ({ value: p, label: `Over ${p} months` }))} value={period} onChange={setPeriod} />
            <Button title="Send to manager" icon="send" onPress={save} busy={busy} disabled={!ok} />
        </Sheet>
    );
}

function ActSheet({ request, mode, methods, onClose, onDone }) {
    const [choice, setChoice] = useState(mode === 'recommend' ? 'RECOMMEND' : mode === 'decide' ? 'APPROVED' : 'BANK');
    const [note, setNote] = useState('');
    const [compliance, setCompliance] = useState(false);
    const [amount, setAmount] = useState(String(request.Amount));
    const [reference, setReference] = useState('');
    const [photo, setPhoto] = useState(null);
    const [busy, setBusy] = useState(false);

    const ok = mode === 'recommend' ? note.trim().length >= 3 : mode === 'decide' ? note.trim().length >= 3 && (choice !== 'APPROVED' || compliance) : Number(amount) > 0 && photo;

    const snap = async () => {
        try {
            const shot = await takePhoto();
            if (shot) setPhoto(shot);
        } catch (err) {
            Alert.alert('Camera', err.message);
        }
    };

    const save = async () => {
        setBusy(true);
        try {
            let r;
            if (mode === 'recommend') r = (await api.post(`/app/spend/requests/${request.RequestId}/recommend`, { Recommendation: choice, Note: note.trim() })).data;
            else if (mode === 'decide') r = (await api.post(`/app/spend/requests/${request.RequestId}/decide`, { Decision: choice, ComplianceConfirmed: compliance, Note: note.trim() })).data;
            else {
                const { docId } = await uploadImage('/app/spend/documents', photo.uri, photo.mimeType);
                r = (await api.post(`/app/spend/requests/${request.RequestId}/disburse`, { Amount: Number(amount), DisbursedDate: dateKey(), Method: choice, Reference: reference.trim() || null, DocumentId: docId })).data;
            }
            toast(r?.message || 'Saved');
            onDone();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet title={mode === 'recommend' ? 'Your recommendation' : mode === 'decide' ? 'Head office decision' : 'Record payment'} onClose={onClose}>
            <Text style={[text.small, { marginBottom: space(1.5) }]}>{`${request.RequestNumber} · ${doctorName(request.DoctorName)} · ${rupees(request.Amount)}`}</Text>
            {mode === 'recommend' && (
                <Chips
                    options={[
                        { value: 'RECOMMEND', label: 'Recommend' },
                        { value: 'DO_NOT_RECOMMEND', label: 'Do not recommend' },
                    ]}
                    value={choice}
                    onChange={setChoice}
                />
            )}
            {mode === 'decide' && (
                <>
                    <Chips
                        options={[
                            { value: 'APPROVED', label: 'Approve' },
                            { value: 'REJECTED', label: 'Reject' },
                        ]}
                        value={choice}
                        onChange={setChoice}
                    />
                    {choice === 'APPROVED' ? (
                        <Pressable onPress={() => setCompliance((c) => !c)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: compliance }}>
                            <Feather name={compliance ? 'check-square' : 'square'} size={20} color={compliance ? colors.jade : colors.inkMuted} />
                            <Text style={[text.small, { flex: 1 }]}>The activity is allowed under company policy and UCPMP 2024, and is documented.</Text>
                        </Pressable>
                    ) : null}
                </>
            )}
            {mode === 'disburse' ? (
                <>
                    <Field label="Amount paid (₹)" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, '').slice(0, 10))} keyboardType="decimal-pad" />
                    <Chips options={(methods || Object.keys(METHOD)).map((m) => ({ value: m, label: METHOD[m] || m }))} value={choice} onChange={setChoice} />
                    <Field label="Reference (optional)" value={reference} onChangeText={(v) => setReference(v.slice(0, 100))} autoCapitalize="characters" />
                    {photo ? <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" /> : null}
                    <Button title={photo ? 'Retake document photo' : 'Photo of invoice / receipt *'} icon="camera" variant="outline" small onPress={snap} style={{ marginBottom: space(1.5) }} />
                </>
            ) : (
                <Field label={mode === 'decide' && choice === 'APPROVED' ? 'Compliance note' : 'Note'} value={note} onChangeText={(v) => setNote(v.slice(0, 500))} multiline autoCapitalize="sentences" />
            )}
            <Button title="Save" icon="check" onPress={save} busy={busy} disabled={!ok} />
        </Sheet>
    );
}

function RequestCard({ r, onAct }) {
    const st = STATUS[r.Status];
    const out = r.outcome ? OUTCOME[r.outcome.status] : null;
    return (
        <Card style={{ padding: space(1.5) }}>
            <View style={styles.top}>
                <Text style={[text.subtitle, { flex: 1 }]} numberOfLines={1}>
                    {doctorName(r.DoctorName)}
                </Text>
                <Text style={text.subtitle}>{rupees(r.Amount)}</Text>
            </View>
            <Text style={text.small}>{[r.RequestNumber, r.TypeName, titleCase(r.UserName), titleCase(r.TerritoryName)].filter(Boolean).join(' · ')}</Text>
            <View style={styles.tags}>
                {st ? <Tag label={st.label} tone={st.tone} /> : null}
                {out ? <Tag label={out.label} tone={out.tone} /> : null}
                {r.priorFailed?.length ? <Tag label={`${r.priorFailed.length} earlier claim(s) failed`} tone="error" /> : null}
            </View>
            <Text style={text.body}>{r.Purpose}</Text>
            <Text style={[text.small, { marginTop: 4 }]}>{`Expects ${rupees(r.ExpectedBusiness)} over ${r.PeriodMonths} months · requester: ${scoreText(r.requesterScore)}`}</Text>
            {r.ManagerNote ? <Text style={text.small}>{`${titleCase(r.ManagerName)} (${r.ManagerRecommendation === 'RECOMMEND' ? 'recommends' : 'does not recommend'}): “${r.ManagerNote}”`}</Text> : null}
            {r.DecisionNote ? <Text style={text.small}>{`Head office${r.DecidedByName ? ` · ${titleCase(r.DecidedByName)}` : ''}: “${r.DecisionNote}”`}</Text> : null}
            {r.DisbursedAmount != null ? <Text style={text.small}>{`Paid ${rupees(r.DisbursedAmount)} on ${r.DisbursedDate} by ${METHOD[r.DisbursementMethod] || r.DisbursementMethod}`}</Text> : null}
            {r.outcome?.actual != null ? <Text style={text.small}>{`Business so far ${rupees(r.outcome.actual)}${r.outcome.pct != null ? ` (${r.outcome.pct}%)` : ''}`}</Text> : null}
            <View style={styles.actions}>
                {r.can?.recommend ? <Button title="Recommend" small onPress={() => onAct(r, 'recommend')} style={{ flex: 1 }} /> : null}
                {r.can?.decide ? <Button title="Decide" small onPress={() => onAct(r, 'decide')} style={{ flex: 1 }} /> : null}
                {r.can?.disburse ? <Button title="Record payment" small icon="credit-card" onPress={() => onAct(r, 'disburse')} style={{ flex: 1 }} /> : null}
            </View>
        </Card>
    );
}

// Doctor spend (sponsorships, CMEs…): request → manager recommends → head office decides → paid → business tracked.
export default function DoctorSpend({ navigation }) {
    const config = useLoad(async () => (await api.get('/app/spend/config')).data, [], "Couldn't load doctor spend.");
    const [tab, setTab] = useState('requests');
    const [filter, setFilter] = useState('action');
    const requests = useLoad(async () => (await api.get('/app/spend/requests', { params: { filter } })).data, [filter], "Couldn't load requests.");
    const reports = useLoad(async () => (tab === 'reports' ? (await api.get('/app/spend/reports')).data : null), [tab], "Couldn't load reports.");
    const [adding, setAdding] = useState(false);
    const [acting, setActing] = useState(null);

    return (
        <Screen refreshControl={requests.refreshControl}>
            <Header overline="Doctor engagement" title="Doctor spend" onBack={() => navigation.goBack()} right={config.data?.canRequest ? <Button title="New" icon="plus" small onPress={() => setAdding(true)} /> : null} />
            <Chips
                options={[
                    { value: 'requests', label: 'Requests' },
                    { value: 'reports', label: 'Results' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {tab === 'requests' ? (
                <>
                    <Chips
                        options={[
                            { value: 'action', label: 'Needs me' },
                            { value: 'mine', label: 'Mine' },
                            { value: 'open', label: 'Open' },
                            { value: 'paid', label: 'Paid' },
                            { value: 'all', label: 'All' },
                        ]}
                        value={filter}
                        onChange={setFilter}
                    />
                    <Loadable state={requests}>
                        {(data) =>
                            data.requests.length ? (
                                <View style={{ gap: space(1.25) }}>
                                    {data.requests.map((r) => (
                                        <RequestCard key={r.RequestId} r={r} onAct={(row, mode) => setActing({ row, mode })} />
                                    ))}
                                </View>
                            ) : (
                                <Card>
                                    <Empty icon="dollar-sign" title="Nothing here" caption={filter === 'action' ? 'No requests waiting for you.' : 'Requests appear here.'} />
                                </Card>
                            )
                        }
                    </Loadable>
                </>
            ) : (
                <Loadable state={reports}>
                    {(data) =>
                        data ? (
                            <>
                                <StatGrid
                                    items={[
                                        { icon: 'credit-card', label: 'Paid', value: rupees(data.summary.paid), caption: `${data.summary.paidCount} requests · ${data.summary.waiting} waiting` },
                                        { icon: 'trending-up', label: 'Finished claims', value: `${data.summary.onTrack}/${data.summary.finals}`, caption: `${data.summary.partly} partly · ${data.summary.failed} failed`, tone: data.summary.failed ? 'warning' : 'success' },
                                    ]}
                                />
                                <Card style={{ marginBottom: space(1.5) }}>
                                    <KeyValue rows={[['Expected (finished)', rupees(data.summary.expected)], ['Actual (finished)', rupees(data.summary.actual)], ['In progress', data.summary.inProgress]]} />
                                </Card>
                                {[
                                    ['By doctor', data.byDoctor],
                                    ['By representative', data.byMr],
                                    ['By manager', data.byManager],
                                ].map(([title, groups]) =>
                                    groups?.length ? (
                                        <View key={title}>
                                            <SectionTitle title={title} />
                                            <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.5) }}>
                                                {groups.slice(0, 10).map((g, i) => (
                                                    <View key={g.id} style={i > 0 && styles.line}>
                                                        <ListRow title={title === 'By doctor' ? doctorName(g.name) : titleCase(g.name)} caption={[g.paid != null && `paid ${rupees(g.paid)}`, g.requests != null && `${g.requests} requests`, g.score && scoreText(g.score)].filter(Boolean).join(' · ')} chevron={false} />
                                                    </View>
                                                ))}
                                            </Card>
                                        </View>
                                    ) : null
                                )}
                            </>
                        ) : null
                    }
                </Loadable>
            )}
            {config.data?.headOffice === false && !config.data?.canRequest && !config.data?.canRecommend ? <Notice tone="info">You can view doctor spend for your team.</Notice> : null}
            {adding && config.data ? (
                <NewRequest
                    config={config.data}
                    onClose={() => setAdding(false)}
                    onSaved={() => {
                        setAdding(false);
                        requests.reload();
                    }}
                />
            ) : null}
            {acting ? (
                <ActSheet
                    request={acting.row}
                    mode={acting.mode}
                    methods={config.data?.methods}
                    onClose={() => setActing(null)}
                    onDone={() => {
                        setActing(null);
                        requests.reload();
                    }}
                />
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
    actions: { flexDirection: 'row', gap: space(1), marginTop: space(1.25) },
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
    check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: space(1.5) },
    photo: { width: '100%', height: 160, borderRadius: radius.md, marginBottom: space(1), backgroundColor: colors.lineSoft },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4), maxHeight: '92%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
});
