import { useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { errorMessage, submitVerification, uploadSignboard } from '../api';
import { takePhoto } from '../camera';
import { deadlineLabel } from '../doctorLabels';
import { doctorName, titleCase } from '../format';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import { Button, Card, Chips, Field, Header, Screen, Tag } from '../ui';

const METHODS = [
    { value: 'REGISTRATION_NO', label: 'Registration no.' },
    { value: 'PHONE', label: 'Phone' },
    { value: 'DOCUMENT', label: 'Pad / card photo' },
];
const KINDS = [
    { value: 'PRESCRIPTION_PAD', label: 'Prescription pad' },
    { value: 'VISITING_CARD', label: 'Visiting card' },
];

// Send proof that a new (provisional) doctor is real. The manager accepts or rejects it.
export default function VerifyDoctor({ navigation, route }) {
    const { doctor } = route.params;
    const [method, setMethod] = useState('REGISTRATION_NO');
    const [value, setValue] = useState('');
    const [council, setCouncil] = useState('');
    const [kind, setKind] = useState('PRESCRIPTION_PAD');
    const [photo, setPhoto] = useState(null);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const due = deadlineLabel(doctor.DaysLeft);

    const digits = value.replace(/\D/g, '');
    const missing =
        method === 'REGISTRATION_NO' ? (value.replace(/[^a-z0-9]/gi, '').length < 3 ? 'Enter the registration number.' : '') : method === 'PHONE' ? (digits.length < 10 ? 'Enter a phone number with at least 10 digits.' : '') : !photo ? 'Take a photo of the prescription pad or visiting card.' : '';

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
            const payload = { Method: method };
            if (method === 'DOCUMENT') Object.assign(payload, { Kind: kind, PhotoId: (await uploadSignboard(photo.uri, photo.mimeType)).photoId });
            else Object.assign(payload, { Value: value.trim(), Council: method === 'REGISTRATION_NO' ? council.trim() || null : undefined });
            const response = await submitVerification(doctor.DoctorId, payload);
            toast(response?.message || 'Proof sent to your manager');
            navigation.goBack();
        } catch (err) {
            setError(errorMessage(err, "Couldn't send the proof."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Screen
            footer={
                <>
                    {error ? <Text style={[text.small, { color: colors.errorDark, marginBottom: space(1) }]}>{error}</Text> : null}
                    {missing ? <Text style={[text.small, { marginBottom: space(1) }]}>{missing}</Text> : null}
                    <Button title={saving ? 'Sending…' : 'Send proof to manager'} icon="send" onPress={submit} busy={saving} disabled={Boolean(missing)} />
                </>
            }
        >
            <Header overline="Verify doctor" title={doctorName(doctor.DoctorName)} onBack={() => navigation.goBack()} />
            <View style={styles.tags}>
                <Tag label={due.label} tone={due.tone} />
                {doctor.Speciality ? <Tag label={titleCase(doctor.Speciality)} tone="neutral" /> : null}
            </View>
            <Text style={[text.body, { marginBottom: space(2) }]}>Choose one proof. A registration or phone number can belong to only one doctor.</Text>

            <Chips options={METHODS} value={method} onChange={setMethod} />

            <Card>
                {method === 'REGISTRATION_NO' && (
                    <>
                        <Field label="Registration number *" value={value} onChangeText={(v) => setValue(v.slice(0, 40))} autoCapitalize="characters" placeholder="e.g. APMC 12345" />
                        <Field label="Medical council (optional)" value={council} onChangeText={(v) => setCouncil(v.slice(0, 60))} autoCapitalize="words" placeholder="e.g. Andhra Pradesh Medical Council" />
                    </>
                )}
                {method === 'PHONE' && <Field label="Doctor's phone number *" value={value} onChangeText={(v) => setValue(v.replace(/[^\d+ ]/g, '').slice(0, 20))} keyboardType="phone-pad" />}
                {method === 'DOCUMENT' && (
                    <>
                        <Chips options={KINDS} value={kind} onChange={setKind} />
                        {photo ? (
                            <>
                                <Image source={{ uri: photo.uri }} style={styles.photo} resizeMode="cover" />
                                <Button title="Retake" icon="camera" variant="outline" small onPress={snap} style={{ marginTop: space(1) }} />
                            </>
                        ) : (
                            <Pressable onPress={snap} style={styles.photoEmpty} accessibilityRole="button" accessibilityLabel="Take photo">
                                <Feather name="camera" size={22} color={colors.jade} />
                                <Text style={[text.subtitle, { color: colors.jadeDark }]}>Take photo</Text>
                            </Pressable>
                        )}
                    </>
                )}
            </Card>
        </Screen>
    );
}

const styles = StyleSheet.create({
    tags: { flexDirection: 'row', gap: 6, marginTop: -space(1.5), marginBottom: space(1.5) },
    photo: { width: '100%', height: 200, borderRadius: radius.md, backgroundColor: colors.lineSoft },
    photoEmpty: { alignItems: 'center', justifyContent: 'center', gap: 6, height: 120, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.jadeBright, backgroundColor: colors.jadeWash },
});
