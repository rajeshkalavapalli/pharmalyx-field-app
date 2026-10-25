import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { checkDoctorDuplicates, errorMessage, getDoctorOptions, requestNewDoctor, uploadSignboard } from '../api';
import { takePhoto } from '../camera';
import { getFix } from '../location';
import { colors, radius, space, text } from '../theme';
import { doctorName } from '../format';
import { toast } from '../toast';
import { Button, Card, Chips, Field, Header, Notice, Screen, Select } from '../ui';

// Same codes as the server: why a new doctor has no signboard photo.
const NO_PHOTO_REASONS = [
    { value: 'NO_SIGNBOARD', label: 'No signboard at the clinic' },
    { value: 'INSIDE_HOSPITAL', label: 'Doctor sits inside a hospital' },
    { value: 'HOME_CLINIC', label: 'Home clinic' },
    { value: 'NOT_ALLOWED', label: 'Photo not allowed at the clinic' },
];
const CATEGORIES = [
    { value: '', label: 'Not set' },
    { value: 'A', label: 'Class A' },
    { value: 'B', label: 'Class B' },
    { value: 'C', label: 'Class C' },
];
const DUPLICATE = { REGISTRATION_NO: 'Same registration no.', PHONE: 'Same phone number', NAME_NEARBY: 'Similar name nearby', SAME_SPOT: 'Same GPS spot, other area' };

const EMPTY = { DoctorName: '', Speciality: '', Qualification: '', HospitalName: '', TerritoryId: '', AreaId: '', MobileNumber: '', RegistrationNumber: '', Category: '', VisitsPerMonth: '', Comment: '' };

// Add a doctor at the clinic: details, live GPS and (if possible) a signboard photo. Goes to the manager.
export default function AddDoctor({ navigation }) {
    const [options, setOptions] = useState({ territories: [], specialities: [] });
    const [form, setForm] = useState(EMPTY);
    const [fix, setFix] = useState(null); // getFix() result
    const [locating, setLocating] = useState(true);
    const [photo, setPhoto] = useState(null);
    const [noPhotoReason, setNoPhotoReason] = useState('');
    const [duplicates, setDuplicates] = useState([]);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const set = (patch) => setForm((current) => ({ ...current, ...patch }));

    const locate = async () => {
        setLocating(true);
        setFix(await getFix());
        setLocating(false);
    };

    useEffect(() => {
        getDoctorOptions().then(setOptions).catch((err) => setError(errorMessage(err, "Couldn't load territories.")));
        getFix().then((first) => {
            setFix(first);
            setLocating(false);
        });
    }, []);

    // Possible duplicates, checked as they type.
    useEffect(() => {
        const handle = setTimeout(() => {
            if (form.DoctorName.trim().length < 3 && !form.MobileNumber && !form.RegistrationNumber) return setDuplicates([]);
            checkDoctorDuplicates({
                DoctorName: form.DoctorName,
                Speciality: form.Speciality,
                AreaId: form.AreaId || null,
                MobileNumber: form.MobileNumber,
                RegistrationNumber: form.RegistrationNumber,
                Latitude: fix?.latitude ?? null,
                Longitude: fix?.longitude ?? null,
            })
                .then((response) => setDuplicates(response.duplicates || []))
                .catch(() => setDuplicates([]));
        }, 700);
        return () => clearTimeout(handle);
    }, [form.DoctorName, form.Speciality, form.AreaId, form.MobileNumber, form.RegistrationNumber, fix]);

    const territories = options.territories.map((t) => ({ value: t.TerritoryId, label: t.TerritoryName }));
    const areas = useMemo(() => (options.territories.find((t) => t.TerritoryId === form.TerritoryId)?.areas || []).map((a) => ({ value: a.AreaId, label: a.AreaName })), [options, form.TerritoryId]);
    const specialities = options.specialities.map((s) => ({ value: s, label: s }));

    const captured = fix?.status === 'CAPTURED';
    const registrationClash = duplicates.some((m) => m.doctor?.ApprovalStatus === 'APPROVED' && m.reasons.some((r) => r.reason === 'REGISTRATION_NO'));
    const missing = [
        form.DoctorName.trim().length < 3 && 'doctor name',
        !form.Speciality.trim() && 'speciality',
        !form.AreaId && 'territory and area',
        !captured && 'clinic location',
        !photo && !noPhotoReason && 'signboard photo (or why there is none)',
    ].filter(Boolean);

    const snap = async () => {
        try {
            const shot = await takePhoto();
            if (shot) {
                setPhoto(shot);
                setNoPhotoReason('');
            }
        } catch (err) {
            Alert.alert('Camera', err.message);
        }
    };

    const submit = async () => {
        setSaving(true);
        setError('');
        try {
            const photoId = photo ? (await uploadSignboard(photo.uri, photo.mimeType)).photoId : null;
            const response = await requestNewDoctor({
                ...form,
                VisitsPerMonth: form.VisitsPerMonth ? Number(form.VisitsPerMonth) : null,
                Category: form.Category || null,
                LocationStatus: 'CAPTURED',
                Latitude: fix.latitude,
                Longitude: fix.longitude,
                Accuracy: fix.accuracy,
                PhotoId: photoId,
                NoPhotoReason: photoId ? null : noPhotoReason,
            });
            toast(response?.message || 'Sent to your manager. The doctor joins your list once approved.');
            navigation.goBack();
        } catch (err) {
            setError(errorMessage(err, "Couldn't send the doctor."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Screen
            footer={
                <>
                    {error ? <Text style={[text.small, { color: colors.errorDark, marginBottom: space(1) }]}>{error}</Text> : null}
                    {missing.length > 0 && <Text style={[text.small, { marginBottom: space(1) }]}>Still needed: {missing.join(', ')}.</Text>}
                    <Button title={saving ? 'Sending…' : 'Send to manager'} icon="send" onPress={submit} busy={saving} disabled={missing.length > 0 || registrationClash} />
                </>
            }
        >
            <Header overline="Add doctor" title="New doctor at this clinic" onBack={() => navigation.goBack()} />
            <Text style={[text.small, { marginTop: -space(1), marginBottom: space(2) }]}>Fill this in at the clinic. The doctor stays provisional until verified.</Text>

            {error ? <Notice tone="error">{error}</Notice> : null}

            <Card style={{ marginBottom: space(2) }}>
                <Field label="Doctor name *" value={form.DoctorName} onChangeText={(v) => set({ DoctorName: v.slice(0, 150) })} placeholder="e.g. K Rajesh" autoCapitalize="words" />
                {specialities.length ? (
                    <Select label="Speciality *" value={form.Speciality} options={specialities} onChange={(v) => set({ Speciality: v })} placeholder="Choose speciality" searchable />
                ) : (
                    <Field label="Speciality *" value={form.Speciality} onChangeText={(v) => set({ Speciality: v.slice(0, 100) })} placeholder="e.g. General Physician" autoCapitalize="words" />
                )}
                <Field label="Qualification" value={form.Qualification} onChangeText={(v) => set({ Qualification: v.slice(0, 200) })} placeholder="MBBS, MD" autoCapitalize="characters" />
                <Field label="Clinic / hospital" value={form.HospitalName} onChangeText={(v) => set({ HospitalName: v.slice(0, 200) })} autoCapitalize="words" />
                <Select label="Territory *" value={form.TerritoryId} options={territories} onChange={(v) => set({ TerritoryId: v, AreaId: '' })} />
                <Select label="Area *" value={form.AreaId} options={areas} onChange={(v) => set({ AreaId: v })} disabled={!form.TerritoryId} placeholder={form.TerritoryId ? 'Choose area' : 'Choose the territory first'} />
                <Field label="Phone (optional)" value={form.MobileNumber} onChangeText={(v) => set({ MobileNumber: v.replace(/[^\d+ ]/g, '').slice(0, 20) })} keyboardType="phone-pad" />
                <Field label="Registration no. (optional)" value={form.RegistrationNumber} onChangeText={(v) => set({ RegistrationNumber: v.slice(0, 40) })} autoCapitalize="characters" />
                <Text style={styles.label}>Category</Text>
                <Chips options={CATEGORIES} value={form.Category} onChange={(v) => set({ Category: v })} />
                <Field label="Visits / month" value={form.VisitsPerMonth} onChangeText={(v) => set({ VisitsPerMonth: v.replace(/\D/g, '').slice(0, 2) })} keyboardType="number-pad" />
            </Card>

            <Card style={{ marginBottom: space(2) }}>
                <Text style={text.subtitle}>Clinic location *</Text>
                <View style={styles.statusRow}>
                    <Feather name={captured ? 'check-circle' : 'map-pin'} size={16} color={captured ? colors.successDark : colors.warningDark} />
                    <Text style={[text.small, { flex: 1 }]}>
                        {locating ? 'Finding your location…' : captured ? `Captured (±${Math.round(fix.accuracy || 0)} m)${fix.isMock ? ' · fake GPS detected' : ''}` : fix?.status === 'DENIED' ? 'Location is not allowed. Allow it in phone settings.' : 'Location not found yet.'}
                    </Text>
                    <Button title="Retry" small variant="outline" onPress={locate} disabled={locating} />
                </View>
            </Card>

            <Card style={{ marginBottom: space(2) }}>
                <Text style={text.subtitle}>Signboard photo</Text>
                <Text style={[text.small, { marginBottom: space(1.5) }]}>Camera only. Date, time and GPS are saved with it.</Text>
                {photo ? (
                    <View>
                        <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
                        <Button title="Retake" icon="camera" variant="outline" small onPress={snap} style={{ marginTop: space(1) }} />
                    </View>
                ) : (
                    <>
                        <Pressable onPress={snap} style={styles.photoEmpty} accessibilityRole="button" accessibilityLabel="Take signboard photo">
                            <Feather name="camera" size={22} color={colors.jade} />
                            <Text style={[text.subtitle, { color: colors.jadeDark }]}>Take signboard photo</Text>
                        </Pressable>
                        <Select label="No photo? Tell us why" value={noPhotoReason} options={NO_PHOTO_REASONS} onChange={setNoPhotoReason} placeholder="Choose a reason" />
                    </>
                )}
            </Card>

            {registrationClash && <Notice tone="error">This registration number already belongs to a doctor. Ask your manager to assign that doctor to you instead.</Notice>}
            {duplicates.length > 0 && !registrationClash && (
                <Notice tone="warning" title="Possible match already exists">
                    <View style={{ gap: 2 }}>
                        {duplicates.slice(0, 3).map((m) => (
                            <Text key={m.doctor?.DoctorId} style={[text.small, { color: colors.warningDark }]}>
                                • {doctorName(m.doctor?.DoctorName)} — {m.reasons.map((r) => DUPLICATE[r.reason] || r.reason).join(', ')}
                            </Text>
                        ))}
                        <Text style={[text.small, { color: colors.warningDark, marginTop: 4 }]}>If it is the same doctor, ask your manager to assign them to you. You can still send this.</Text>
                    </View>
                </Notice>
            )}

            <Field label="Note for your manager (optional)" value={form.Comment} onChangeText={(v) => set({ Comment: v.slice(0, 1000) })} multiline autoCapitalize="sentences" />

        </Screen>
    );
}

const styles = StyleSheet.create({
    label: { fontFamily: text.subtitle.fontFamily, fontSize: 12.5, color: colors.inkSoft, marginBottom: 6 },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space(1) },
    photo: { width: '100%', height: 190, borderRadius: radius.md, backgroundColor: colors.lineSoft },
    photoEmpty: { alignItems: 'center', justifyContent: 'center', gap: 6, height: 110, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.jadeBright, backgroundColor: colors.jadeWash, marginBottom: space(2) },
});
