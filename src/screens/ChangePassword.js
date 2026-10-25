import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { changePassword, clearSession, errorMessage, saveSession } from '../api';
import { colors, space, text } from '../theme';
import { Button, Card, Field, Notice, Screen } from '../ui';
import { BrandMark } from './SignIn';

// Same rules as the server: at least 8 characters, a letter and a digit.
const RULES = [
    { label: 'At least 8 characters', test: (v) => v.length >= 8 },
    { label: 'A letter', test: (v) => /[A-Za-z]/.test(v) },
    { label: 'A digit', test: (v) => /\d/.test(v) },
];

// First sign-in after someone else set the password: choose your own.
export default function ChangePassword() {
    const [current, setCurrent] = useState('');
    const [next, setNext] = useState('');
    const [confirm, setConfirm] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const ok = RULES.every((r) => r.test(next)) && next === confirm && current && next !== current;

    const submit = async () => {
        setBusy(true);
        setError('');
        try {
            const result = await changePassword(current, next);
            await saveSession({ token: result.token, expiresAt: result.expiresAt, mustChangePassword: false });
        } catch (err) {
            setError(errorMessage(err, "Couldn't change your password."));
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen>
            <BrandMark />
            <Card style={{ marginTop: space(3) }}>
                <Text style={text.display}>Set your own password</Text>
                <Text style={[text.small, { marginTop: 4, marginBottom: space(2.5) }]}>Your password was set by someone else. Choose one only you know.</Text>
                {error ? <Notice tone="error">{error}</Notice> : null}
                <Field label="Password you were given" value={current} onChangeText={setCurrent} icon="lock" secure />
                <Field label="New password" value={next} onChangeText={setNext} icon="lock" secure />
                <View style={{ marginTop: -space(1), marginBottom: space(2), gap: 4 }}>
                    {RULES.map((rule) => (
                        <View key={rule.label} style={styles.rule}>
                            <Feather name={rule.test(next) ? 'check-circle' : 'circle'} size={14} color={rule.test(next) ? colors.success : colors.inkFaint} />
                            <Text style={text.small}>{rule.label}</Text>
                        </View>
                    ))}
                </View>
                <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} icon="lock" secure />
                {confirm && next !== confirm ? <Text style={[text.small, { color: colors.errorDark, marginTop: -space(1), marginBottom: space(1.5) }]}>The two passwords don’t match.</Text> : null}
                <Button title="Save and continue" icon="arrow-right" onPress={submit} busy={busy} disabled={!ok} />
                <Button title="Sign out" variant="ghost" onPress={clearSession} disabled={busy} style={{ marginTop: space(1) }} />
            </Card>
        </Screen>
    );
}

const styles = StyleSheet.create({ rule: { flexDirection: 'row', alignItems: 'center', gap: 8 } });
