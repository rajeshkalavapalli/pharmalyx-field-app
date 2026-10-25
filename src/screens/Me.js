import { useCallback, useState } from 'react';
import { Alert, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { attendanceCheckOut, cancelLeave, clearSession, currentSession, errorMessage, getAttendanceMonth, getAttendanceToday, getLeave, monthKey } from '../api';
import { getFix } from '../location';
import { colors, fonts, gradients, radius, space, text } from '../theme';
import { titleCase } from '../format';
import { toast } from '../toast';
import { Button, Card, Notice, Screen, SectionTitle, Skeleton, StatTile, Tag } from '../ui';

const LEAVE_STATUS = {
    PENDING: { label: 'Pending', tone: 'warning' },
    APPROVED: { label: 'Approved', tone: 'success' },
    REJECTED: { label: 'Rejected', tone: 'error' },
    CANCELLED: { label: 'Cancelled', tone: 'neutral' },
};
const shortDate = (key) => new Date(`${String(key).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Profile, today's attendance, this month at a glance, leave, and sign out.
export default function Me({ navigation }) {
    const user = currentSession()?.user;
    const [today, setToday] = useState(null);
    const [summary, setSummary] = useState(null);
    const [leave, setLeave] = useState(null);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [busy, setBusy] = useState(false);

    const load = useCallback(async () => {
        setError('');
        const [t, m, l] = await Promise.allSettled([getAttendanceToday(), getAttendanceMonth(monthKey()), getLeave(new Date().getFullYear())]);
        if (t.status === 'fulfilled') setToday(t.value);
        if (m.status === 'fulfilled') {
            const people = m.value?.people || [];
            const me = people.find((p) => String(p.UserId).toLowerCase() === String(user?.UserId).toLowerCase()) || (people.length === 1 ? people[0] : null);
            setSummary(me?.summary || null);
        }
        if (l.status === 'fulfilled') setLeave(l.value);
        const failed = [t, m, l].find((r) => r.status === 'rejected');
        if (failed) setError(errorMessage(failed.reason, "Some details couldn't be loaded."));
        setRefreshing(false);
    }, [user?.UserId]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const checkOut = () =>
        Alert.alert('Check out for today?', 'Do this when you finish work.', [
            { text: 'Not yet', style: 'cancel' },
            {
                text: 'Check out',
                onPress: async () => {
                    setBusy(true);
                    try {
                        const fix = await getFix();
                        await attendanceCheckOut({ LocationStatus: fix.status, Latitude: fix.latitude, Longitude: fix.longitude, Accuracy: fix.accuracy });
                        await load();
                        toast('Checked out. Have a good evening.');
                    } catch (err) {
                        toast(errorMessage(err), 'error');
                    } finally {
                        setBusy(false);
                    }
                },
            },
        ]);

    const cancel = (row) =>
        Alert.alert('Cancel this leave?', `${row.LeaveName} · ${shortDate(row.FromDate)}${row.ToDate !== row.FromDate ? ` – ${shortDate(row.ToDate)}` : ''}`, [
            { text: 'Keep it', style: 'cancel' },
            {
                text: 'Cancel leave',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await cancelLeave(row.LeaveId);
                        toast('Leave cancelled');
                        load();
                    } catch (err) {
                        toast(errorMessage(err), 'error');
                    }
                },
            },
        ]);

    const signOut = () =>
        Alert.alert('Sign out?', 'You can sign in again any time.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: clearSession },
        ]);

    const name = titleCase(user?.Name || user?.UserName || '');
    const mine = (leave?.requests || []).filter((r) => r.isOwn).slice(0, 8);

    return (
        <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.jade} />}>
            <LinearGradient colors={gradients.ink} style={styles.profile}>
                <LinearGradient colors={gradients.brand} style={styles.avatar}>
                    <Text style={styles.avatarText}>{String(name || '?').trim().charAt(0).toUpperCase()}</Text>
                </LinearGradient>
                <View style={{ flex: 1 }}>
                    <Text style={styles.name} numberOfLines={1}>{name}</Text>
                    <Text style={styles.meta} numberOfLines={1}>{[user?.DesignationName, user?.organisation?.Name || user?.organisation?.name].filter(Boolean).join(' · ') || user?.UserName}</Text>
                </View>
            </LinearGradient>

            {error ? <Notice tone="error">{error}</Notice> : null}

            <SectionTitle title="Attendance today" />
            <Card style={{ marginBottom: space(1.5) }}>
                {!today ? (
                    <View style={{ gap: 8 }}>
                        <Skeleton width="40%" />
                        <Skeleton width="60%" height={20} />
                    </View>
                ) : !today.checkIn ? (
                    <Text style={text.body}>Not checked in yet. Starting your day on the Today tab checks you in.</Text>
                ) : (
                    <>
                        <View style={styles.times}>
                            <View style={{ flex: 1 }}>
                                <Text style={text.small}>Checked in</Text>
                                <Text style={text.title}>{today.checkIn.time}</Text>
                                {today.checkIn.time > today.lateAfter ? <Tag label="Late" tone="warning" /> : null}
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={text.small}>Checked out</Text>
                                <Text style={text.title}>{today.checkOut?.time || '—'}</Text>
                            </View>
                        </View>
                        {!today.checkOut && <Button title="Check out" icon="log-out" variant="outline" onPress={checkOut} busy={busy} style={{ marginTop: space(1.5) }} />}
                    </>
                )}
            </Card>

            {summary && (
                <View style={styles.stats}>
                    <StatTile icon="calendar" label="Present this month" value={`${summary.present}`} caption={`${summary.late} late · ${summary.leave} leave`} tone="success" />
                    <StatTile icon="x-circle" label="Absent" value={`${summary.absent}`} caption={summary.avgHours != null ? `Avg ${summary.avgHours} h a day` : undefined} tone={summary.absent ? 'error' : 'brand'} />
                </View>
            )}

            <SectionTitle title="Leave" caption={leave ? `Balances for ${leave.year}. Sundays are not counted.` : undefined} />
            {leave?.balances?.length ? (
                <View style={styles.balances}>
                    {leave.balances.map((b) => (
                        <Card key={b.LeaveTypeId} style={styles.balance}>
                            <Text style={text.small} numberOfLines={1}>{b.Name}</Text>
                            <Text style={text.metric}>{b.IsPaid ? b.available : '—'}</Text>
                            <Text style={text.small}>{b.IsPaid ? `of ${b.AnnualQuota} left` : 'Unpaid'}</Text>
                        </Card>
                    ))}
                </View>
            ) : null}
            <Button title="Apply for leave" icon="plus" onPress={() => navigation.navigate('ApplyLeave', { balances: leave?.balances || [] })} disabled={!leave?.balances?.length} style={{ marginBottom: space(1.5) }} />

            {mine.length > 0 && (
                <View style={{ gap: space(1) }}>
                    {mine.map((row) => (
                        <Card key={row.LeaveId} style={styles.leaveRow}>
                            <View style={{ flex: 1 }}>
                                <Text style={text.subtitle}>{row.LeaveName}</Text>
                                <Text style={text.small}>
                                    {row.FromDate === row.ToDate ? shortDate(row.FromDate) : `${shortDate(row.FromDate)} – ${shortDate(row.ToDate)}`} · {row.HalfDay ? 'Half day' : `${row.Days} day${row.Days === 1 ? '' : 's'}`}
                                </Text>
                                {row.ReviewRemarks ? <Text style={text.small}>Manager: “{row.ReviewRemarks}”</Text> : null}
                            </View>
                            <View style={{ alignItems: 'flex-end', gap: 6 }}>
                                <Tag label={LEAVE_STATUS[row.Status]?.label || row.Status} tone={LEAVE_STATUS[row.Status]?.tone || 'neutral'} />
                                {row.canCancel && <Button title="Cancel" variant="ghost" small onPress={() => cancel(row)} />}
                            </View>
                        </Card>
                    ))}
                </View>
            )}

            <Button title="Sign out" icon="log-out" variant="danger" onPress={signOut} style={{ marginTop: space(4) }} />
            <Text style={[text.small, { textAlign: 'center', marginTop: space(1.5) }]}>Pharmalyx field app · managers and admin use the web app</Text>
        </Screen>
    );
}

const styles = StyleSheet.create({
    profile: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), padding: space(2), borderRadius: radius.xl, marginBottom: space(1) },
    avatar: { width: 52, height: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.heavy, fontSize: 20, color: colors.white },
    name: { fontFamily: fonts.display, fontSize: 21, color: colors.white },
    meta: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.72)', marginTop: 2 },
    times: { flexDirection: 'row', gap: space(2) },
    stats: { flexDirection: 'row', gap: space(1.5), marginBottom: space(1) },
    balances: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.25), marginBottom: space(1.5) },
    balance: { flexGrow: 1, minWidth: 100, padding: space(1.5) },
    leaveRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), padding: space(1.5) },
});
