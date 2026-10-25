import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { decideVerification, errorMessage, getVerification } from '../api';
import { VERIFY_METHOD, VERIFY_STATUS, deadlineLabel, shortDate } from '../doctorLabels';
import { doctorName, titleCase } from '../format';
import { space } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Header, KeyValue, Loadable, Notice, ReasonDialog, Screen, SectionTitle, Tag } from '../ui';
import { EvidencePhoto } from './RequestDetail';

// A proof sent for a new doctor: what was sent, any clash with another doctor, accept / reject.
export default function VerificationDetail({ navigation, route }) {
    const { verificationId } = route.params;
    const state = useLoad(() => getVerification(verificationId), [verificationId], "Couldn't load the proof.");
    const [deciding, setDeciding] = useState(null); // 'accept' | 'reject'

    const decide = async (remarks) => {
        try {
            const r = await decideVerification(verificationId, deciding === 'accept', remarks);
            toast(r?.message || 'Saved');
            setDeciding(null);
            navigation.goBack();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    const v = state.data?.verification;
    return (
        <Screen
            refreshControl={state.refreshControl}
            footer={
                state.data?.canReview ? (
                    <View style={styles.footer}>
                        <Button title="Reject" variant="danger" onPress={() => setDeciding('reject')} style={{ flex: 1 }} />
                        <Button title="Accept" icon="check" onPress={() => setDeciding('accept')} disabled={Boolean(state.data.clash)} style={{ flex: 1 }} />
                    </View>
                ) : null
            }
        >
            <Header overline="Verification proof" title={v ? doctorName(v.DoctorName) : 'Proof'} onBack={() => navigation.goBack()} />
            <Loadable state={state}>
                {(data) => {
                    const row = data.verification;
                    const due = deadlineLabel(data.daysLeft);
                    return (
                        <>
                            <View style={styles.tags}>
                                <Tag label={VERIFY_STATUS[row.Status]?.label} tone={VERIFY_STATUS[row.Status]?.tone} />
                                <Tag label={due.label} tone={due.tone} />
                            </View>
                            {data.clash ? <Notice tone="error" title="Possible duplicate doctor">{`This number already belongs to ${doctorName(data.clash.DoctorName)}${data.clash.AreaName ? ` (${titleCase(data.clash.AreaName)})` : ''}. Check before accepting.`}</Notice> : null}
                            <Card style={{ marginBottom: space(1.5) }}>
                                <KeyValue
                                    rows={[
                                        ['Proof', VERIFY_METHOD[row.Method] || row.Method],
                                        ['Value', row.Value],
                                        ['Sent by', `${titleCase(row.SubmittedByName)} · ${shortDate(row.SubmittedOn)}`],
                                        ['Doctor', [titleCase(row.Speciality), titleCase(row.AreaName)].filter(Boolean).join(' · ')],
                                        ['Phone on record', row.MobileNumber],
                                        ['Registration on record', row.RegistrationNumber],
                                        row.ReviewedOn && ['Decided by', `${titleCase(row.ReviewedByName)} · ${shortDate(row.ReviewedOn)}`],
                                    ]}
                                />
                            </Card>
                            {row.ReviewRemarks ? <Notice tone={row.Status === 'REJECTED' ? 'error' : 'success'} title="Remarks">{row.ReviewRemarks}</Notice> : null}
                            {row.EvidenceId ? (
                                <>
                                    <SectionTitle title="Photo" />
                                    <EvidencePhoto evidenceId={row.EvidenceId} height={320} />
                                </>
                            ) : null}
                            {row.Method === 'PHONE' && row.Status === 'PENDING' ? (
                                <Button title={`Call ${row.Value} to confirm`} icon="phone" variant="outline" onPress={() => Linking.openURL(`tel:${row.Value}`)} style={{ marginTop: space(1.5) }} />
                            ) : null}
                        </>
                    );
                }}
            </Loadable>
            <ReasonDialog
                visible={Boolean(deciding)}
                title={deciding === 'accept' ? 'Accept this proof?' : 'Reject this proof?'}
                caption={deciding === 'accept' ? 'The doctor becomes verified.' : 'Say why, so the proof can be sent again.'}
                label="Remarks"
                minLength={deciding === 'reject' ? 10 : 0}
                submitLabel={deciding === 'accept' ? 'Accept' : 'Reject'}
                onSubmit={decide}
                onClose={() => setDeciding(null)}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space(1.5) },
    footer: { flexDirection: 'row', gap: space(1) },
});
