import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, checkIn, errorMessage, saveVisit } from '../api';
import { getFix } from '../location';
import { toast } from '../toast';
import { colors, fonts, radius, space, text } from '../theme';
import { doctorName, titleCase } from '../format';
import { Button, Card, Field, Header, Notice, Screen, Tag } from '../ui';
import { RESULT } from './MyDay';
import { t } from '../i18n';

const FEEDBACK = [
    { value: 'POSITIVE', label: t("Positive"), icon: 'thumbs-up' },
    { value: 'NEUTRAL', label: t("Neutral"), icon: 'minus-circle' },
    { value: 'NEGATIVE', label: t("Negative"), icon: 'thumbs-down' },
];

const mmss = (seconds) => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
const uuid = () =>
    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
    });

// Samples and gifts in the rep's bag (balance > 0), to record what was given at this visit.
function GivenItems({ given, setGiven, prefill }) {
    const [items, setItems] = useState(null);

    useEffect(() => {
        Promise.all(['SAMPLE', 'GIFT'].map((type) => api.get('/app/stock/balances', { params: { itemType: type } }).then((r) => (r.data?.balances || []).map((b) => ({ ...b, ItemType: type })))))
            .then((lists) => setItems(lists.flat().filter((b) => Number(b.Balance) > 0)))
            .catch(() => setItems([]));
    }, []);

    // "Same as last visit": take the last visit's items, never more than is in hand now.
    useEffect(() => {
        if (!items || !prefill) return;
        const next = {};
        prefill.forEach((p) => {
            const held = items.find((b) => b.ItemType === p.ItemType && String(b.ItemId).toLowerCase() === String(p.ItemId).toLowerCase());
            if (held) next[`${held.ItemType}:${held.ItemId}`] = Math.min(Number(held.Balance), Number(p.Quantity) || 0);
        });
        setGiven(next);
    }, [items, prefill, setGiven]);

    if (!items) return null;
    if (!items.length) return <Text style={[text.small, { marginBottom: space(2) }]}>No samples or gifts in hand. Your manager issues them.</Text>;

    const key = (b) => `${b.ItemType}:${b.ItemId}`;
    const change = (b, step) => setGiven((g) => {
        const next = Math.max(0, Math.min(Number(b.Balance), (g[key(b)] || 0) + step));
        return { ...g, [key(b)]: next };
    });

    return (
        <Card style={{ marginBottom: space(2) }}>
            {items.map((b) => {
                const qty = given[key(b)] || 0;
                return (
                    <View key={key(b)} style={styles.itemRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.itemName} numberOfLines={1}>{b.ItemName}</Text>
                            <Text style={text.small}>{b.ItemType === 'SAMPLE' ? 'Sample' : 'Gift'} · {b.Balance} in hand</Text>
                        </View>
                        <Pressable onPress={() => change(b, -1)} hitSlop={8} style={styles.stepBtn} accessibilityLabel={`Less ${b.ItemName}`}>
                            <Feather name="minus" size={16} color={colors.inkSoft} />
                        </Pressable>
                        <Text style={styles.qty}>{qty}</Text>
                        <Pressable onPress={() => change(b, 1)} hitSlop={8} style={styles.stepBtn} accessibilityLabel={`More ${b.ItemName}`}>
                            <Feather name="plus" size={16} color={colors.jade} />
                        </Pressable>
                    </View>
                );
            })}
        </Card>
    );
}

// At the clinic: live check-in, stay timer, distance guidance, then save the visit.
export default function Visit({ route, navigation }) {
    const { doctor, date } = route.params;
    const [checkInState, setCheckInState] = useState({ status: 'working' }); // working | done | failed
    const [now, setNow] = useState(() => Date.now());
    const [feedback, setFeedback] = useState(null);
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState(null);
    const [given, setGiven] = useState({}); // "SAMPLE:<id>" -> quantity
    const [last, setLast] = useState(null); // the last visit to this doctor, for "same as last visit"
    const [prefill, setPrefill] = useState(null);

    useEffect(() => {
        let alive = true;
        const from = new Date(`${date}T00:00:00`);
        from.setDate(from.getDate() - 60);
        const fromKey = `${from.getFullYear()}-${String(from.getMonth() + 1).padStart(2, '0')}-${String(from.getDate()).padStart(2, '0')}`;
        api.get('/app/visits', { params: { doctorId: doctor.DoctorId, from: fromKey, to: date } })
            .then(async (r) => {
                const list = (r.data?.visits || []).filter((v) => v.VisitId !== visitId).sort((a, b) => String(b.VisitDate).localeCompare(String(a.VisitDate)));
                if (!list.length) return;
                const detail = (await api.get(`/app/visits/${list[0].VisitId}`)).data;
                if (alive) setLast({ date: String(list[0].VisitDate).slice(0, 10), feedback: detail.Feedback || null, notes: detail.Notes || '', items: detail.Items || [] });
            })
            .catch(() => null);
        return () => {
            alive = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const sameAsLast = () => {
        if (!last) return;
        if (last.feedback) setFeedback(last.feedback);
        if (last.notes) setNotes(last.notes);
        setPrefill(last.items);
        toast('Filled from your last visit. Change anything that is different today.');
    };
    const visitId = useRef(uuid()).current;

    const doCheckIn = async (retry = true) => {
        if (retry) setCheckInState({ status: 'working' });
        try {
            const fix = await getFix();
            if (fix.status !== 'CAPTURED') {
                setCheckInState({ status: 'failed', message: fix.status === 'DENIED' ? 'Location permission is off. Allow it in the phone settings to check in.' : "Couldn't get your location. Move to an open spot and try again." });
                return;
            }
            const response = await checkIn(doctor.DoctorId, fix);
            setCheckInState({ status: 'done', id: response.CheckInId, at: new Date(response.CheckInAt).getTime(), minMinutes: response.minDwellMinutes, clinic: response.clinic || null, mocked: fix.isMock });
        } catch (err) {
            setCheckInState({ status: 'failed', message: errorMessage(err, "Couldn't check in.") });
        }
    };

    useEffect(() => {
        // Check in once on open; state changes happen after the GPS / server reply, not synchronously.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        doCheckIn(false);
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const stayed = checkInState.status === 'done' ? Math.max(0, Math.round((now - checkInState.at) / 1000)) : 0;
    const left = checkInState.status === 'done' ? Math.max(0, checkInState.minMinutes * 60 - stayed) : 0;
    const clinic = checkInState.clinic;

    const save = async () => {
        setSaving(true);
        try {
            const checkOut = await getFix();
            const response = await saveVisit({
                VisitId: visitId,
                DoctorId: doctor.DoctorId,
                VisitDate: date,
                Feedback: feedback,
                Notes: notes.trim() || null,
                Location: checkOut,
                CheckInId: checkInState.status === 'done' ? checkInState.id : null,
                RecordedOffline: false,
                RecordedAt: new Date().toISOString(),
                Items: Object.entries(given)
                    .filter(([, qty]) => qty > 0)
                    .map(([k, qty]) => ({ ItemType: k.split(':')[0], ItemId: k.split(':')[1], Quantity: qty })),
            });
            setResult(response?.data || response || {});
        } catch (err) {
            Alert.alert('Save visit', errorMessage(err, "Couldn't save the visit."));
        } finally {
            setSaving(false);
        }
    };

    if (result) {
        const r = RESULT[result.validity];
        return (
            <Screen>
                <Card style={{ alignItems: 'center', paddingVertical: space(4) }}>
                    <View style={[styles.resultIcon, { backgroundColor: result.validity === 'INVALID' ? colors.errorSoft : colors.successSoft }]}>
                        <Feather name={result.validity === 'INVALID' ? 'alert-octagon' : 'check'} size={30} color={result.validity === 'INVALID' ? colors.errorDark : colors.successDark} />
                    </View>
                    <Text style={[text.display, { marginTop: space(2), textAlign: 'center' }]}>{t("Visit saved")}</Text>
                    <Text style={[text.body, { textAlign: 'center', marginTop: 4 }]}>{doctorName(doctor.DoctorName)}</Text>
                    {r ? <View style={{ marginTop: space(1.5) }}><Tag label={r.label} tone={r.tone} /></View> : null}
                    {(result.reasons || []).map((reason) => (
                        <Text key={reason.code} style={[text.small, { marginTop: 6, textAlign: 'center' }]}>
                            • {reason.text}
                        </Text>
                    ))}
                    {result.validity !== 'VALID' && result.validity ? (
                        <Text style={[text.small, { marginTop: space(1.5), textAlign: 'center' }]}>If it was a genuine visit, you can explain it within 2 days.</Text>
                    ) : null}
                </Card>
                <Button title={t("Back to My Day")} icon="arrow-left" onPress={() => navigation.goBack()} style={{ marginTop: space(2) }} />
            </Screen>
        );
    }

    return (
        <Screen>
            <Header overline="Visit" title={doctorName(doctor.DoctorName)} onBack={() => navigation.goBack()} />
            <Text style={[text.small, { marginTop: -space(1.5), marginBottom: space(2) }]}>{[titleCase(doctor.Speciality), titleCase(doctor.AreaName), titleCase(doctor.HospitalName)].filter(Boolean).join(' · ')}</Text>

            {checkInState.status === 'working' && <Notice tone="info" icon="crosshair">{t("Checking you in at the clinic…")}</Notice>}
            {checkInState.status === 'failed' && (
                <>
                    <Notice tone="error">{checkInState.message}</Notice>
                    <Button title={t("Try again")} variant="outline" icon="refresh-cw" onPress={() => doCheckIn()} style={{ marginBottom: space(2) }} />
                </>
            )}

            {checkInState.status === 'done' && (
                <Card style={styles.timerCard}>
                    <Text style={text.small}>{t("At the clinic for")}</Text>
                    <Text style={styles.timer}>{mmss(stayed)}</Text>
                    <Text style={[text.small, { color: left ? colors.inkMuted : colors.successDark }]}>
                        {left ? `Stay ${mmss(left)} more so this visit counts in full` : "You’ve stayed long enough. Save when you finish."}
                    </Text>
                </Card>
            )}

            {checkInState.status === 'done' && clinic && clinic.inside === false && (
                <Notice tone="warning" title={`About ${clinic.distanceM} m from the clinic`}>
                    {`It counts within ${clinic.radiusM} m. Move closer, or if you are inside a hospital with weak GPS, you can explain it after saving.`}
                </Notice>
            )}
            {checkInState.status === 'done' && clinic && clinic.inside === true && <Notice tone="success">{`You are at the clinic (about ${clinic.distanceM} m away).`}</Notice>}
            {checkInState.status === 'done' && clinic && !clinic.pinned && <Notice tone="info">This clinic’s location is not pinned yet, so the visit will need a look.</Notice>}
            {checkInState.status === 'done' && checkInState.mocked && <Notice tone="error">A location-changing app is on. Please turn it off to check in.</Notice>}

            {last ? (
                <Button
                    title={`${t('Same as last visit')} · ${new Date(`${last.date}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`}
                    icon="copy"
                    variant="outline"
                    small
                    onPress={sameAsLast}
                    style={{ alignSelf: 'flex-start', marginTop: space(1) }}
                />
            ) : null}

            <Text style={[text.title, { marginTop: space(1) }]}>{t("How did it go?")}</Text>
            <View style={styles.feedbackRow}>
                {FEEDBACK.map((item) => {
                    const on = feedback === item.value;
                    return (
                        <Pressable key={item.value} onPress={() => setFeedback(on ? null : item.value)} style={[styles.feedback, on && styles.feedbackOn]} accessibilityState={{ selected: on }}>
                            <Feather name={item.icon} size={18} color={on ? colors.white : colors.inkSoft} />
                            <Text style={[styles.feedbackText, on && { color: colors.white }]}>{item.label}</Text>
                        </Pressable>
                    );
                })}
            </View>

            <Text style={[text.title, { marginBottom: space(1) }]}>{t("Samples & gifts given")}</Text>
            <GivenItems given={given} setGiven={setGiven} prefill={prefill} />

            <Field label={t("Notes (optional)")} value={notes} onChangeText={(v) => setNotes(v.slice(0, 1000))} multiline placeholder="What was discussed, products, next step…" autoCapitalize="sentences" />

            <Button title={saving ? t("Saving…") : t("Save visit")} icon="check" onPress={save} busy={saving} disabled={checkInState.status === 'working'} />
            {checkInState.status === 'failed' ? <Text style={[text.small, { marginTop: space(1) }]}>Saving without a check-in is allowed, but the visit won’t count.</Text> : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    timerCard: { alignItems: 'center', paddingVertical: space(2.5), marginBottom: space(2) },
    timer: { fontFamily: fonts.heavy, fontSize: 44, color: colors.jade, letterSpacing: -1, marginVertical: 2 },
    feedbackRow: { flexDirection: 'row', gap: space(1), marginTop: space(1.25), marginBottom: space(2.5) },
    feedback: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: space(1.5), borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
    feedbackOn: { backgroundColor: colors.jade, borderColor: colors.jade },
    feedbackText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft },
    itemRow: { flexDirection: 'row', alignItems: 'center', gap: space(1), paddingVertical: space(1) },
    itemName: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
    stepBtn: { width: 34, height: 34, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
    qty: { minWidth: 26, textAlign: 'center', fontFamily: fonts.heavy, fontSize: 16, color: colors.ink },
    resultIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
});
