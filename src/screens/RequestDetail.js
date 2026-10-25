import { useState } from 'react';
import { Image, Linking, StyleSheet, Text, View } from 'react-native';

import { authImage, cancelDoctorRequest, decideDoctorRequest, errorMessage, getDoctorRequest } from '../api';
import { FIELD_LABEL, REQUEST_STATUS, REQUEST_TYPE, WARNING_LABEL, describeReason, shortDate } from '../doctorLabels';
import { doctorName, titleCase } from '../format';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Header, KeyValue, Loadable, Notice, ReasonDialog, Screen, SectionTitle, Tag } from '../ui';

const MIN_REMARKS = 10;
const show = (key, value) => {
    if (value == null || value === '') return '—';
    if (key === 'IsActive') return value === 'Yes' || value === true ? 'Yes' : 'No';
    return String(value);
};

export function EvidencePhoto({ evidenceId, height = 200 }) {
    if (!evidenceId) return <Text style={[text.small, styles.noPhoto]}>No photo</Text>;
    return <Image source={authImage(`/app/doctor-evidence/${evidenceId}`)} style={[styles.photo, { height }]} resizeMode="cover" accessibilityLabel="Signboard photo" />;
}

// One doctor request: what changes, possible duplicates and warnings; approve / reject / cancel / fix and resend.
export default function RequestDetail({ navigation, route }) {
    const { requestId } = route.params;
    const state = useLoad(() => getDoctorRequest(requestId), [requestId], "Couldn't load the request.");
    const [deciding, setDeciding] = useState(null); // 'approve' | 'reject'
    const [isDuplicate, setIsDuplicate] = useState(false);
    const [busy, setBusy] = useState(false);

    const decide = async (remarks) => {
        try {
            const r = await decideDoctorRequest(requestId, deciding === 'approve', remarks, deciding === 'reject' && isDuplicate);
            toast(r?.message || (deciding === 'approve' ? 'Approved' : 'Rejected'));
            setDeciding(null);
            navigation.goBack();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    const cancel = async () => {
        setBusy(true);
        try {
            const r = await cancelDoctorRequest(requestId);
            toast(r?.message || 'Request cancelled');
            navigation.goBack();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen
            refreshControl={state.refreshControl}
            footer={
                state.data && (state.data.canReview || state.data.canCancel || state.data.canResubmit) ? (
                    <View style={styles.footer}>
                        {state.data.canReview && (
                            <>
                                <Button title="Reject" variant="danger" onPress={() => setDeciding('reject')} style={{ flex: 1 }} />
                                <Button title="Approve" icon="check" onPress={() => setDeciding('approve')} style={{ flex: 1 }} />
                            </>
                        )}
                        {state.data.canCancel && <Button title="Cancel request" variant="danger" onPress={cancel} busy={busy} style={{ flex: 1 }} />}
                        {state.data.canResubmit && (
                            <Button
                                title="Fix and send again"
                                icon="refresh-cw"
                                onPress={() =>
                                    navigation.navigate('DoctorChange', {
                                        doctor: state.data.doctor,
                                        resubmit: { requestId, type: state.data.request.RequestType, remarks: state.data.request.ReviewRemarks, reviewedBy: state.data.request.ReviewedByName, proposed: state.data.proposed },
                                    })
                                }
                                style={{ flex: 1 }}
                            />
                        )}
                    </View>
                ) : null
            }
        >
            <Header overline="Doctor request" title={state.data ? doctorName(state.data.doctor?.DoctorName) : 'Request'} onBack={() => navigation.goBack()} />
            <Loadable state={state}>
                {(data) => {
                    const { request, doctor, current, proposed } = data;
                    const changed = request.RequestType === 'EDIT' && proposed ? Object.keys(proposed).filter((k) => FIELD_LABEL[k] && show(k, proposed[k]) !== show(k, current?.[k])) : [];
                    return (
                        <>
                            <View style={styles.tags}>
                                <Tag label={REQUEST_TYPE[request.RequestType]?.label} tone={REQUEST_TYPE[request.RequestType]?.tone} />
                                <Tag label={REQUEST_STATUS[request.Status]?.label} tone={REQUEST_STATUS[request.Status]?.tone} />
                            </View>

                            <Card style={{ marginBottom: space(1.5) }}>
                                <KeyValue
                                    rows={[
                                        ['Sent by', titleCase(request.RequestedByName)],
                                        ['Sent on', shortDate(request.CreatedOn)],
                                        ['Decides', titleCase(request.ApproverName) || 'Admin'],
                                        request.ReviewedOn && ['Decided by', `${titleCase(request.ReviewedByName)} · ${shortDate(request.ReviewedOn)}`],
                                    ]}
                                />
                                {request.Comment ? <Text style={[text.body, { marginTop: space(1) }]}>“{request.Comment}”</Text> : null}
                                {request.ReviewRemarks ? <Notice tone={request.Status === 'REJECTED' ? 'error' : 'success'} title="Manager's remarks">{request.ReviewRemarks}</Notice> : null}
                            </Card>

                            {data.approveBlocked && <Notice tone="warning">Your role can’t approve doctor requests yet. Ask your administrator to add “Doctor requests · Approve” to your role.</Notice>}

                            {request.RequestType === 'EDIT' ? (
                                <>
                                    <SectionTitle title="What changes" caption={changed.length ? undefined : 'No field changes (location or photo only).'} />
                                    {changed.length ? (
                                        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.5) }}>
                                            {changed.map((k, i) => (
                                                <View key={k} style={[styles.diff, i > 0 && styles.line]}>
                                                    <Text style={text.small}>{FIELD_LABEL[k]}</Text>
                                                    <Text style={[text.body, styles.old]}>{show(k, current?.[k])}</Text>
                                                    <Text style={[text.subtitle, { color: colors.jadeDark }]}>{show(k, proposed[k])}</Text>
                                                </View>
                                            ))}
                                        </Card>
                                    ) : null}
                                </>
                            ) : (
                                <>
                                    <SectionTitle title={request.RequestType === 'DELETE' ? 'Doctor to remove' : 'New doctor'} />
                                    <Card style={{ marginBottom: space(1.5) }}>
                                        <KeyValue
                                            rows={[
                                                ['Speciality', titleCase(doctor.Speciality)],
                                                ['Qualification', doctor.Qualification],
                                                ['Clinic / hospital', titleCase(doctor.HospitalName)],
                                                ['Area', [titleCase(doctor.AreaName), titleCase(doctor.TerritoryName)].filter(Boolean).join(', ')],
                                                ['Phone', doctor.MobileNumber],
                                                ['Registration no.', doctor.RegistrationNumber],
                                                ['Category', doctor.Category ? `Class ${doctor.Category}` : null],
                                            ]}
                                        />
                                        {doctor.ClinicLatitude != null ? (
                                            <Button
                                                title="Open clinic in Maps"
                                                icon="map"
                                                variant="ghost"
                                                small
                                                onPress={() => Linking.openURL(`https://www.google.com/maps?q=${doctor.ClinicLatitude},${doctor.ClinicLongitude}`)}
                                                style={{ marginTop: space(1) }}
                                            />
                                        ) : null}
                                        <View style={{ marginTop: space(1) }}>
                                            <EvidencePhoto evidenceId={doctor.SignboardId} />
                                        </View>
                                    </Card>
                                </>
                            )}

                            {data.warnings.length > 0 && (
                                <Notice tone="warning" title="Warnings">
                                    {data.warnings.map((w) => `• ${WARNING_LABEL[w.reason] || w.reason}${w.detail ? `: ${w.detail}` : ''}`).join('\n')}
                                </Notice>
                            )}

                            {data.duplicates.length > 0 && (
                                <>
                                    <SectionTitle title={`${data.duplicates.length} possible duplicate(s)`} caption="Compare before deciding." />
                                    {data.duplicates.map((m) => (
                                        <Card key={m.doctor.DoctorId} style={{ marginBottom: space(1), borderColor: colors.warning }}>
                                            <View style={styles.tags}>
                                                {m.reasons.map((r) => (
                                                    <Tag key={r.reason} label={describeReason(r)} tone="warning" />
                                                ))}
                                            </View>
                                            <Text style={text.subtitle}>{doctorName(m.doctor.DoctorName)}</Text>
                                            <Text style={text.small}>{[titleCase(m.doctor.Speciality), titleCase(m.doctor.AreaName), m.doctor.CreatedByName && `added by ${titleCase(m.doctor.CreatedByName)}`].filter(Boolean).join(' · ')}</Text>
                                        </Card>
                                    ))}
                                </>
                            )}

                            <ReasonDialog
                                visible={Boolean(deciding)}
                                title={deciding === 'approve' ? 'Approve this request?' : 'Reject this request?'}
                                caption={
                                    deciding === 'approve'
                                        ? data.flagged
                                            ? 'This request has warnings or possible duplicates, so say what you checked.'
                                            : 'Remarks are optional.'
                                        : 'Tell your team member why, so they can fix it.'
                                }
                                label="Remarks"
                                minLength={deciding === 'reject' || data.flagged ? MIN_REMARKS : 0}
                                submitLabel={deciding === 'approve' ? 'Approve' : 'Reject'}
                                onSubmit={decide}
                                onClose={() => setDeciding(null)}
                            >
                            {deciding === 'reject' && data.duplicates.length > 0 ? (
                                <Chips
                                    options={[
                                        { value: false, label: 'Other reason' },
                                        { value: true, label: 'It is a duplicate' },
                                    ]}
                                    value={isDuplicate}
                                    onChange={setIsDuplicate}
                                />
                            ) : null}
                            </ReasonDialog>
                        </>
                    );
                }}
            </Loadable>
        </Screen>
    );
}

const styles = StyleSheet.create({
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space(1.5) },
    footer: { flexDirection: 'row', gap: space(1) },
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
    diff: { paddingHorizontal: space(1.75), paddingVertical: space(1.25), gap: 2 },
    old: { color: colors.inkMuted, textDecorationLine: 'line-through' },
    photo: { width: '100%', borderRadius: radius.md, backgroundColor: colors.lineSoft },
    noPhoto: { paddingVertical: space(2), textAlign: 'center', backgroundColor: colors.lineSoft, borderRadius: radius.md },
});
