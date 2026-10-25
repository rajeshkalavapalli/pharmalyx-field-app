import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { confirmJointVisit, errorMessage, extendVerification, getDoctorRequests, getDuplicateFlags, getVerificationOverview, resolveDuplicateFlag } from '../api';
import { REQUEST_STATUS, REQUEST_TYPE, VERIFY_METHOD, VERIFY_STATUS, deadlineLabel, describeReason, shortDate } from '../doctorLabels';
import { doctorName, titleCase } from '../format';
import { usePermissions } from '../permissions';
import { colors, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Header, ListRow, Loadable, ReasonDialog, Screen, SectionTitle, StatGrid, Tag } from '../ui';

const STATUS_FILTER = [
    { value: '', label: 'All' },
    { value: 'PENDING', label: 'Pending' },
    { value: 'APPROVED', label: 'Approved' },
    { value: 'REJECTED', label: 'Rejected' },
];

function RequestsTab({ navigation }) {
    const [status, setStatus] = useState('');
    const state = useLoad(() => getDoctorRequests(status), [status], "Couldn't load requests.");

    return (
        <>
            <Chips options={STATUS_FILTER} value={status} onChange={setStatus} />
            <Loadable state={state}>
                {(data) =>
                    data.requests.length ? (
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {data.requests.map((r, i) => (
                                <View key={r.RequestId} style={i > 0 && styles.line}>
                                    <ListRow
                                        icon={r.RequestType === 'DELETE' ? 'user-x' : r.RequestType === 'EDIT' ? 'edit-2' : 'user-plus'}
                                        tone={REQUEST_TYPE[r.RequestType]?.tone}
                                        title={doctorName(r.DoctorName)}
                                        caption={[REQUEST_TYPE[r.RequestType]?.label, r.isMine ? 'by you' : titleCase(r.RequestedByName), shortDate(r.CreatedOn), r.duplicateCount ? `${r.duplicateCount} possible duplicate(s)` : null].filter(Boolean).join(' · ')}
                                        right={<Tag label={r.canReview ? 'Your decision' : REQUEST_STATUS[r.Status]?.label} tone={r.canReview ? 'warning' : REQUEST_STATUS[r.Status]?.tone} />}
                                        onPress={() => navigation.navigate('RequestDetail', { requestId: r.RequestId })}
                                    />
                                </View>
                            ))}
                        </Card>
                    ) : (
                        <Card>
                            <Empty icon="inbox" title="No requests here" caption="New doctors, edits and removals you or your team send appear here." />
                            <Button title="Add a doctor" icon="user-plus" variant="outline" onPress={() => navigation.navigate('AddDoctor')} />
                        </Card>
                    )
                }
            </Loadable>
        </>
    );
}

function VerificationTab({ navigation }) {
    const state = useLoad(() => getVerificationOverview(), [], "Couldn't load verification.");
    const [joint, setJoint] = useState(null);
    const [extend, setExtend] = useState(null);

    const doJoint = async (remarks) => {
        try {
            const r = await confirmJointVisit(joint.DoctorId, remarks);
            toast(r?.message || 'Verified by joint visit');
            setJoint(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    const doExtend = async (reason) => {
        try {
            const r = await extendVerification(extend.DoctorId, 15, reason);
            toast(r?.message || 'Deadline extended by 15 days');
            setExtend(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    return (
        <Loadable state={state}>
            {(data) => (
                <>
                    <StatGrid
                        items={[
                            { icon: 'user-check', label: 'Not verified yet', value: `${data.summary.provisional}`, tone: 'warning' },
                            { icon: 'alert-circle', label: 'Overdue', value: `${data.summary.overdue}`, caption: `${data.summary.dueSoon} due within 7 days`, tone: data.summary.overdue ? 'error' : 'brand' },
                            data.summary.toReview ? { icon: 'inbox', label: 'Proofs to review', value: `${data.summary.toReview}`, tone: 'info' } : null,
                        ]}
                    />

                    {data.verifications.some((v) => v.Status === 'PENDING') && (
                        <>
                            <SectionTitle title="Proofs sent" caption="Waiting for the manager's decision." />
                            <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1) }}>
                                {data.verifications
                                    .filter((v) => v.Status === 'PENDING')
                                    .map((v, i) => (
                                        <View key={v.VerificationId} style={i > 0 && styles.line}>
                                            <ListRow
                                                icon="file-text"
                                                tone="info"
                                                title={doctorName(v.DoctorName)}
                                                caption={[VERIFY_METHOD[v.Method], v.Value, titleCase(v.SubmittedByName), shortDate(v.SubmittedOn)].filter(Boolean).join(' · ')}
                                                right={<Tag label={v.canReview ? 'Your decision' : VERIFY_STATUS[v.Status]?.label} tone={v.canReview ? 'warning' : VERIFY_STATUS[v.Status]?.tone} />}
                                                onPress={() => navigation.navigate('VerificationDetail', { verificationId: v.VerificationId })}
                                            />
                                        </View>
                                    ))}
                            </Card>
                        </>
                    )}

                    <SectionTitle title="Doctors to verify" caption="Prove each new doctor is real with a registration no., phone, prescription pad / visiting card photo, or a joint visit." />
                    {data.doctors.length ? (
                        <View style={{ gap: space(1.25) }}>
                            {data.doctors.map((d) => {
                                const due = deadlineLabel(d.DaysLeft);
                                return (
                                    <Card key={d.DoctorId} style={{ padding: space(1.5) }}>
                                        <Text style={text.subtitle}>{doctorName(d.DoctorName)}</Text>
                                        <Text style={text.small}>{[titleCase(d.Speciality), titleCase(d.AreaName), d.AssignedTo && `with ${titleCase(d.AssignedTo)}`].filter(Boolean).join(' · ')}</Text>
                                        <View style={styles.tags}>
                                            <Tag label={due.label} tone={due.tone} />
                                            {d.PendingMethod ? <Tag label={`Proof sent: ${VERIFY_METHOD[d.PendingMethod]}`} tone="info" /> : null}
                                        </View>
                                        {d.LastRejection ? <Text style={[text.small, { color: colors.errorDark }]}>Last proof rejected: “{d.LastRejection}”</Text> : null}
                                        <View style={styles.actions}>
                                            {d.IsMine && !d.PendingMethod ? <Button title="Send proof" icon="upload" small onPress={() => navigation.navigate('VerifyDoctor', { doctor: d })} style={{ flex: 1 }} /> : null}
                                            {!d.IsMine ? <Button title="Joint visit done" icon="users" small variant="outline" onPress={() => setJoint(d)} style={{ flex: 1 }} /> : null}
                                            {data.canExtend ? <Button title="Extend" icon="clock" small variant="ghost" onPress={() => setExtend(d)} /> : null}
                                        </View>
                                    </Card>
                                );
                            })}
                        </View>
                    ) : (
                        <Card>
                            <Empty icon="check-circle" title="Every doctor is verified" caption="New doctors appear here until they are verified." />
                        </Card>
                    )}

                    <ReasonDialog
                        visible={Boolean(joint)}
                        title="Confirm joint visit"
                        caption={joint ? `You visited ${doctorName(joint.DoctorName)} together with your team member. This verifies the doctor.` : ''}
                        label="Remarks (optional)"
                        minLength={0}
                        submitLabel="Verify doctor"
                        onSubmit={doJoint}
                        onClose={() => setJoint(null)}
                    />
                    <ReasonDialog
                        visible={Boolean(extend)}
                        title="Extend the deadline by 15 days"
                        caption={extend ? doctorName(extend.DoctorName) : ''}
                        label="Why more time is needed"
                        submitLabel="Extend"
                        onSubmit={doExtend}
                        onClose={() => setExtend(null)}
                    />
                </>
            )}
        </Loadable>
    );
}

function DuplicatesTab() {
    const [status, setStatus] = useState('OPEN');
    const state = useLoad(() => getDuplicateFlags(status), [status], "Couldn't load possible duplicates.");
    const [resolving, setResolving] = useState(null); // { flag, status }

    const resolve = async (note) => {
        try {
            const r = await resolveDuplicateFlag(resolving.flag.FlagId, resolving.status, note);
            toast(r?.message || 'Saved');
            setResolving(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    const side = (title, d) =>
        d ? (
            <View style={styles.side}>
                <Text style={[text.overline, { color: colors.inkMuted }]}>{title}</Text>
                <Text style={text.subtitle}>{doctorName(d.DoctorName)}</Text>
                <Text style={text.small}>{[titleCase(d.Speciality), titleCase(d.AreaName), d.CreatedByName && `added by ${titleCase(d.CreatedByName)}`].filter(Boolean).join(' · ')}</Text>
            </View>
        ) : null;

    return (
        <>
            <Chips
                options={[
                    { value: 'OPEN', label: 'Open' },
                    { value: 'CONFIRMED', label: 'Confirmed' },
                    { value: 'DISMISSED', label: 'Dismissed' },
                ]}
                value={status}
                onChange={setStatus}
            />
            <Loadable state={state}>
                {(data) =>
                    data.flags.length ? (
                        <View style={{ gap: space(1.25) }}>
                            {data.flags.map((flag) => (
                                <Card key={flag.FlagId} style={{ padding: space(1.5) }}>
                                    <View style={styles.tags}>
                                        <Tag label={describeReason({ reason: flag.Reason, score: flag.Score, distanceM: flag.distanceM })} tone="warning" />
                                        <Text style={text.small}>Found {shortDate(flag.CreatedOn)}</Text>
                                    </View>
                                    {side('Doctor', flag.doctor)}
                                    {side('Possible duplicate', flag.match)}
                                    {flag.Status === 'OPEN' ? (
                                        <View style={styles.actions}>
                                            <Button title="Not a duplicate" small variant="outline" onPress={() => setResolving({ flag, status: 'DISMISSED' })} style={{ flex: 1 }} />
                                            <Button title="Is a duplicate" small variant="danger" onPress={() => setResolving({ flag, status: 'CONFIRMED' })} style={{ flex: 1 }} />
                                        </View>
                                    ) : flag.ResolutionNote ? (
                                        <Text style={[text.small, { marginTop: space(1) }]}>Note: “{flag.ResolutionNote}”</Text>
                                    ) : null}
                                </Card>
                            ))}
                        </View>
                    ) : (
                        <Card>
                            <Empty icon="copy" title="No possible duplicates" caption="The app checks name, phone, registration no. and GPS spot." />
                        </Card>
                    )
                }
            </Loadable>
            <ReasonDialog
                visible={Boolean(resolving)}
                title={resolving?.status === 'CONFIRMED' ? 'Confirm these are the same doctor?' : 'Mark as two different doctors?'}
                label="Note (what you checked)"
                submitLabel={resolving?.status === 'CONFIRMED' ? 'Is a duplicate' : 'Not a duplicate'}
                onSubmit={resolve}
                onClose={() => setResolving(null)}
            />
        </>
    );
}

// Doctor requests (new / edit / remove), verification of new doctors, and possible duplicates.
export default function DoctorRequests({ navigation, route }) {
    const permissions = usePermissions();
    const [tab, setTab] = useState(route.params?.tab || 'requests');
    const tabs = [
        { value: 'requests', label: 'Requests' },
        { value: 'verification', label: 'Verification' },
        permissions.has('fraudflags.view') && { value: 'duplicates', label: 'Duplicates' },
    ].filter(Boolean);

    return (
        <Screen>
            <Header overline="Doctors" title="Doctor requests" onBack={() => navigation.goBack()} />
            <Chips options={tabs} value={tab} onChange={setTab} />
            {tab === 'requests' && <RequestsTab navigation={navigation} />}
            {tab === 'verification' && <VerificationTab navigation={navigation} />}
            {tab === 'duplicates' && <DuplicatesTab />}
        </Screen>
    );
}

const styles = StyleSheet.create({
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
    tags: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 6, marginVertical: 6 },
    actions: { flexDirection: 'row', gap: space(1), marginTop: space(1.25) },
    side: { borderWidth: 1, borderColor: colors.line, borderRadius: 12, padding: space(1.25), marginTop: space(1) },
});
