import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { chooseCompany, errorMessage, saveSession, signIn } from '../api';
import { colors, fonts, gradients, radius, shadow, space, text } from '../theme';
import { Button, Card, Field, Notice } from '../ui';

export function BrandMark({ light }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.mark, shadow.glow]}>
                <Text style={styles.markText}>P</Text>
            </LinearGradient>
            <View>
                <Text style={[styles.wordmark, light && { color: colors.white }]}>
                    Pharma<Text style={{ color: light ? colors.jadeGlow : colors.jade }}>lyx</Text>
                </Text>
                <Text style={[styles.tagline, light && { color: 'rgba(255,255,255,0.7)' }]}>FIELD APP</Text>
            </View>
        </View>
    );
}

// Sign in with username / email and password. If the login works in several companies, pick one.
export default function SignIn() {
    const insets = useSafeAreaInsets();
    const [login, setLogin] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [choice, setChoice] = useState(null); // { organisations, ticket }
    const passwordRef = useRef(null);

    const finish = (result) =>
        saveSession({ token: result.token, expiresAt: result.expiresAt, user: { ...result.user, organisation: result.organisation }, mustChangePassword: result.mustChangePassword });

    const submit = async () => {
        if (!login.trim() || !password) {
            setError('Enter your username and password.');
            return;
        }
        setBusy(true);
        setError('');
        try {
            const result = await signIn(login.trim(), password);
            if (result.chooseOrganisation) setChoice({ organisations: result.organisations, ticket: result.ticket });
            else await finish(result);
        } catch (err) {
            setError(errorMessage(err, 'Sign-in failed. Please try again.'));
        } finally {
            setBusy(false);
        }
    };

    const pick = async (organisationId) => {
        setBusy(true);
        setError('');
        try {
            await finish(await chooseCompany(choice.ticket, organisationId));
        } catch (err) {
            setError(errorMessage(err));
            if (err?.response?.status === 401) setChoice(null);
        } finally {
            setBusy(false);
        }
    };

    return (
        // Android draws edge-to-edge, so the window doesn't shrink for the keyboard: lift the form with
        // padding on both platforms, and let taps on the form never close the keyboard.
        <KeyboardAvoidingView style={styles.safe} behavior="padding">
            <ScrollView
                contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + space(2) }}
                keyboardShouldPersistTaps="always"
                keyboardDismissMode="none"
            >
            <LinearGradient colors={gradients.ink} style={[styles.hero, { paddingTop: insets.top + space(3) }]}>
                <BrandMark light />
                <Text style={styles.heroTitle}>Your field day, in your pocket.</Text>
            </LinearGradient>

            <View style={styles.body}>
                <Card style={styles.formCard}>
                    <Text style={text.display}>{choice ? 'Choose your company' : 'Welcome back'}</Text>
                    <Text style={[text.small, { marginTop: 4, marginBottom: space(2.5) }]}>
                        {choice ? 'Your account works in more than one company.' : 'Sign in to your Pharmalyx workspace.'}
                    </Text>

                    {error ? <Notice tone="error">{error}</Notice> : null}

                    {choice ? (
                        <View style={{ gap: space(1) }}>
                            {choice.organisations.map((org) => (
                                <Pressable key={org.organisationId} onPress={() => pick(org.organisationId)} disabled={busy} style={({ pressed }) => [styles.company, pressed && { backgroundColor: colors.jadeWash }]}>
                                    <Feather name="briefcase" size={18} color={colors.jade} />
                                    <Text style={[text.subtitle, { flex: 1 }]}>{org.name}</Text>
                                    <Feather name="chevron-right" size={18} color={colors.inkMuted} />
                                </Pressable>
                            ))}
                            <Button title="Use a different account" variant="ghost" icon="arrow-left" onPress={() => setChoice(null)} disabled={busy} />
                        </View>
                    ) : (
                        <>
                            <Field
                                label="Username or email"
                                value={login}
                                onChangeText={setLogin}
                                icon="user"
                                textContentType="none"
                                returnKeyType="next"
                                onSubmitEditing={() => passwordRef.current?.focus()}
                            />
                            <Field
                                ref={passwordRef}
                                label="Password"
                                value={password}
                                onChangeText={setPassword}
                                icon="lock"
                                secure
                                textContentType="none"
                                returnKeyType="go"
                                onSubmitEditing={submit}
                            />
                            <Button title={busy ? 'Signing in…' : 'Sign in'} icon="arrow-right" onPress={submit} busy={busy} />
                            <View style={styles.footnote}>
                                <Feather name="shield" size={14} color={colors.success} />
                                <Text style={[text.small, { flex: 1 }]}>Forgot your password? Ask your administrator to reset it.</Text>
                            </View>
                        </>
                    )}
                </Card>
            </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    mark: { width: 38, height: 38, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
    markText: { fontFamily: fonts.heavy, fontSize: 18, color: colors.white },
    wordmark: { fontFamily: fonts.display, fontSize: 21, color: colors.ink, letterSpacing: -0.3 },
    tagline: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.6, color: colors.inkMuted },
    safe: { flex: 1, backgroundColor: colors.bg },
    hero: { paddingHorizontal: space(3), paddingTop: space(3), paddingBottom: space(3) },
    heroTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, color: colors.white, marginTop: space(2.5) },
    body: { flex: 1, paddingHorizontal: space(2), paddingTop: space(2.5) },
    formCard: { padding: space(2.5), borderRadius: radius.xl },
    company: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: space(1.75), borderWidth: 1, borderColor: colors.line, borderRadius: radius.md },
    footnote: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space(2) },
});
