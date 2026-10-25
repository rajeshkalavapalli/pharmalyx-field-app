import { useCallback, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { acceptAllowancePolicy, errorMessage, getStatement, monthKey, rupees, sendDayReason } from '../api';
import { colors, space, text } from '../theme';
import { toast } from '../toast';
import { Button, Card, Empty, ErrorState, Header, ReasonDialog, Screen, SectionTitle, SkeletonList, StatTile, Tag } from '../ui';

// Where a day stands, in the words the employee sees (same as the web app).
const DAY_STATUS = {
    EARNED: { label: 'Earned', tone: 'success' },
    ON_HOLD: { label: 'On hold', tone: 'warning' },
    PAYABLE: { label: 'Payable after review', tone: 'success' },
    NOT_PAYABLE: { label: 'Not payable', tone: 'error' },
};
const REVIEW_STEP = {
    HELD: 'Waiting for your reason',
    WITH_MANAGER: 'With your manager',
    WITH_ADMIN: 'With head office',
    PAYABLE: 'Decided: payable',
    NOT_PAYABLE: 'Decided: not payable',
};
const STATION = { HQ: 'HQ', EX_HQ: 'Ex-HQ', OUTSTATION: 'Outstation' };

const dayLabel = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short' });
const shiftMonth = (key, by) => {
    const [y, m] = key.split('-').map(Number);
    return monthKey(new Date(y, m - 1 + by, 1));
};
const monthLabel = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

// The employee's own TA / DA, day by day: amounts, status, the reason for any hold, running total.
export default function Allowance({ navigation }) {
    const [month, setMonth] = useState(monthKey());
    const [data, setData] = useState(null);
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const [explaining, setExplaining] = useState(null); // statement row
    const [accepting, setAccepting] = useState(false);

    const load = useCallback(async () => {
        setError('');
        try {
            setData(await getStatement(month));
        } catch (err) {
            setError(errorMessage(err, "Couldn't load your TA / DA."));
        } finally {
            setRefreshing(false);
        }
    }, [month]);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    const accept = async () => {
        setAccepting(true);
        try {
            await acceptAllowancePolicy();
            await load();
            toast('Policy accepted');
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setAccepting(false);
        }
    };

    const send = async (reason) => {
        try {
            const response = await sendDayReason(explaining.review.ReviewId, reason);
            setExplaining(null);
            toast(response?.message || 'Sent. Your manager will review it.');
            load();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    const t = data?.totals;
    const policy = data?.policy;
    const rows = data ? [...data.rows].reverse() : []; // latest day first

    return (
        <Screen refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={colors.jade} />}>
            <Header overline="TA / DA" title={monthLabel(month)} onBack={() => navigation.goBack()} />
            <View style={styles.monthRow}>
                <Button title="Previous" icon="chevron-left" variant="ghost" small onPress={() => { setData(null); setMonth((m) => shiftMonth(m, -1)); }} />
                <Button title="Next" variant="ghost" small disabled={month === monthKey()} onPress={() => { setData(null); setMonth((m) => shiftMonth(m, 1)); }} />
            </View>

            {error && data ? <Text style={[text.small, { color: colors.errorDark, marginBottom: space(1) }]}>{error}</Text> : null}

            {policy && !policy.accepted?.current && (
                <Card style={{ marginBottom: space(2) }}>
                    <Text style={text.title}>
                        {policy.title} (version {policy.version}){policy.accepted ? ' has been updated' : ''}
                    </Text>
                    <View style={{ marginVertical: space(1.5), gap: 4 }}>
                        {policy.points.map((point) => (
                            <Text key={point} style={text.body}>
                                • {point}
                            </Text>
                        ))}
                    </View>
                    <Button title="I accept" icon="check" onPress={accept} busy={accepting} />
                </Card>
            )}

            {t && (
                <>
                    <View style={styles.stats}>
                        <StatTile icon="check-circle" label="Earned so far" value={rupees(t.earned)} tone="success" />
                        <StatTile icon="clock" label="On hold" value={rupees(t.onHold)} caption="Waiting for review" tone="warning" />
                    </View>
                    <View style={styles.stats}>
                        <StatTile icon="credit-card" label="If approved" value={rupees(t.ifApproved)} caption="Earned + on hold" />
                        <StatTile icon="x-circle" label="Not payable" value={rupees(t.notPayable)} tone="error" />
                    </View>
                </>
            )}

            <SectionTitle title="Day by day" caption={data ? `DA needs ${data.daMinValidVisits} counted visits a day. A day on hold is not cut: you see why, and you can send your reason.` : undefined} />

            {!data && error ? (
                <ErrorState message={error} onRetry={load} />
            ) : !data ? (
                <SkeletonList rows={4} />
            ) : !rows.length ? (
                <Empty icon="calendar" title="No working days yet this month" caption="Each day you start in the field shows here with its TA and DA." />
            ) : (
                <View style={{ gap: space(1.25) }}>
                    {rows.map((row) => {
                        const status = DAY_STATUS[row.status];
                        const review = row.review;
                        return (
                            <Card key={row.date} style={{ padding: space(1.5) }}>
                                <View style={styles.top}>
                                    <Text style={[text.subtitle, { flex: 1 }]}>{dayLabel(row.date)}</Text>
                                    <Text style={text.subtitle}>{rupees(row.total)}</Text>
                                </View>
                                <Text style={text.small}>
                                    {`${row.visits} visit${row.visits === 1 ? '' : 's'} · ${row.km} km · ${STATION[row.station] || row.station || '—'} · DA ${rupees(row.da)} · TA ${rupees(row.ta)}`}
                                </Text>
                                <View style={styles.tags}>{status ? <Tag label={status.label} tone={status.tone} /> : null}</View>

                                {review && (
                                    <View style={styles.review}>
                                        {review.Findings.map((finding) => (
                                            <Text key={finding.code} style={text.small}>
                                                • {finding.text}
                                            </Text>
                                        ))}
                                        <Text style={[text.small, { color: colors.ink, marginTop: 4 }]}>{REVIEW_STEP[review.Status]}</Text>
                                        {review.EmployeeReason ? <Text style={text.small}>Your reason: “{review.EmployeeReason}”</Text> : null}
                                        {review.ManagerComment ? <Text style={text.small}>{review.ManagerName || 'Manager'}: “{review.ManagerComment}”</Text> : null}
                                        {review.DaGranted ? <Tag label="DA granted by head office" tone="success" /> : null}
                                        {review.AdminComment ? <Text style={text.small}>Head office: “{review.AdminComment}”</Text> : null}
                                        {review.AutoNote ? <Text style={[text.small, { fontStyle: 'italic' }]}>{review.AutoNote}</Text> : null}
                                        {row.canSendReason && <Button title="Send my reason" icon="message-square" small variant="outline" onPress={() => setExplaining(row)} style={{ marginTop: space(1) }} />}
                                    </View>
                                )}
                                <Text style={[text.small, { marginTop: 6 }]}>Earned so far this month: {rupees(row.earnedSoFar)}</Text>
                            </Card>
                        );
                    })}
                </View>
            )}

            <ReasonDialog
                visible={Boolean(explaining)}
                title={explaining ? `Your reason for ${dayLabel(explaining.date)}` : ''}
                caption="Your manager reviews it. If your manager approves, head office makes the final decision."
                label="What happened that day?"
                onSubmit={send}
                onClose={() => setExplaining(null)}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    monthRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -space(1.5), marginBottom: space(1.5) },
    stats: { flexDirection: 'row', gap: space(1.5), marginBottom: space(1.5) },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    tags: { flexDirection: 'row', gap: 6, marginTop: 6 },
    review: { marginTop: space(1), padding: space(1.25), borderRadius: 10, backgroundColor: colors.warningSoft + '80', gap: 2 },
});
