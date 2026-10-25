import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { api, monthKey } from '../api';
import { doctorName, plural, titleCase } from '../format';
import { PersonPicker, usePeople } from '../people';
import { colors, space } from '../theme';
import useLoad from '../useLoad';
import { Card, Chips, Empty, Header, ListRow, Loadable, MonthSwitcher, Screen, SectionTitle, StatGrid, Tag } from '../ui';
import { RESULT } from './MyDay';

export const FEEDBACK = { POSITIVE: { label: 'Positive', tone: 'success' }, NEUTRAL: { label: 'Neutral', tone: 'info' }, NEGATIVE: { label: 'Negative', tone: 'error' } };
export const PLAN_STATUS = {
    IN_PLAN: { label: 'As planned', tone: 'success' },
    OUT_OF_PLAN: { label: 'Out of plan', tone: 'warning' },
    OFF_DAY: { label: 'On a planned off day', tone: 'warning' },
    NO_PLAN: { label: 'No tour plan', tone: 'info' },
};
const monthEnd = (month) => {
    const [y, m] = month.split('-').map(Number);
    const last = new Date(y, m, 0).getDate();
    return `${month}-${String(last).padStart(2, '0')}`;
};
const dayHeading = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

// Visit history by month (mine or a team member's), grouped by day, plus follow-ups due.
export default function Visits({ navigation }) {
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [month, setMonth] = useState(monthKey());
    const [filter, setFilter] = useState('ALL');
    const state = useLoad(
        async () => {
            const params = { userId: userId || undefined, from: `${month}-01`, to: month === monthKey() ? undefined : monthEnd(month) };
            const [visits, followUps] = await Promise.all([api.get('/app/visits', { params }), api.get('/app/visits/follow-ups', { params: { userId: userId || undefined } }).catch(() => ({ data: { followUps: [] } }))]);
            return { visits: visits.data.visits || [], followUps: followUps.data.followUps || [] };
        },
        [userId, month],
        "Couldn't load visits."
    );

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Field operations" title="Visits" onBack={() => navigation.goBack()} />
            <PersonPicker people={people} value={userId} onChange={setUserId} />
            <MonthSwitcher value={month} onChange={setMonth} />
            <Chips
                options={[
                    { value: 'ALL', label: 'All' },
                    { value: 'VALID', label: 'Counted' },
                    { value: 'REVIEW', label: 'Needs a look' },
                    { value: 'INVALID', label: 'Not counted' },
                ]}
                value={filter}
                onChange={setFilter}
            />
            <Loadable state={state} rows={6}>
                {(data) => {
                    const visits = data.visits.filter((v) => filter === 'ALL' || v.FinalValidity === filter);
                    const days = [...new Set(visits.map((v) => v.VisitDate))];
                    const doctors = new Set(data.visits.map((v) => v.DoctorId)).size;
                    return (
                        <>
                            <StatGrid
                                items={[
                                    { icon: 'map-pin', label: 'Visits', value: `${data.visits.length}`, caption: `${plural(doctors, 'doctor')}` },
                                    { icon: 'check-circle', label: 'Counted', value: `${data.visits.filter((v) => v.FinalValidity === 'VALID' || v.FinalValidity === 'REVIEW').length}`, caption: `${data.visits.filter((v) => v.FinalValidity === 'REVIEW').length} need a look`, tone: 'success' },
                                ]}
                            />
                            {data.followUps.length > 0 && (
                                <>
                                    <SectionTitle title="Follow-ups" caption="Doctors you promised to see again" />
                                    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1) }}>
                                        {data.followUps.slice(0, 6).map((f, i) => (
                                            <View key={f.VisitId} style={i > 0 && styles.line}>
                                                <ListRow icon="bell" tone="info" title={doctorName(f.DoctorName)} caption={`Due ${f.FollowUpDate}`} onPress={() => navigation.navigate('VisitDetail', { visitId: f.VisitId })} />
                                            </View>
                                        ))}
                                    </Card>
                                </>
                            )}
                            {days.length ? (
                                days.map((day) => (
                                    <View key={day}>
                                        <SectionTitle title={dayHeading(day)} caption={plural(visits.filter((v) => v.VisitDate === day).length, 'visit')} />
                                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                                            {visits
                                                .filter((v) => v.VisitDate === day)
                                                .map((v, i) => {
                                                    const result = RESULT[v.FinalValidity];
                                                    return (
                                                        <View key={v.VisitId} style={i > 0 && styles.line}>
                                                            <ListRow
                                                                title={doctorName(v.DoctorName)}
                                                                caption={[v.StartTime && `${v.StartTime}${v.EndTime ? `–${v.EndTime}` : ''}`, titleCase(v.AreaName), v.Explanation?.Status === 'PENDING' && 'explained'].filter(Boolean).join(' · ')}
                                                                right={result ? <Tag label={result.label.replace('Counted · ', '')} tone={result.tone} /> : null}
                                                                onPress={() => navigation.navigate('VisitDetail', { visitId: v.VisitId })}
                                                            />
                                                        </View>
                                                    );
                                                })}
                                        </Card>
                                    </View>
                                ))
                            ) : (
                                <Card>
                                    <Empty icon="map-pin" title="No visits in this period" caption={filter === 'ALL' ? 'Visits saved from My Day show here.' : 'Try another filter.'} />
                                </Card>
                            )}
                        </>
                    );
                }}
            </Loadable>
        </Screen>
    );
}

const styles = StyleSheet.create({
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
});

