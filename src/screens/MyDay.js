import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { acceptConsent, currentSession, errorMessage, getToday, startDay } from '../api';
import { ago, clock, doctorName, initial, plural, titleCase } from '../format';
import { getFix, startTrail } from '../location';
import { colors, fonts, gradients, radius, space, text } from '../theme';
import { toast } from '../toast';
import { Button, Card, Chips, Empty, ErrorState, Notice, ProgressBar, Screen, SectionTitle, Skeleton, SkeletonList, Tag } from '../ui';
import { t } from '../i18n';

export const RESULT = {
    VALID: { label: 'Counted', tone: 'success' },
    REVIEW: { label: 'Counted · needs a look', tone: 'warning' },
    INVALID: { label: 'Not counted', tone: 'error' },
};
const PATCH = { HQ: 'HQ', EX_HQ: 'Ex-HQ', OUTSTATION: 'Outstation' };
const TRAIL = {
    background: { label: 'Location trail on', tone: 'success' },
    foreground: { label: 'Trail on while the app is open', tone: 'info' },
    off: { label: 'Location off: allow it for TA', tone: 'error' },
};

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const longDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

function DoctorRow({ doctor, onCheckIn }) {
    return (
        <Card style={styles.doctor}>
            <View style={styles.avatar}>
                <Text style={styles.avatarText}>{initial(doctor.DoctorName)}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={text.subtitle} numberOfLines={1}>
                    {doctorName(doctor.DoctorName)}
                </Text>
                <Text style={text.small} numberOfLines={1}>
                    {[titleCase(doctor.Speciality), titleCase(doctor.AreaName), doctor.km != null && `${doctor.km < 1 ? Math.round(doctor.km * 1000) + ' m' : doctor.km.toFixed(1) + ' km'} away`].filter(Boolean).join(' · ')}
                </Text>
                <View style={styles.tags}>
                    {doctor.Category ? <Tag label={`Class ${doctor.Category}`} tone="primary" /> : null}
                    <Tag label={`${plural(doctor.remaining, 'visit')} left`} tone="neutral" />
                    {doctor.timing?.slot ? <Tag label={doctor.timing.label} tone="info" icon="clock" /> : null}
                    {!doctor.clinicPinned ? <Tag label={t("Clinic not pinned")} tone="warning" icon="map-pin" /> : null}
                </View>
            </View>
            <Button title={t("Check in")} small icon="map-pin" onPress={() => onCheckIn(doctor)} />
        </Card>
    );
}

function QuickAction({ icon, label, onPress }) {
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.quick, pressed && { backgroundColor: colors.jadeWash }]} accessibilityRole="button" accessibilityLabel={label}>
            <View style={styles.quickIcon}>
                <Feather name={icon} size={17} color={colors.jadeDark} />
            </View>
            <Text style={styles.quickText} numberOfLines={1}>
                {label}
            </Text>
        </Pressable>
    );
}


// Straight-line distance in km (for "nearest first"; roads are longer, the order is what matters).
const kmBetween = (a, b) => {
    const rad = (d) => (d * Math.PI) / 180;
    const dLat = rad(b.lat - a.lat);
    const dLng = rad(b.lng - a.lng);
    const h = Math.pow(Math.sin(dLat / 2), 2) + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.pow(Math.sin(dLng / 2), 2);
    return 6371 * 2 * Math.asin(Math.sqrt(h));
};

// Doctors with a known clinic first, nearest first; the rest keep their order at the end.
const byNearest = (list, here) => {
    if (!here) return list;
    const withKm = list.map((d, i) => ({ d: d.lat != null && d.lng != null ? { ...d, km: kmBetween(here, d) } : d, i }));
    return withKm
        .sort((x, y) => (x.d.km ?? Infinity) - (y.d.km ?? Infinity) || x.i - y.i)
        .map((x) => x.d);
};

// The one status area: what the day looks like and what to do next.
function DayStatus({ data, trail, loadedAt, busy, onAccept, onStart }) {
    const needs = data.rules?.daMinValidVisits ?? 6;
    // One source of truth: "counted" = VALID + needs a look (both count for DA), as the server's validToday.
    const counted = data.validToday ?? 0;
    const review = data.today?.review ?? 0;
    const notCounted = data.today?.notCounted ?? 0;
    const earned = counted >= needs;
    const patch = data.planned?.dayType === 'OFF' ? 'Day off' : data.planned?.areaName ? `${titleCase(data.planned.areaName)}${data.planned.patchType ? ` · ${PATCH[data.planned.patchType]}` : ''}` : 'No tour plan for today';

    if (!data.consent.accepted) {
        return (
            <Card style={styles.status}>
                <Text style={text.overline}>First, once</Text>
                <Text style={[text.title, { marginTop: 4 }]}>Allow location during work hours</Text>
                <Text style={[text.body, { marginTop: 6, marginBottom: space(2) }]}>
                    Recorded only {data.rules.workStartHour}:00–{data.rules.workEndHour}:00 after you start your day. It proves your field work and works out your TA from the
                    distance you travel.
                </Text>
                <Button title={t("I agree")} icon="check" onPress={onAccept} busy={busy} />
            </Card>
        );
    }

    if (!data.workDay) {
        return (
            <Card style={styles.status}>
                <Text style={text.overline}>{t("Next step")}</Text>
                <Text style={[text.title, { marginTop: 4 }]}>Start your day</Text>
                <Text style={[text.body, { marginTop: 6 }]}>It also checks you in for attendance and turns on the location trail for TA.</Text>
                <View style={styles.patch}>
                    <Feather name="map" size={14} color={colors.inkMuted} />
                    <Text style={text.small}>{patch}</Text>
                </View>
                <Button title={t("Start my day")} icon="play" onPress={onStart} busy={busy} style={{ marginTop: space(1.5) }} />
            </Card>
        );
    }

    const t = TRAIL[trail];
    return (
        <LinearGradient colors={gradients.soft} style={styles.statusDark}>
            <View style={styles.statusTop}>
                <View style={{ flex: 1 }}>
                    <Text style={text.overline}>{earned ? t("Today's DA") : t("Next step")}</Text>
                    <Text style={styles.statusTitle}>{earned ? t("DA earned for today") : `Visit ${plural(needs - counted, 'more doctor')} for today's DA`}</Text>
                </View>
                <View style={styles.countBubble}>
                    <Text style={styles.countBig}>{counted}</Text>
                    <Text style={styles.countSmall}>of {needs}</Text>
                </View>
            </View>
            <ProgressBar value={counted / needs} tone={earned ? 'success' : 'brand'} />
            <Text style={styles.statusLine}>
                {`${plural(counted, 'visit')} counted${review ? ` (${review} need a look: they still count)` : ''}${notCounted ? ` · ${notCounted} not counted` : ''}`}
            </Text>
            <View style={styles.divider} />
            <View style={styles.metaRow}>
                <Feather name="map" size={13} color={colors.inkMuted} />
                <Text style={styles.metaText}>{patch}</Text>
            </View>
            <View style={styles.metaRow}>
                <Feather name="clock" size={13} color={colors.inkMuted} />
                <Text style={styles.metaText}>Started {clock(data.workDay.StartedAt)}</Text>
                {t ? <Text style={[styles.metaText, { color: t.tone === 'error' ? colors.errorDark : colors.jade }]}>· {t.label}</Text> : null}
            </View>
            <View style={styles.metaRow}>
                <Feather name="refresh-cw" size={13} color={colors.inkMuted} />
                <Text style={styles.metaText}>Updated {ago(loadedAt)} · pull down to refresh</Text>
            </View>
        </LinearGradient>
    );
}

function TodaySkeleton() {
    return (
        <>
            <View style={[styles.status, styles.skeletonCard]}>
                <Skeleton width="35%" height={11} />
                <Skeleton width="80%" height={20} style={{ marginTop: 10 }} />
                <Skeleton height={8} style={{ marginTop: 16 }} />
            </View>
            <SkeletonList rows={3} style={{ marginTop: space(3) }} />
        </>
    );
}

// The field user's day: one status area, quick actions, today's plan, doctors due, today's visits.
export default function MyDay({ navigation }) {
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [loadedAt, setLoadedAt] = useState(null);
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);
    const [trail, setTrail] = useState(null); // background | foreground | off
    const [showAll, setShowAll] = useState(false);
    const [here, setHere] = useState(null); // phone location for "nearest first"
    const user = currentSession()?.user;

    const load = useCallback(async () => {
        try {
            setData(await getToday());
            setError('');
            setLoadedAt(new Date());
        } catch (err) {
            setError(errorMessage(err, "Couldn't load your day."));
        } finally {
            setRefreshing(false);
        }
    }, []);

    // Reload whenever the screen comes back into view (e.g. after saving a visit).
    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    // Record the work-hour location trail once consent is given and the day has started.
    useEffect(() => {
        if (data?.consent?.accepted && data?.workDay && !trail) startTrail(data.rules.pingIntervalMinutes).then(setTrail);
    }, [data, trail]);

    const accept = async () => {
        setBusy(true);
        try {
            await acceptConsent();
            await load();
            toast('Thanks. Location consent recorded.');
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const start = async () => {
        setBusy(true);
        try {
            const fix = await getFix();
            await startDay(fix);
            await load();
            toast('Day started. You are checked in for attendance.');
        } catch (err) {
            toast(errorMessage(err, "Couldn't start your day."), 'error');
        } finally {
            setBusy(false);
        }
    };

    const openVisit = (doctor) => {
        const go = () => navigation.navigate('Visit', { doctor, date: data.date, rules: data.rules });
        if (doctor.clinicPinned) return go();
        Alert.alert(
            'Clinic not pinned yet',
            `${doctorName(doctor.DoctorName)}'s clinic location isn't saved, so the app can't confirm you are there. The visit still counts but will be marked "needs a look" for your manager.`,
            [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Check in anyway', onPress: go },
            ]
        );
    };

    const firstName = titleCase(String(user?.Name || user?.UserName || '').split(' ')[0]);
    const plan = data ? byNearest(data.plan, here) : [];
    const otherDue = data ? byNearest(data.otherDue, here) : [];
    const others = showAll ? otherDue : otherDue.slice(0, 8);

    // "Nearest first": one GPS reading, then the lists are ordered by distance from here.
    const toggleNearest = async () => {
        if (here) return setHere(null);
        const fix = await getFix().catch(() => null);
        if (fix?.status === 'CAPTURED') setHere({ lat: fix.latitude, lng: fix.longitude });
        else toast("Couldn't get your location for nearest first.", 'error');
    };
    const started = Boolean(data?.workDay);

    return (
        <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.jade} />}>
            <View style={styles.header}>
                {navigation.canGoBack() ? (
                    <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.back} accessibilityLabel="Back">
                        <Feather name="arrow-left" size={18} color={colors.inkSoft} />
                    </Pressable>
                ) : null}
                <Text style={text.overline}>{data ? longDate(data.date) : 'My day'}</Text>
                <Text style={[text.display, { marginTop: 4 }]}>
                    {greeting()}
                    {firstName ? `, ${firstName}` : ''}
                </Text>
            </View>

            {!data && error ? (
                <ErrorState message={error} onRetry={load} />
            ) : !data ? (
                <TodaySkeleton />
            ) : (
                <>
                    <DayStatus data={data} trail={trail} loadedAt={loadedAt} busy={busy} onAccept={accept} onStart={start} />
                    {error ? <Text style={[text.small, { color: colors.errorDark, marginTop: space(1) }]}>{error} Showing the last loaded data.</Text> : null}

                    {(data.jointWork || []).map((jw) => (
                        <Notice key={jw.JointWorkId} tone="info" title={`Today: joint work with ${titleCase(jw.withName)}`}>
                            {`${[jw.TerritoryName && titleCase(jw.TerritoryName), jw.AreaName && titleCase(jw.AreaName)].filter(Boolean).join(' · ') || (jw.role === 'colleague' ? 'Their planned area' : 'Your planned area')}. ${
                                jw.role === 'field' ? 'Your visits today are marked as joint calls.' : 'Their visits today are your joint calls.'
                            }`}
                        </Notice>
                    ))}

                    <View style={styles.quickRow}>
                        <QuickAction icon="user-plus" label={t("Add doctor")} onPress={() => navigation.navigate('AddDoctor')} />
                        <QuickAction icon="shopping-bag" label={t("New order")} onPress={() => navigation.navigate('NewOrder')} />
                        <QuickAction icon="credit-card" label="TA / DA" onPress={() => navigation.navigate('Allowance')} />
                        <QuickAction icon="calendar" label={t("Leave")} onPress={() => navigation.navigate('Me')} />
                    </View>

                    <SectionTitle title={data.planned?.areaName ? `${t("Today's plan")} · ${titleCase(data.planned.areaName)}` : t("Today's plan")} caption={here ? t("Nearest clinic first, from where you are now.") : t("Ordered by when each doctor is usually available.")} />
                    {data.plan.length + data.otherDue.length > 1 ? (
                        <Chips
                            options={[
                                { value: 'time', label: t("Usual time") },
                                { value: 'near', label: t("Nearest first") },
                            ]}
                            value={here ? 'near' : 'time'}
                            onChange={(v) => ((v === 'near') !== Boolean(here) ? toggleNearest() : null)}
                        />
                    ) : null}
                    {plan.length ? (
                        <View style={{ gap: space(1.25) }}>
                            {plan.map((doctor) => (
                                <DoctorRow key={doctor.DoctorId} doctor={doctor} onCheckIn={openVisit} />
                            ))}
                        </View>
                    ) : (
                        <Card>
                            <Empty
                                icon="map"
                                title={data.planned ? t("Nobody due in this patch today") : t("No tour plan for today")}
                                caption={data.otherDue.length ? `You can visit any of the ${plural(data.otherDue.length, 'doctor')} due below.` : 'Add a doctor you meet at a new clinic.'}
                            />
                            {!data.otherDue.length && <Button title={t("Add a doctor")} icon="user-plus" variant="outline" onPress={() => navigation.navigate('AddDoctor')} />}
                        </Card>
                    )}

                    {data.otherDue.length > 0 && (
                        <>
                            <SectionTitle title={t("Also due in your territory")} caption={t("No approval needed to visit them.")} />
                            <View style={{ gap: space(1.25) }}>
                                {others.map((doctor) => (
                                    <DoctorRow key={doctor.DoctorId} doctor={doctor} onCheckIn={openVisit} />
                                ))}
                            </View>
                            {data.otherDue.length > 8 && (
                                <Button title={showAll ? t("Show fewer") : `Show all ${data.otherDue.length}`} variant="ghost" onPress={() => setShowAll((v) => !v)} style={{ marginTop: space(1) }} />
                            )}
                        </>
                    )}

                    <SectionTitle title={t("Today's visits")} caption="Counted, needs a look (still counts) or not counted." />
                    {data.visits.length ? (
                        <View style={{ gap: space(1) }}>
                            {data.visits.map((visit) => {
                                const result = RESULT[visit.FinalValidity];
                                return (
                                    <Card key={visit.VisitId} style={{ padding: space(1.5) }}>
                                        <View style={styles.visitTop}>
                                            <Text style={[text.subtitle, { flex: 1 }]} numberOfLines={1}>
                                                {doctorName(visit.DoctorName)}
                                            </Text>
                                            {result ? <Tag label={result.label} tone={result.tone} /> : null}
                                        </View>
                                        <Text style={text.small}>{visit.CheckInAt ? `${clock(visit.CheckInAt)} – ${clock(visit.CheckOutAt)}` : 'No live check-in'}</Text>
                                        {(visit.reasons || []).map((reason) => (
                                            <Text key={reason.code} style={[text.small, { color: reason.hard ? colors.errorDark : colors.warningDark }]}>
                                                • {reason.text}
                                            </Text>
                                        ))}
                                    </Card>
                                );
                            })}
                        </View>
                    ) : (
                        <Card>
                            <Empty
                                icon="map-pin"
                                title={t("No visits yet today")}
                                caption={started ? 'When you reach a clinic, tap Check in on the doctor above. Your check-in time and location are saved.' : t("Start your day first, then check in at each clinic.")}
                            />
                        </Card>
                    )}
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { marginBottom: space(2.5) },
    back: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center', marginBottom: space(1.5) },
    status: { padding: space(2.25) },
    skeletonCard: { backgroundColor: colors.paper, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line },
    statusDark: { borderRadius: radius.xl, padding: space(2.25), borderWidth: 1, borderColor: colors.line },
    statusTop: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), marginBottom: space(1.75) },
    statusTitle: { fontFamily: fonts.display, fontSize: 21, lineHeight: 27, color: colors.ink, marginTop: 4 },
    countBubble: { width: 66, height: 66, borderRadius: 33, borderWidth: 2, borderColor: colors.jade, alignItems: 'center', justifyContent: 'center' },
    countBig: { fontFamily: fonts.heavy, fontSize: 24, lineHeight: 26, color: colors.ink },
    countSmall: { fontFamily: fonts.semibold, fontSize: 11, color: colors.inkMuted },
    statusLine: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18, color: colors.inkSoft, marginTop: space(1.25) },
    divider: { height: 1, backgroundColor: colors.line, marginVertical: space(1.5) },
    metaRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 6 },
    metaText: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkMuted },
    patch: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: space(1.25) },
    quickRow: { flexDirection: 'row', gap: space(1), marginTop: space(2) },
    quick: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: space(1.5), borderRadius: radius.lg, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper },
    quickIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.jadeMist, alignItems: 'center', justifyContent: 'center' },
    quickText: { fontFamily: fonts.semibold, fontSize: 11.5, color: colors.inkSoft },
    doctor: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), padding: space(1.5) },
    avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.jadeMist, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.bold, fontSize: 16, color: colors.jadeDark },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
    visitTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
});
