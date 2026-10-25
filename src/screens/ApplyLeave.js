import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { applyLeave, dateKey, errorMessage } from '../api';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import { Button, Card, Chips, Field, Header, Notice, Screen, Select } from '../ui';

const addDays = (key, n) => {
    const d = new Date(`${key}T00:00:00`);
    d.setDate(d.getDate() + n);
    return dateKey(d);
};
const longDate = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

// A date with − / + buttons (no calendar library needed).
function DateStepper({ label, value, onChange, min }) {
    const canBack = !min || value > min;
    return (
        <View style={{ marginBottom: space(2) }}>
            <Text style={styles.label}>{label}</Text>
            <View style={styles.stepper}>
                <Pressable onPress={() => canBack && onChange(addDays(value, -1))} disabled={!canBack} style={[styles.step, !canBack && { opacity: 0.4 }]} hitSlop={6} accessibilityLabel={`${label}: one day earlier`}>
                    <Feather name="minus" size={18} color={colors.jadeDark} />
                </Pressable>
                <Text style={[text.subtitle, { flex: 1, textAlign: 'center' }]}>{longDate(value)}</Text>
                <Pressable onPress={() => onChange(addDays(value, 1))} style={styles.step} hitSlop={6} accessibilityLabel={`${label}: one day later`}>
                    <Feather name="plus" size={18} color={colors.jadeDark} />
                </Pressable>
            </View>
        </View>
    );
}

// Apply for leave: type, dates, half day (one day only, if the type allows), reason.
export default function ApplyLeave({ navigation, route }) {
    const balances = route.params?.balances || [];
    const [typeId, setTypeId] = useState(balances[0]?.LeaveTypeId || '');
    const [from, setFrom] = useState(addDays(dateKey(), 1));
    const [to, setTo] = useState(addDays(dateKey(), 1));
    const [halfDay, setHalfDay] = useState(false);
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const type = balances.find((b) => b.LeaveTypeId === typeId);
    const canHalf = type?.AllowHalfDay && from === to;

    const changeFrom = (value) => {
        setFrom(value);
        if (to < value) setTo(value);
    };

    const submit = async () => {
        setSaving(true);
        setError('');
        try {
            const response = await applyLeave({ LeaveTypeId: typeId, FromDate: from, ToDate: to, HalfDay: Boolean(canHalf && halfDay), Reason: reason.trim() });
            toast(response?.message || 'Leave applied. Sent to your manager.');
            navigation.goBack();
        } catch (err) {
            setError(errorMessage(err, "Couldn't apply for leave."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Screen footer={<Button title={saving ? 'Sending…' : 'Send to manager'} icon="send" onPress={submit} busy={saving} disabled={!typeId || !reason.trim()} />}>
            <Header overline="Leave" title="Apply for leave" onBack={() => navigation.goBack()} />
            {error ? <Notice tone="error">{error}</Notice> : null}

            <Card style={{ marginBottom: space(2) }}>
                <Select
                    label="Leave type"
                    value={typeId}
                    options={balances.map((b) => ({ value: b.LeaveTypeId, label: b.Name, detail: b.IsPaid ? `${b.available} day(s) available` : 'Unpaid, no balance needed' }))}
                    onChange={setTypeId}
                />
                <DateStepper label="From" value={from} onChange={changeFrom} />
                <DateStepper label="To" value={to} onChange={setTo} min={from} />
                {canHalf && (
                    <Chips
                        options={[
                            { value: false, label: 'Full day' },
                            { value: true, label: 'Half day' },
                        ]}
                        value={halfDay}
                        onChange={setHalfDay}
                    />
                )}
                <Field label="Reason *" value={reason} onChangeText={(v) => setReason(v.slice(0, 500))} multiline autoCapitalize="sentences" hint={`${reason.length}/500 · Sundays are not counted`} />
            </Card>

        </Screen>
    );
}

const styles = StyleSheet.create({
    label: { fontFamily: text.subtitle.fontFamily, fontSize: 12.5, color: colors.inkSoft, marginBottom: 6 },
    stepper: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, backgroundColor: colors.paper, padding: 4 },
    step: { width: 42, height: 42, borderRadius: radius.sm, backgroundColor: colors.jadeMist, alignItems: 'center', justifyContent: 'center' },
});
