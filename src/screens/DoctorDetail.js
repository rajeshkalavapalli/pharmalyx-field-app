import { Linking, StyleSheet, Text, View } from 'react-native';

import { VERIFICATION_STATE, deadlineLabel, shortDate } from '../doctorLabels';
import { doctorName, titleCase } from '../format';
import { usePermissions } from '../permissions';
import { colors, space, text } from '../theme';
import { Button, Card, Header, KeyValue, ListRow, Notice, Screen, SectionTitle, Tag } from '../ui';

const daysUntil = (dueOn) => (dueOn ? Math.round((new Date(`${dueOn}T00:00:00`) - new Date(new Date().toDateString())) / 86400000) : null);

// One doctor: details, clinic location, verification, and the actions the person may take.
export default function DoctorDetail({ navigation, route }) {
    const { doctor: d, own } = route.params;
    const permissions = usePermissions();
    const verify = VERIFICATION_STATE[d.VerificationStatus];
    const provisional = d.VerificationStatus === 'PROVISIONAL';
    const due = deadlineLabel(daysUntil(d.VerificationDueOn));
    const canRequest = own && permissions.has('doctorrequests.create');

    return (
        <Screen>
            <Header overline={titleCase(d.Speciality) || 'Doctor'} title={doctorName(d.DoctorName)} onBack={() => navigation.goBack()} />
            <View style={styles.tags}>
                {d.Category ? <Tag label={`Class ${d.Category}`} tone="primary" /> : null}
                {verify ? <Tag label={verify.label} tone={verify.tone} /> : null}
                {provisional ? <Tag label={due.label} tone={due.tone} /> : null}
                {d.ClinicLatitude == null ? <Tag label="Clinic not pinned" tone="warning" /> : null}
            </View>

            {provisional && own ? (
                <Notice tone="warning" title="Verify this doctor">
                    {`Send a proof (registration no., phone, or prescription pad / visiting card photo) by ${shortDate(d.VerificationDueOn)}.`}
                </Notice>
            ) : null}

            <Card style={{ marginBottom: space(1.5) }}>
                <KeyValue
                    rows={[
                        ['Qualification', d.Qualification],
                        ['Clinic / hospital', titleCase(d.HospitalName)],
                        ['Area', [titleCase(d.AreaName), titleCase(d.TerritoryName)].filter(Boolean).join(', ')],
                        ['Phone', d.MobileNumber],
                        ['Email', d.EmailId],
                        ['Visits / month', d.VisitsPerMonth],
                        d.DateOfBirth && ['Birthday', shortDate(d.DateOfBirth)],
                        d.AnniversaryDate && ['Anniversary', shortDate(d.AnniversaryDate)],
                        d.AssignedOn && ['Assigned since', shortDate(d.AssignedOn)],
                    ]}
                />
            </Card>

            <View style={styles.actions}>
                {d.MobileNumber ? <Button title="Call" icon="phone" variant="outline" onPress={() => Linking.openURL(`tel:${d.MobileNumber}`)} style={{ flex: 1 }} /> : null}
                {d.ClinicLatitude != null ? (
                    <Button title="Directions" icon="navigation" variant="outline" onPress={() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${d.ClinicLatitude},${d.ClinicLongitude}`)} style={{ flex: 1 }} />
                ) : null}
            </View>

            {(canRequest || (provisional && own)) && (
                <>
                    <SectionTitle title="Actions" caption="Changes go to your manager first." />
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {provisional && own ? <ListRow icon="shield" tone="warning" title="Send verification proof" onPress={() => navigation.navigate('VerifyDoctor', { doctor: { ...d, DaysLeft: daysUntil(d.VerificationDueOn) } })} /> : null}
                        {canRequest ? (
                            <View style={styles.line}>
                                <ListRow icon="edit-2" title="Edit details" caption="Name, phone, area, class, clinic location" onPress={() => navigation.navigate('DoctorChange', { doctor: d, initialType: 'EDIT' })} />
                            </View>
                        ) : null}
                        {canRequest ? (
                            <View style={styles.line}>
                                <ListRow icon="user-x" tone="error" title="Remove doctor" caption="For example, retired or moved away" onPress={() => navigation.navigate('DoctorChange', { doctor: d, initialType: 'DELETE' })} />
                            </View>
                        ) : null}
                    </Card>
                </>
            )}
            {!own ? <Text style={[text.small, { marginTop: space(2) }]}>This doctor belongs to a team member. They request changes; you approve them in Doctor requests.</Text> : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: -space(1), marginBottom: space(1.5) },
    actions: { flexDirection: 'row', gap: space(1) },
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
});
