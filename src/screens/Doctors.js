import { useMemo, useState } from 'react';
import { StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { getDoctorsOf, getMyTeam } from '../api';
import { VERIFICATION_STATE } from '../doctorLabels';
import { doctorName, initial, titleCase } from '../format';
import { usePermissions } from '../permissions';
import { colors, fonts, radius, space, text } from '../theme';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Header, ListRow, Loadable, Screen, Select, Tag } from '../ui';

const FILTERS = [
    { value: 'ALL', label: 'All' },
    { value: 'A', label: 'Class A' },
    { value: 'B', label: 'Class B' },
    { value: 'C', label: 'Class C' },
    { value: 'PROVISIONAL', label: 'Not verified' },
];

// Doctors mapped to me (or, for a manager, to someone in my team). Tap a doctor for details and actions.
export default function Doctors({ navigation }) {
    const permissions = usePermissions();
    const team = useLoad(() => getMyTeam(), [], "Couldn't load your team.");
    const [person, setPerson] = useState(null);
    const people = team.data?.team || [];
    const me = people.find((p) => p.IsSelf);
    const viewing = person || me?.UserId;
    const state = useLoad(() => (viewing ? getDoctorsOf(viewing) : Promise.resolve({ doctors: [] })), [viewing], "Couldn't load the doctors.");
    const [query, setQuery] = useState('');
    const [filter, setFilter] = useState('ALL');
    const own = !person || person === me?.UserId;

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (state.data?.doctors || []).filter(
            (d) =>
                (filter === 'ALL' || (filter === 'PROVISIONAL' ? d.VerificationStatus === 'PROVISIONAL' : d.Category === filter)) &&
                (!q || `${d.DoctorName} ${d.Speciality || ''} ${d.AreaName || ''} ${d.HospitalName || ''}`.toLowerCase().includes(q))
        );
    }, [state.data, query, filter]);

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header
                overline={own ? 'My doctors' : 'Team doctors'}
                title={state.data ? `${state.data.doctors.length} doctors` : 'Doctors'}
                onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined}
                right={own && permissions.has('doctorrequests.create') ? <Button title="Add" icon="plus" small onPress={() => navigation.navigate('AddDoctor')} /> : null}
            />

            {people.length > 1 && (
                <Select
                    label="Showing doctors of"
                    value={viewing}
                    options={people.map((p) => ({ value: p.UserId, label: p.IsSelf ? `${titleCase(p.Name)} (me)` : titleCase(p.Name), detail: p.DesignationName }))}
                    onChange={setPerson}
                    icon="user"
                />
            )}

            {permissions.any(['doctorrequests.create', 'doctorrequests.approve']) && (
                <Card style={{ padding: 0, marginBottom: space(1.5) }}>
                    <ListRow icon="user-check" title="Doctor requests & verification" caption="New doctors, edits, removals and proofs" onPress={() => navigation.navigate('DoctorRequests')} />
                </Card>
            )}

            <View style={styles.search}>
                <Feather name="search" size={16} color={colors.inkMuted} />
                <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search name, speciality, area" placeholderTextColor={colors.inkFaint} autoCorrect={false} autoCapitalize="none" />
            </View>
            <Chips options={FILTERS} value={filter} onChange={setFilter} />

            <Loadable state={state} rows={6}>
                {(data) =>
                    shown.length === 0 ? (
                        <Card>
                            <Empty icon="users" title={data.doctors.length ? 'No doctor matches' : 'No doctors assigned yet'} caption={data.doctors.length ? 'Try another search or filter.' : 'Doctors are mapped in Configuration on the web, or added at the clinic.'} />
                            {data.doctors.length ? (
                                <Button
                                    title="Clear search"
                                    variant="ghost"
                                    onPress={() => {
                                        setQuery('');
                                        setFilter('ALL');
                                    }}
                                />
                            ) : own && permissions.has('doctorrequests.create') ? (
                                <Button title="Add a doctor" icon="user-plus" variant="outline" onPress={() => navigation.navigate('AddDoctor')} />
                            ) : null}
                        </Card>
                    ) : (
                        <View style={{ gap: space(1.25) }}>
                            {shown.map((d) => {
                                const verify = VERIFICATION_STATE[d.VerificationStatus];
                                return (
                                    <Pressable key={d.DoctorId} onPress={() => navigation.navigate('DoctorDetail', { doctor: d, own })} accessibilityRole="button">
                                        {({ pressed }) => (
                                            <Card style={[styles.row, pressed && { backgroundColor: colors.jadeWash }]}>
                                                <View style={styles.avatar}>
                                                    <Text style={styles.avatarText}>{initial(d.DoctorName)}</Text>
                                                </View>
                                                <View style={{ flex: 1, minWidth: 0 }}>
                                                    <Text style={text.subtitle} numberOfLines={1}>
                                                        {doctorName(d.DoctorName)}
                                                    </Text>
                                                    <Text style={text.small} numberOfLines={1}>
                                                        {[titleCase(d.Speciality), titleCase(d.HospitalName), titleCase(d.AreaName)].filter(Boolean).join(' · ')}
                                                    </Text>
                                                    <View style={styles.tags}>
                                                        {d.Category ? <Tag label={`Class ${d.Category}`} tone="primary" /> : null}
                                                        {verify && d.VerificationStatus !== 'VERIFIED' ? <Tag label={verify.label} tone={verify.tone} /> : null}
                                                        {d.ClinicLatitude == null ? <Tag label="Clinic not pinned" tone="warning" /> : null}
                                                    </View>
                                                </View>
                                                <Feather name="chevron-right" size={18} color={colors.inkFaint} />
                                            </Card>
                                        )}
                                    </Pressable>
                                );
                            })}
                        </View>
                    )
                }
            </Loadable>
        </Screen>
    );
}

const styles = StyleSheet.create({
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 46, marginBottom: space(1.5) },
    searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink, paddingVertical: 8 },
    row: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), padding: space(1.5) },
    avatar: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.jadeMist, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.bold, fontSize: 16, color: colors.jadeDark },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 6 },
});
