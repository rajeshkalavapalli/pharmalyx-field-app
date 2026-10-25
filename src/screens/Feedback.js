import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, monthKey } from '../api';
import { doctorName, titleCase } from '../format';
import { PersonPicker, usePeople } from '../people';
import { colors, space, text } from '../theme';
import useLoad from '../useLoad';
import { Card, Empty, Header, ListRow, Loadable, MonthSwitcher, Screen, SectionTitle, StatGrid, Tag } from '../ui';

// Doctor feedback from visits: overall sentiment, per doctor, and doctors who need attention.
export default function Feedback({ navigation }) {
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [month, setMonth] = useState(monthKey());
    const state = useLoad(async () => (await api.get('/app/feedback', { params: { userId: userId || undefined, month } })).data, [userId, month], "Couldn't load feedback.");

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Doctor engagement" title="Feedback" onBack={() => navigation.goBack()} />
            <PersonPicker people={people} value={userId} onChange={setUserId} />
            <MonthSwitcher value={month} onChange={setMonth} />
            <Loadable state={state} rows={5}>
                {(data) => {
                    const s = data.summary;
                    return (
                        <>
                            <StatGrid
                                items={[
                                    { icon: 'smile', label: 'Net sentiment', value: s.netScore == null ? '—' : `${s.netScore > 0 ? '+' : ''}${s.netScore}`, caption: `${s.rated} of ${s.visits} calls rated`, tone: s.netScore >= 0 ? 'success' : 'error' },
                                    { icon: 'thumbs-up', label: 'Positive / negative', value: `${s.positive}/${s.negative}`, caption: `${s.neutral} neutral`, tone: 'info' },
                                ]}
                            />
                            {(data.attention || []).length ? (
                                <>
                                    <SectionTitle title="Needs attention" caption="Negative feedback or follow-ups" />
                                    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.5) }}>
                                        {data.attention.map((a, i) => (
                                            <View key={`${a.VisitId || a.DoctorId}-${i}`} style={i > 0 && styles.line}>
                                                <ListRow icon="alert-circle" tone="error" title={doctorName(a.DoctorName)} caption={[a.VisitDate, a.Notes && `“${a.Notes}”`, a.FollowUpDate && `follow up ${a.FollowUpDate}`].filter(Boolean).join(' · ')} onPress={a.VisitId ? () => navigation.navigate('VisitDetail', { visitId: a.VisitId }) : undefined} />
                                            </View>
                                        ))}
                                    </Card>
                                </>
                            ) : null}
                            <SectionTitle title="By doctor" />
                            {data.doctors.length ? (
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    {data.doctors.map((d, i) => (
                                        <View key={d.DoctorId} style={i > 0 && styles.line}>
                                            <ListRow
                                                title={doctorName(d.DoctorName)}
                                                caption={[titleCase(d.Speciality), `${d.Visits} visits`, d.LatestFeedback && `latest ${titleCase(d.LatestFeedback)}`].filter(Boolean).join(' · ')}
                                                right={
                                                    <View style={{ flexDirection: 'row', gap: 4 }}>
                                                        {d.Positive ? <Tag label={`+${d.Positive}`} tone="success" /> : null}
                                                        {d.Negative ? <Tag label={`−${d.Negative}`} tone="error" /> : null}
                                                    </View>
                                                }
                                                chevron={false}
                                            />
                                        </View>
                                    ))}
                                </Card>
                            ) : (
                                <Card>
                                    <Empty icon="message-circle" title="No feedback this month" caption="Choose Positive / Neutral / Negative when you save a visit." />
                                </Card>
                            )}
                        </>
                    );
                }}
            </Loadable>
            <Text style={[text.small, { marginTop: space(2) }]}>Net sentiment = % positive minus % negative among rated calls.</Text>
        </Screen>
    );
}

const styles = StyleSheet.create({
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
});
