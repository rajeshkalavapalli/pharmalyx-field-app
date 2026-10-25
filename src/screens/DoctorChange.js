import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { errorMessage, getDoctorOptions, requestDoctorChange, resubmitDoctorRequest, uploadSignboard } from '../api';
import { takePhoto } from '../camera';
import { doctorName } from '../format';
import { getFix } from '../location';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import { Button, Card, Chips, Field, Header, Notice, Screen, Select } from '../ui';

const MIN_REASON = 10;
const CATEGORIES = [
    { value: '', label: 'Not set' },
    { value: 'A', label: 'Class A' },
    { value: 'B', label: 'Class B' },
    { value: 'C', label: 'Class C' },
];
const up = (value) => String(value || '').toUpperCase();

// Ask to edit or remove an assigned doctor (manager approves first), or fix and resend a rejected request.
// Same fields and rules as the web "Request a change" dialog.
export default function DoctorChange({ navigation, route }) {
    const { doctor, resubmit = null, initialType = 'EDIT' } = route.params;
    const proposed = resubmit?.type === 'EDIT' ? resubmit.proposed || {} : {};
    const start = { ...doctor, ...proposed };

    const [type, setType] = useState(resubmit?.type || initialType);
    const [options, setOptions] = useState({ territories: [], specialities: [] });
    const [form, setForm] = useState({
        DoctorName: start.DoctorName || '',
        Speciality: start.Speciality || '',
        Qualification: start.Qualification || '',
        HospitalName: start.HospitalName || '',
        MobileNumber: start.MobileNumber || '',
        EmailId: start.EmailId || '',
        Category: start.Category || '',
        VisitsPerMonth: start.VisitsPerMonth == null ? '' : String(start.VisitsPerMonth),
        TerritoryId: up(start.TerritoryId),
        AreaId: up(start.AreaId),
        RegistrationNumber: (resubmit?.type === 'CREATE' ? doctor.RegistrationNumber : proposed.RegistrationNumber) || '',
    });
    const [moveClinic, setMoveClinic] = useState(proposed.ClinicLatitude != null);
    const [fix, setFix] = useState(null);
    const [locating, setLocating] = useState(false);
    const [photo, setPhoto] = useState(null);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (patch) => setForm((current) => ({ ...current, ...patch }));

    useEffect(() => {
        getDoctorOptions()
            .then(setOptions)
            .catch(() => {});
    }, []);

    const locate = async () => {
        setLocating(true);
        setFix(await getFix());
        setLocating(false);
    };
    const toggleMove = (value) => {
        setMoveClinic(value);
        if (value && !fix) locate();
    };

    const territories = options.territories.map((t) => ({ value: up(t.TerritoryId), label: t.TerritoryName }));
    const areas = useMemo(() => (options.territories.find((t) => up(t.TerritoryId) === form.TerritoryId)?.areas || []).map((a) => ({ value: up(a.AreaId), label: a.AreaName })), [options, form.TerritoryId]);

    const isCreate = type === 'CREATE';
    const hasDetails = type === 'EDIT' || isCreate;
    const captured = fix?.status === 'CAPTURED';
    const missing = [
        reason.trim().length < MIN_REASON && `a reason (at least ${MIN_REASON} characters)`,
        isCreate && form.DoctorName.trim().length < 3 && 'doctor name',
        isCreate && !form.Speciality.trim() && 'speciality',
        isCreate && (!form.TerritoryId || !form.AreaId) && 'territory and area',
        hasDetails && moveClinic && !captured && 'the new clinic location',
    ].filter(Boolean);

    const snap = async () => {
        try {
            const shot = await takePhoto();
            if (shot) setPhoto(shot);
        } catch (err) {
            Alert.alert('Camera', err.message);
        }
    };

    const submit = async () => {
        setSaving(true);
        setError('');
        try {
            const payload = { RequestType: type, Comment: reason.trim() };
            if (hasDetails) {
                const changes = { ...form, VisitsPerMonth: form.VisitsPerMonth === '' ? null : Number(form.VisitsPerMonth), Category: form.Category || null };
                if (!changes.RegistrationNumber) {
                    if (isCreate) changes.RegistrationNumber = null;
                    else delete changes.RegistrationNumber;
                }
                payload.Changes = changes;
                if (moveClinic) {
                    Object.assign(payload, { MoveClinic: true, LocationStatus: 'CAPTURED', Latitude: fix.latitude, Longitude: fix.longitude, Accuracy: fix.accuracy });
                    if (photo) payload.PhotoId = (await uploadSignboard(photo.uri, photo.mimeType)).photoId;
                }
            }
            const response = resubmit ? await resubmitDoctorRequest(resubmit.requestId, payload) : await requestDoctorChange(doctor.DoctorId, payload);
            toast(response?.message || 'Request sent to your manager');
            navigation.goBack();
        } catch (err) {
            setError(errorMessage(err, "Couldn't send the request."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Screen
            footer={
                <>
                    {error ? <Text style={[text.small, { color: colors.errorDark, marginBottom: space(1) }]}>{error}</Text> : null}
                    {missing.length ? <Text style={[text.small, { marginBottom: space(1) }]}>Still needed: {missing.join(', ')}.</Text> : null}
                    <Button title={saving ? 'Sending…' : resubmit ? 'Send again' : 'Send to manager'} icon="send" variant={type === 'DELETE' ? 'danger' : 'primary'} onPress={submit} busy={saving} disabled={missing.length > 0} />
                </>
            }
        >
            <Header overline={resubmit ? 'Fix and send again' : 'Request a change'} title={doctorName(doctor.DoctorName)} onBack={() => navigation.goBack()} />
            <Text style={[text.small, { marginTop: -space(1.5), marginBottom: space(2) }]}>Your manager approves first; nothing changes until then.</Text>

            {resubmit ? (
                <Notice tone="warning" title={`Rejected${resubmit.reviewedBy ? ` by ${resubmit.reviewedBy}` : ''}`}>
                    {resubmit.remarks || 'No reason given.'}
                </Notice>
            ) : (
                <Chips
                    options={[
                        { value: 'EDIT', label: 'Edit details' },
                        { value: 'DELETE', label: 'Remove doctor' },
                    ]}
                    value={type}
                    onChange={setType}
                />
            )}

            {hasDetails && (
                <>
                    <Card style={{ marginBottom: space(2) }}>
                        <Field label={isCreate ? 'Doctor name *' : 'Doctor name'} value={form.DoctorName} onChangeText={(v) => set({ DoctorName: v.slice(0, 150) })} autoCapitalize="words" />
                        <Field label={isCreate ? 'Speciality *' : 'Speciality'} value={form.Speciality} onChangeText={(v) => set({ Speciality: v.slice(0, 100) })} autoCapitalize="words" />
                        <Field label="Qualification" value={form.Qualification} onChangeText={(v) => set({ Qualification: v.slice(0, 200) })} autoCapitalize="characters" />
                        <Field label="Clinic / hospital" value={form.HospitalName} onChangeText={(v) => set({ HospitalName: v.slice(0, 200) })} autoCapitalize="words" />
                        <Select label="Territory" value={form.TerritoryId} options={territories} onChange={(v) => set({ TerritoryId: v, AreaId: '' })} />
                        <Select label="Area" value={form.AreaId} options={areas} onChange={(v) => set({ AreaId: v })} disabled={!form.TerritoryId} />
                        <Field label="Phone" value={form.MobileNumber} onChangeText={(v) => set({ MobileNumber: v.replace(/[^\d+ ]/g, '').slice(0, 20) })} keyboardType="phone-pad" />
                        <Field label="Email" value={form.EmailId} onChangeText={(v) => set({ EmailId: v.slice(0, 150) })} keyboardType="email-address" />
                        <Field label="Registration no. (if you have it)" value={form.RegistrationNumber} onChangeText={(v) => set({ RegistrationNumber: v.slice(0, 40) })} autoCapitalize="characters" />
                        <Text style={styles.label}>Category</Text>
                        <Chips options={CATEGORIES} value={form.Category} onChange={(v) => set({ Category: v })} />
                        <Field label="Visits / month" value={form.VisitsPerMonth} onChangeText={(v) => set({ VisitsPerMonth: v.replace(/\D/g, '').slice(0, 2) })} keyboardType="number-pad" />
                    </Card>

                    <Card style={{ marginBottom: space(2) }}>
                        <Pressable onPress={() => toggleMove(!moveClinic)} style={styles.check} accessibilityRole="checkbox" accessibilityState={{ checked: moveClinic }}>
                            <Feather name={moveClinic ? 'check-square' : 'square'} size={20} color={moveClinic ? colors.jade : colors.inkMuted} />
                            <Text style={[text.body, { flex: 1 }]}>{isCreate ? 'The clinic location was wrong. Pin it again (I am at the clinic now).' : 'The clinic has moved. Pin the new location (I am at the new clinic now).'}</Text>
                        </Pressable>
                        {moveClinic && (
                            <>
                                <View style={styles.statusRow}>
                                    <Feather name={captured ? 'check-circle' : 'map-pin'} size={16} color={captured ? colors.successDark : colors.warningDark} />
                                    <Text style={[text.small, { flex: 1 }]}>{locating ? 'Finding your location…' : captured ? `New location captured (±${Math.round(fix.accuracy || 0)} m)` : 'Location not found yet.'}</Text>
                                    <Button title="Retry" small variant="outline" onPress={locate} disabled={locating} />
                                </View>
                                {photo ? (
                                    <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
                                ) : null}
                                <Button title={photo ? 'Retake signboard photo' : 'New signboard photo (recommended)'} icon="camera" variant="outline" small onPress={snap} style={{ marginTop: space(1.25) }} />
                            </>
                        )}
                    </Card>
                </>
            )}

            {resubmit && type === 'DELETE' ? <Text style={[text.body, { marginBottom: space(1.5) }]}>You are asking again to remove this doctor. Explain what has changed or answer your manager’s question.</Text> : null}

            <Field
                label={resubmit ? 'What did you fix? (your manager sees this) *' : type === 'DELETE' ? 'Why should this doctor be removed? *' : 'Why do these details need to change? *'}
                value={reason}
                onChangeText={(v) => setReason(v.slice(0, 1000))}
                multiline
                autoCapitalize="sentences"
                error={reason && reason.trim().length < MIN_REASON ? `At least ${MIN_REASON} characters` : ''}
                hint={`${reason.length}/1000`}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    label: { fontFamily: text.subtitle.fontFamily, fontSize: 12.5, color: colors.inkSoft, marginBottom: 6 },
    check: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space(1.5) },
    photo: { width: '100%', height: 180, borderRadius: radius.md, marginTop: space(1.25), backgroundColor: colors.lineSoft },
});
