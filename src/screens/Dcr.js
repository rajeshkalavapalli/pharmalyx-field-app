import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, monthKey } from '../api';
import { titleCase } from '../format';
import { PersonPicker, usePeople } from '../people';
import { usePermissions } from '../permissions';
import { colors } from '../theme';
import useLoad from '../useLoad';
import { Card, Chips, Empty, Header, ListRow, Loadable, MonthSwitcher, Screen, StatGrid, Tag } from '../ui';

export const DCR_STATUS = {
    APPROVED: { label: 'Approved', tone: 'success' },
    SUBMITTED: { label: 'Sent for review', tone: 'info' },
    RETURNED: { label: 'Returned', tone: 'error' },
    DUE: { label: 'Due', tone: 'primary' },
    MISSED: { label: 'Missed', tone: 'error' },
    OFF: { label: 'Off day', tone: 'neutral' },
    NO_ACTIVITY: { label: 'No activity', tone: 'neutral' },
    UPCOMING: { label: 'Upcoming', tone: 'neutral' },
};
const dayLabel = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

function MonthTab({ navigation }) {
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [month, setMonth] = useState(monthKey());
    const state = useLoad(async () => (await api.get('/app/dcr/month', { params: { month: `${month}-01`, userId: userId || undefined } })).data, [month, userId], "Couldn't load DCRs.");

    return (
        <>
            <PersonPicker people={people} value={userId} onChange={setUserId} />
            <MonthSwitcher value={month} onChange={setMonth} />
            <Loadable state={state} rows={6}>
                {(data) => {
                    const s = data.summary;
                    const days = data.days.filter((d) => d.status !== 'UPCOMING').reverse();
                    return (
                        <>
                            <StatGrid
                                items={[
                                    { icon: 'check-circle', label: 'Approved', value: `${s.approved}`, caption: `${s.submitted} waiting review`, tone: 'success' },
                                    { icon: 'alert-circle', label: 'Due / missed', value: `${s.due}/${s.missed}`, caption: `${s.returned} returned · send within ${data.deadlineDays} days`, tone: s.missed ? 'error' : 'warning' },
                                ]}
                            />
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {days.length ? (
                                    days.map((d, i) => {
                                        const st = DCR_STATUS[d.status];
                                        return (
                                            <View key={d.date} style={i > 0 && styles.line}>
                                                <ListRow
                                                    title={dayLabel(d.date)}
                                                    caption={[d.plan?.DayType === 'non-working' ? 'Off day' : [titleCase(d.plan?.TerritoryName), titleCase(d.plan?.AreaName)].filter(Boolean).join(' · ') || 'No tour plan', `${d.visitCount} visit(s)`, d.distanceKm != null && `${d.distanceKm} km`].filter(Boolean).join(' · ')}
                                                    right={st ? <Tag label={st.label} tone={st.tone} /> : null}
                                                    onPress={() => navigation.navigate('DcrDay', { date: d.date, userId })}
                                                />
                                            </View>
                                        );
                                    })
                                ) : (
                                    <Empty icon="file-text" title="No days yet this month" />
                                )}
                            </Card>
                        </>
                    );
                }}
            </Loadable>
        </>
    );
}

function ReviewsTab({ navigation }) {
    const state = useLoad(async () => (await api.get('/app/dcr/reviews')).data, [], "Couldn't load DCRs to review.");
    return (
        <Loadable state={state}>
            {(data) =>
                data.reviews.length ? (
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {data.reviews.map((r, i) => (
                            <View key={r.DcrId} style={i > 0 && styles.line}>
                                <ListRow
                                    icon="file-text"
                                    title={titleCase(r.UserName)}
                                    caption={`${dayLabel(r.ReportDate)} · ${r.VisitCount} visit(s) · ${r.DistanceKm} km`}
                                    right={<Tag label="Review" tone="warning" />}
                                    onPress={() => navigation.navigate('DcrDay', { date: r.ReportDate, userId: r.UserId })}
                                />
                            </View>
                        ))}
                    </Card>
                ) : (
                    <Card>
                        <Empty icon="check-circle" title="No DCRs waiting" caption="DCRs your team sends appear here for approval." />
                    </Card>
                )
            }
        </Loadable>
    );
}

// Daily call reports: my month (or a team member's), and DCRs waiting for my review.
export default function Dcr({ navigation, route }) {
    const permissions = usePermissions();
    const canReview = permissions.has('dcr.approve');
    const [tab, setTab] = useState(route.params?.tab === 'reviews' && canReview ? 'reviews' : 'month');

    return (
        <Screen>
            <Header overline="Field operations" title="DCR" onBack={() => navigation.goBack()} />
            {canReview ? (
                <Chips
                    options={[
                        { value: 'month', label: 'Calendar' },
                        { value: 'reviews', label: 'To review' },
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            ) : null}
            {tab === 'month' ? <MonthTab navigation={navigation} /> : <ReviewsTab navigation={navigation} />}
        </Screen>
    );
}

const styles = StyleSheet.create({
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
});

