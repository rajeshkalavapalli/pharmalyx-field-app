import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';

import { api, errorMessage } from '../api';
import { clock, doctorName, titleCase } from '../format';
import { colors, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Header, KeyValue, Loadable, Notice, ReasonDialog, Screen, SectionTitle, Tag } from '../ui';
import { RESULT } from './MyDay';
import { FEEDBACK, PLAN_STATUS } from './Visits';

const EXPLANATION_STATUS = {
    PENDING: { label: 'Explained · waiting for your manager', tone: 'info' },
    ACCEPTED: { label: 'Explanation accepted', tone: 'success' },
    REJECTED: { label: 'Explanation rejected', tone: 'error' },
};
const minutes = (seconds) => (seconds == null ? null : `${Math.round(seconds / 60)} min`);

// One visit: result and why, timing, location, samples, and "Explain" for a visit that needs a look.
export default function VisitDetail({ navigation, route }) {
    const { visitId } = route.params;
    const state = useLoad(async () => (await api.get(`/app/visits/${visitId}`)).data.visit, [visitId], "Couldn't load the visit.");
    const [explaining, setExplaining] = useState(false);

    const explain = async (reason) => {
        try {
            const r = (await api.post(`/app/work/visits/${visitId}/explain`, { Reason: reason })).data;
            toast(r?.message || 'Sent to your manager');
            setExplaining(false);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    const v = state.data;
    return (
        <Screen
            refreshControl={state.refreshControl}
            footer={v?.CanExplain ? <Button title="Explain this visit" icon="message-square" onPress={() => setExplaining(true)} /> : null}
        >
            <Header overline={v ? `Visit · ${v.VisitDate}` : 'Visit'} title={v ? doctorName(v.DoctorName) : 'Visit'} onBack={() => navigation.goBack()} />
            <Loadable state={state}>
                {() => {
                    const result = RESULT[v.FinalValidity];
                    return (
                        <>
                            <View style={styles.tags}>
                                {result ? <Tag label={result.label} tone={result.tone} /> : null}
                                {v.PlanStatus && PLAN_STATUS[v.PlanStatus] ? <Tag label={PLAN_STATUS[v.PlanStatus].label} tone={PLAN_STATUS[v.PlanStatus].tone} /> : null}
                                {v.Feedback && FEEDBACK[v.Feedback] ? <Tag label={FEEDBACK[v.Feedback].label} tone={FEEDBACK[v.Feedback].tone} /> : null}
                                {v.IsMockLocation ? <Tag label="Fake GPS" tone="error" /> : null}
                            </View>

                            {(v.reasons || []).length ? (
                                <Notice tone={v.FinalValidity === 'INVALID' ? 'error' : 'warning'} title={v.FinalValidity === 'INVALID' ? 'Why it did not count' : 'Why it needs a look (it still counts)'}>
                                    {v.reasons.map((r) => `• ${r.text}`).join('\n')}
                                </Notice>
                            ) : null}
                            {v.OverrideReason ? <Notice tone="info" title="Decision by head office">{v.OverrideReason}</Notice> : null}
                            {v.Explanation ? (
                                <Card style={{ marginBottom: space(1.5) }}>
                                    <Tag label={EXPLANATION_STATUS[v.Explanation.Status]?.label} tone={EXPLANATION_STATUS[v.Explanation.Status]?.tone} />
                                    <Text style={[text.body, { marginTop: space(1) }]}>“{v.Explanation.Reason}”</Text>
                                    {v.Explanation.ReviewNote ? <Text style={[text.small, { marginTop: 6 }]}>{`${titleCase(v.Explanation.ReviewedByName) || 'Manager'}: “${v.Explanation.ReviewNote}”`}</Text> : null}
                                </Card>
                            ) : null}

                            <Card style={{ marginBottom: space(1.5) }}>
                                <KeyValue
                                    rows={[
                                        ['By', titleCase(v.UserName)],
                                        ['Doctor', [titleCase(v.Speciality), titleCase(v.HospitalName)].filter(Boolean).join(' · ')],
                                        ['Area', [titleCase(v.AreaName), titleCase(v.TerritoryName)].filter(Boolean).join(', ')],
                                        ['Time', v.StartTime ? `${v.StartTime}${v.EndTime ? ` – ${v.EndTime}` : ''}` : null],
                                        v.CheckInAt && ['Live check-in', `${clock(v.CheckInAt)} – ${clock(v.CheckOutAt)}`],
                                        v.DwellSeconds != null && ['Stayed', minutes(v.DwellSeconds)],
                                        v.DistanceFromClinicM != null && ['From the clinic', `${v.DistanceFromClinicM} m`],
                                        v.JointWorkUserName && ['Joint work with', titleCase(v.JointWorkUserName)],
                                        v.FollowUpDate && ['Follow up on', v.FollowUpDate],
                                        v.RecordedOffline && ['Recorded', 'Offline, synced later'],
                                    ]}
                                />
                                {v.Latitude != null ? (
                                    <Button title="Open location in Maps" icon="map" variant="ghost" small onPress={() => Linking.openURL(`https://www.google.com/maps?q=${v.Latitude},${v.Longitude}`)} style={{ marginTop: space(1) }} />
                                ) : null}
                            </Card>

                            {v.Notes ? (
                                <>
                                    <SectionTitle title="Notes" />
                                    <Card style={{ marginBottom: space(1.5) }}>
                                        <Text style={text.body}>{v.Notes}</Text>
                                    </Card>
                                </>
                            ) : null}

                            {v.Items?.length ? (
                                <>
                                    <SectionTitle title="Samples and gifts given" />
                                    <Card style={{ marginBottom: space(1.5) }}>
                                        <KeyValue rows={v.Items.map((item) => [item.ItemName || item.ProductName || item.Name, `${item.Quantity}`])} />
                                    </Card>
                                </>
                            ) : null}
                            {v.CanExplain ? <Text style={[text.small, { color: colors.inkMuted }]}>If this was a genuine visit, explain it. Your manager reviews it; nothing is cut without a review.</Text> : null}
                        </>
                    );
                }}
            </Loadable>
            <ReasonDialog
                visible={explaining}
                title="Explain this visit"
                caption="For example: the doctor saw me between patients, or the clinic is inside a hospital with weak GPS."
                label="What happened"
                submitLabel="Send to manager"
                onSubmit={explain}
                onClose={() => setExplaining(false)}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space(1.5) },
});
