import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';

import { api, errorMessage } from '../api';
import { titleCase } from '../format';
import { getFix } from '../location';
import { biometricProof } from '../biometric';
import { toast } from '../toast';
import { colors, fonts, space, text } from '../theme';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, Loadable, Notice, ProgressBar, Screen, SectionTitle, Tag } from '../ui';

// Joint audits for the senior on a joint day (only the auditor sees which doctors), and the team's Field Truth Scores.

const REASON = { NOT_VERIFIED: 'Not verified', NO_RX: 'Visits, no Rx', SHORT_VISITS: 'Short visits', NEW_DOCTOR: 'New doctor', RANDOM: 'Random pick' };
const RESULT = {
    PASSED: { label: 'Doctor met', tone: 'success' },
    DOCTOR_NOT_FOUND: { label: 'Doctor not found', tone: 'error' },
    CLINIC_NOT_FOUND: { label: 'Clinic not found', tone: 'error' },
    NOT_RECOGNISED: { label: "Didn't know the rep", tone: 'error' },
};
const BAND = { TRUSTED: { label: 'Trusted', tone: 'success' }, WATCH: { label: 'Watch', tone: 'warning' }, RISK: { label: 'Risk', tone: 'error' }, NO_DATA: { label: 'No visits', tone: 'neutral' } };

function AuditCard({ audit, onDone }) {
    const [busy, setBusy] = useState(false);
    const [result, setResult] = useState('');
    const [notes, setNotes] = useState('');
    const checkedIn = Boolean(audit.checkInAt);
    const done = audit.status !== 'ASSIGNED';

    const checkIn = async () => {
        setBusy(true);
        try {
            // Fingerprint / face first (on phones that have it), then the clinic location.
            let proof = { available: false };
            try {
                proof = await biometricProof();
            } catch {
                throw new Error('Fingerprint check cancelled. The audit needs your fingerprint or face to confirm it is you.');
            }
            const fix = await getFix();
            if (fix.status !== 'CAPTURED') throw new Error("Couldn't get your location. Turn on location and try again.");
            const r = (await api.post(`/app/audits/${audit.auditId}/check-in`, { Location: fix, DeviceId: proof.deviceId, BiometricSecret: proof.secret })).data;
            if (proof.changed) Alert.alert('Fingerprints changed', 'Fingerprints on this phone were changed, so the check was set up again. Head office can see this.');
            toast(r.message || 'Checked in');
            onDone();
        } catch (err) {
            Alert.alert('Check in', err.response ? errorMessage(err) : err.message);
        } finally {
            setBusy(false);
        }
    };

    const save = async () => {
        setBusy(true);
        try {
            const r = (await api.post(`/app/audits/${audit.auditId}/result`, { Result: result, Notes: notes.trim() || null })).data;
            toast(r.message || 'Saved');
            onDone();
        } catch (err) {
            Alert.alert('Audit', errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Card style={{ marginBottom: space(1.5) }}>
            <View style={styles.top}>
                <View style={{ flex: 1 }}>
                    <Text style={styles.doctor}>Dr. {titleCase(audit.doctorName)}</Text>
                    <Text style={text.small}>{[titleCase(audit.repName), titleCase(audit.areaName), titleCase(audit.hospitalName)].filter(Boolean).join(' · ')}</Text>
                </View>
                <Tag label={done ? RESULT[audit.status]?.label : REASON[audit.reason] || 'Audit'} tone={done ? RESULT[audit.status]?.tone : 'info'} />
            </View>
            {audit.kind === 'CROSS' ? <Text style={[text.small, { marginTop: 6 }]}>Cross-audit set by head office.</Text> : null}
            {done ? null : !checkedIn ? (
                <Button title="Check in at the clinic" icon="map-pin" onPress={checkIn} busy={busy} style={{ marginTop: space(1.5) }} />
            ) : (
                <View style={{ marginTop: space(1.5) }}>
                    <Text style={[text.small, { marginBottom: space(1) }]}>{audit.distanceM != null ? `Checked in ${audit.distanceM} m from the clinic. What did you find?` : 'Checked in. What did you find?'}</Text>
                    <Chips options={Object.entries(RESULT).map(([value, r]) => ({ value, label: r.label }))} value={result} onChange={setResult} />
                    <Field label={result && result !== 'PASSED' ? 'What you saw *' : 'Notes (optional)'} value={notes} onChangeText={(v) => setNotes(v.slice(0, 500))} multiline autoCapitalize="sentences" />
                    <Button title="Save result" icon="check" onPress={save} busy={busy} disabled={!result || (result !== 'PASSED' && notes.trim().length < 5)} />
                </View>
            )}
        </Card>
    );
}

function Today() {
    const state = useLoad(async () => (await api.get('/app/audits/today')).data, [], "Couldn't load today's audits.");
    return (
        <Loadable state={state}>
            {(data) => (
                <>
                    <Notice tone="info" icon="eye-off">{"Only you see these doctors. The rep doesn't know which ones are checked."}</Notice>
                    {data.audits.length === 0 ? (
                        <Empty icon="shield" title="No audits today" caption="Audits appear on a confirmed joint work day, or when head office sets a cross-audit for you." />
                    ) : (
                        data.audits.map((a) => <AuditCard key={a.auditId} audit={a} onDone={state.reload} />)
                    )}
                </>
            )}
        </Loadable>
    );
}

function Scores() {
    const state = useLoad(async () => (await api.get('/app/truth/scores')).data, [], "Couldn't load the scores.");
    return (
        <Loadable state={state}>
            {(data) => (
                <>
                    {data.learningMode ? <Notice tone="info" icon="book-open">Learning mode: scores are for coaching only for now.</Notice> : null}
                    <SectionTitle title="Field Truth Score" caption="Presence 40 · pattern 20 · audits 25 · outcome 15 · lowest first" />
                    {(data.scores || []).length === 0 ? (
                        <Empty icon="users" title="No team members" />
                    ) : (
                        data.scores.map((s) => (
                            <Card key={s.userId} style={{ marginBottom: space(1.25) }}>
                                <View style={styles.top}>
                                    <View style={styles.badge}>
                                        <Text style={styles.badgeText}>{s.score ?? '—'}</Text>
                                    </View>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.doctor}>{titleCase(s.name)}</Text>
                                        <Text style={text.small}>{[s.designation, `${s.visits} visits`].filter(Boolean).join(' · ')}</Text>
                                    </View>
                                    <Tag label={BAND[s.band]?.label} tone={BAND[s.band]?.tone} />
                                </View>
                                <View style={{ marginTop: space(1.25), gap: 6 }}>
                                    {['presence', 'pattern', 'audits', 'outcome'].map((k) => (
                                        <View key={k} style={styles.partRow}>
                                            <Text style={styles.partLabel}>{k[0].toUpperCase() + k.slice(1)}</Text>
                                            <View style={{ flex: 1 }}>
                                                <ProgressBar value={(s.parts[k].value || 0) / s.parts[k].max} height={6} />
                                            </View>
                                            <Text style={styles.partValue}>{s.parts[k].value ?? '—'}/{s.parts[k].max}</Text>
                                        </View>
                                    ))}
                                </View>
                                {s.notes?.length ? <Text style={[text.small, { marginTop: space(1) }]}>{s.notes.join(' · ')}</Text> : null}
                            </Card>
                        ))
                    )}
                </>
            )}
        </Loadable>
    );
}

export default function Audits({ navigation, route }) {
    const [tab, setTab] = useState(route.params?.tab === 'scores' ? 'scores' : 'today');
    return (
        <Screen>
            <Header overline="Field truth" title="Joint audits" onBack={() => navigation.goBack()} />
            <Chips
                options={[
                    { value: 'today', label: "Today's audits" },
                    { value: 'scores', label: 'Team scores' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {tab === 'today' ? <Today /> : <Scores />}
        </Screen>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: space(1.25) },
    doctor: { fontFamily: fonts.semibold, fontSize: 15, color: colors.ink },
    badge: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.jadeMist, alignItems: 'center', justifyContent: 'center' },
    badgeText: { fontFamily: fonts.heavy, fontSize: 15, color: colors.jadeDark },
    partRow: { flexDirection: 'row', alignItems: 'center', gap: space(1) },
    partLabel: { width: 74, fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
    partValue: { width: 44, textAlign: 'right', fontFamily: fonts.semibold, fontSize: 12, color: colors.ink },
});
