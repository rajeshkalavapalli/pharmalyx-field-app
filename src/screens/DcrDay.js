import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, errorMessage } from '../api';
import { doctorName, titleCase } from '../format';
import { colors, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, KeyValue, ListRow, Loadable, Notice, ReasonDialog, Screen, SectionTitle, Tag } from '../ui';
import { DCR_STATUS } from './Dcr';
import { FEEDBACK } from './Visits';

const TRAVEL_MODES = [
    { value: 'BIKE', label: 'Bike' },
    { value: 'CAR', label: 'Car' },
    { value: 'BUS', label: 'Bus' },
    { value: 'TRAIN', label: 'Train' },
    { value: 'AUTO', label: 'Auto' },
    { value: 'OTHER', label: 'Other' },
];
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;
const dayLabel = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

const initialForm = (data) => {
    if (data.dcr) return { WorkStartTime: data.dcr.WorkStartTime, WorkEndTime: data.dcr.WorkEndTime, TravelMode: data.dcr.TravelMode, DistanceKm: String(data.dcr.DistanceKm), Remarks: data.dcr.Remarks || '' };
    const starts = data.visits.map((v) => v.StartTime).filter(Boolean).sort();
    const ends = data.visits.map((v) => v.EndTime || v.StartTime).filter(Boolean).sort();
    return { WorkStartTime: starts[0] || '09:30', WorkEndTime: ends[ends.length - 1] || '18:00', TravelMode: 'BIKE', DistanceKm: '', Remarks: '' };
};

function DayForm({ data, onSaved }) {
    const [form, setForm] = useState(() => initialForm(data));
    const [saving, setSaving] = useState(false);
    const set = (patch) => setForm((f) => ({ ...f, ...patch }));
    const distance = Number(form.DistanceKm);
    const errors = {
        WorkStartTime: TIME.test(form.WorkStartTime) ? '' : 'Use HH:mm, e.g. 09:30',
        WorkEndTime: !TIME.test(form.WorkEndTime) ? 'Use HH:mm, e.g. 18:00' : form.WorkEndTime <= form.WorkStartTime ? 'Must be after the start time' : '',
        DistanceKm: form.DistanceKm === '' || !Number.isFinite(distance) || distance < 0 || distance > 2000 ? 'Enter 0 to 2000 km' : '',
    };
    const ok = !Object.values(errors).some(Boolean);

    const submit = async () => {
        setSaving(true);
        try {
            const r = (await api.post('/app/dcr', { ReportDate: data.date, ...form, DistanceKm: distance, Remarks: form.Remarks.trim() })).data;
            toast(r?.message || 'DCR sent for review');
            onSaved();
        } catch (err) {
            toast(errorMessage(err, "Couldn't send the DCR."), 'error');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Card style={{ marginBottom: space(1.5) }}>
            <Text style={[text.title, { marginBottom: space(1.5) }]}>{data.dcr ? 'Fix and send again' : 'Send your DCR'}</Text>
            <View style={{ flexDirection: 'row', gap: space(1.5) }}>
                <View style={{ flex: 1 }}>
                    <Field label="Work start" value={form.WorkStartTime} onChangeText={(v) => set({ WorkStartTime: v.slice(0, 5) })} keyboardType="numbers-and-punctuation" error={errors.WorkStartTime} />
                </View>
                <View style={{ flex: 1 }}>
                    <Field label="Work end" value={form.WorkEndTime} onChangeText={(v) => set({ WorkEndTime: v.slice(0, 5) })} keyboardType="numbers-and-punctuation" error={errors.WorkEndTime} />
                </View>
            </View>
            <Text style={styles.label}>Travel mode</Text>
            <Chips options={TRAVEL_MODES} value={form.TravelMode} onChange={(v) => set({ TravelMode: v })} />
            <Field label="Distance travelled (km)" value={form.DistanceKm} onChangeText={(v) => set({ DistanceKm: v.replace(/[^\d.]/g, '').slice(0, 7) })} keyboardType="decimal-pad" error={form.DistanceKm ? errors.DistanceKm : ''} />
            <Field label="Remarks (optional)" value={form.Remarks} onChangeText={(v) => set({ Remarks: v.slice(0, 1000) })} multiline autoCapitalize="sentences" />
            <Button title={saving ? 'Sending…' : 'Send for review'} icon="send" onPress={submit} busy={saving} disabled={!ok} />
        </Card>
    );
}

// One day's report: plan, visits, the DCR (send / fix and resend), and the manager's approve / return.
export default function DcrDay({ navigation, route }) {
    const { date, userId } = route.params;
    const state = useLoad(async () => (await api.get('/app/dcr/day', { params: { date, userId: userId || undefined } })).data, [date, userId], "Couldn't load the day.");
    const [reviewing, setReviewing] = useState(null); // approve | return

    const review = async (remarks) => {
        try {
            const r = (await api.post(`/app/dcr/${state.data.dcr.DcrId}/${reviewing}`, { remarks: remarks || null })).data;
            toast(r?.message || 'Done');
            setReviewing(null);
            navigation.goBack();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    return (
        <Screen
            refreshControl={state.refreshControl}
            footer={
                state.data?.dcr?.canReview ? (
                    <View style={{ flexDirection: 'row', gap: space(1) }}>
                        <Button title="Return" variant="danger" onPress={() => setReviewing('return')} style={{ flex: 1 }} />
                        <Button title="Approve" icon="check" onPress={() => setReviewing('approve')} style={{ flex: 1 }} />
                    </View>
                ) : null
            }
        >
            <Header overline="DCR" title={dayLabel(date)} onBack={() => navigation.goBack()} />
            <Loadable state={state}>
                {(data) => {
                    const st = DCR_STATUS[data.status];
                    const plan = data.plan;
                    return (
                        <>
                            <View style={styles.tags}>
                                {st ? <Tag label={st.label} tone={st.tone} /> : null}
                                {data.deadline ? <Tag label={`Send by ${new Date(`${data.deadline}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`} tone="neutral" /> : null}
                            </View>
                            <Card style={{ marginBottom: space(1.5) }}>
                                <KeyValue rows={[['Plan', plan?.DayType === 'non-working' ? 'Planned as an off day' : plan ? [titleCase(plan.TerritoryName), titleCase(plan.AreaName)].filter(Boolean).join(' · ') || 'Working day' : 'No tour plan for this day']]} />
                            </Card>

                            {data.dcr && !data.canSubmit ? (
                                <Card style={{ marginBottom: space(1.5) }}>
                                    <KeyValue
                                        rows={[
                                            ['Work hours', `${data.dcr.WorkStartTime} – ${data.dcr.WorkEndTime}`],
                                            ['Travel', `${TRAVEL_MODES.find((m) => m.value === data.dcr.TravelMode)?.label || data.dcr.TravelMode} · ${data.dcr.DistanceKm} km`],
                                            ['Visits', data.dcr.VisitCount],
                                            data.dcr.ReviewedOn && ['Reviewed by', titleCase(data.dcr.ReviewedByName)],
                                        ]}
                                    />
                                    {data.dcr.Remarks ? <Text style={[text.body, { marginTop: space(1) }]}>“{data.dcr.Remarks}”</Text> : null}
                                </Card>
                            ) : null}
                            {data.dcr?.ReviewRemarks ? <Notice tone={data.dcr.Status === 'RETURNED' ? 'error' : 'success'} title="Manager's remarks">{data.dcr.ReviewRemarks}</Notice> : null}
                            {data.canSubmit ? <DayForm key={data.dcr?.DcrId || 'new'} data={data} onSaved={state.reload} /> : data.blockedReason && !data.dcr ? <Notice tone="info">{data.blockedReason}</Notice> : null}

                            <SectionTitle title={`Visits (${data.visits.length})`} />
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {data.visits.length ? (
                                    data.visits.map((v, i) => (
                                        <View key={v.VisitId} style={i > 0 && styles.line}>
                                            <ListRow
                                                title={doctorName(v.DoctorName)}
                                                caption={[v.StartTime && `${v.StartTime}${v.EndTime ? `–${v.EndTime}` : ''}`, titleCase(v.HospitalName || v.AreaName)].filter(Boolean).join(' · ')}
                                                right={v.Feedback && FEEDBACK[v.Feedback] ? <Tag label={FEEDBACK[v.Feedback].label} tone={FEEDBACK[v.Feedback].tone} /> : null}
                                                onPress={() => navigation.navigate('VisitDetail', { visitId: v.VisitId })}
                                            />
                                        </View>
                                    ))
                                ) : (
                                    <Empty icon="map-pin" title="No visits on this day" />
                                )}
                            </Card>
                        </>
                    );
                }}
            </Loadable>
            <ReasonDialog
                visible={Boolean(reviewing)}
                title={reviewing === 'approve' ? 'Approve this DCR?' : 'Return this DCR?'}
                label={reviewing === 'approve' ? 'Remarks (optional)' : 'What needs fixing'}
                minLength={reviewing === 'return' ? 5 : 0}
                submitLabel={reviewing === 'approve' ? 'Approve' : 'Return'}
                onSubmit={review}
                onClose={() => setReviewing(null)}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space(1.5) },
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
    label: { fontFamily: text.subtitle.fontFamily, fontSize: 12.5, color: colors.inkSoft, marginBottom: 6 },
});
