import { useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { getToday } from '../api';
import { doctorName, plural, titleCase } from '../format';
import { colors, fonts, radius, space, text } from '../theme';
import useLoad from '../useLoad';
import { Button, Card, Empty, Header, ListRow, Loadable, Screen, SectionTitle, Tag } from '../ui';

// The center "Check in" button: pick the doctor you are with, then the usual visit check-in opens.
export default function CheckIn({ navigation }) {
    const state = useLoad(() => getToday(), [], "Couldn't load today's doctors.");
    const [query, setQuery] = useState('');
    const q = query.trim().toLowerCase();

    const lists = useMemo(() => {
        const d = state.data;
        if (!d) return null;
        const match = (doc) => !q || `${doc.DoctorName} ${doc.AreaName || ''} ${doc.Speciality || ''}`.toLowerCase().includes(q);
        return { plan: d.plan.filter(match), other: d.otherDue.filter(match) };
    }, [state.data, q]);

    const go = (doctor) => {
        const d = state.data;
        const start = () => navigation.replace('Visit', { doctor, date: d.date, rules: d.rules });
        if (doctor.clinicPinned) return start();
        Alert.alert('Clinic not pinned yet', `${doctorName(doctor.DoctorName)}'s clinic location isn't saved, so the app can't confirm you are there. The visit still counts but will be marked "needs a look" for your manager.`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Check in anyway', onPress: start },
        ]);
    };

    const row = (doc) => (
        <ListRow
            key={doc.DoctorId}
            icon="map-pin"
            title={doctorName(doc.DoctorName)}
            caption={[titleCase(doc.Speciality), titleCase(doc.AreaName), `${plural(doc.remaining, 'visit')} left`].filter(Boolean).join(' · ')}
            right={!doc.clinicPinned ? <Tag label="Not pinned" tone="warning" /> : doc.timing?.slot ? <Tag label={doc.timing.label.replace('Usually available: ', '')} tone="info" /> : null}
            onPress={() => go(doc)}
        />
    );

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Check in" title="Who are you visiting?" onBack={() => navigation.goBack()} />
            <Loadable state={state} rows={6}>
                {(d) =>
                    !d.consent?.accepted || !d.workDay ? (
                        <Card>
                            <Empty icon="play" title="Start your day first" caption="Starting your day checks you in for attendance and starts the location trail for TA." />
                            <Button title="Open My Day" icon="sun" onPress={() => navigation.replace('Today')} />
                        </Card>
                    ) : (
                        <>
                            <View style={styles.search}>
                                <Feather name="search" size={16} color={colors.inkMuted} />
                                <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search doctor, area, speciality" placeholderTextColor={colors.inkFaint} autoCorrect={false} autoCapitalize="none" autoFocus={false} />
                            </View>
                            {lists.plan.length ? (
                                <>
                                    <SectionTitle title={d.planned?.areaName ? `Today's plan · ${titleCase(d.planned.areaName)}` : "Today's plan"} />
                                    <Card style={styles.list}>{lists.plan.map((doc, i) => <View key={doc.DoctorId} style={i > 0 && styles.line}>{row(doc)}</View>)}</Card>
                                </>
                            ) : null}
                            {lists.other.length ? (
                                <>
                                    <SectionTitle title="Also due in your territory" />
                                    <Card style={styles.list}>{lists.other.map((doc, i) => <View key={doc.DoctorId} style={i > 0 && styles.line}>{row(doc)}</View>)}</Card>
                                </>
                            ) : null}
                            {!lists.plan.length && !lists.other.length ? (
                                <Card>
                                    <Empty icon="users" title={q ? 'No doctor matches' : 'No doctors due today'} caption="Met a new doctor? Add them at the clinic." />
                                    <Button title="Add a doctor" icon="user-plus" variant="outline" onPress={() => navigation.replace('AddDoctor')} />
                                </Card>
                            ) : null}
                            <Text style={[text.small, { textAlign: 'center', marginTop: space(2) }]}>Your location is checked against the clinic when you check in.</Text>
                        </>
                    )
                }
            </Loadable>
        </Screen>
    );
}

const styles = StyleSheet.create({
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, minHeight: 46, marginBottom: space(1) },
    searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink, paddingVertical: 8 },
    list: { padding: 0, overflow: 'hidden' },
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
});
