import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, errorMessage, monthKey, rupees } from '../api';
import { doctorName, titleCase } from '../format';
import { PersonPicker, usePeople } from '../people';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Empty, Field, Header, ListRow, Loadable, MiniBars, MonthSwitcher, Screen, SectionTitle, StatGrid, Tag } from '../ui';

const monthShort = (key) => new Date(`${key.slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });

function EntrySheet({ doctor, month, onClose, onSaved }) {
    const [expected, setExpected] = useState(doctor.ExpectedValue == null ? '' : String(doctor.ExpectedValue));
    const [actual, setActual] = useState(doctor.ActualValue == null ? '' : String(doctor.ActualValue));
    const [remarks, setRemarks] = useState(doctor.Remarks || '');
    const [busy, setBusy] = useState(false);
    const future = month > monthKey();

    const save = async () => {
        setBusy(true);
        try {
            const r = (await api.put('/app/doctor-business', { DoctorId: doctor.DoctorId, BusinessMonth: month, ExpectedValue: expected === '' ? null : Number(expected), ActualValue: future || actual === '' ? null : Number(actual), Remarks: remarks.trim() || null })).data;
            toast(r?.message || 'Saved');
            onSaved();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal visible animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHead}>
                        <Text style={[text.title, { flex: 1 }]}>{doctorName(doctor.DoctorName)}</Text>
                        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    <Field label="Expected business (₹)" value={expected} onChangeText={(v) => setExpected(v.replace(/[^\d.]/g, '').slice(0, 10))} keyboardType="decimal-pad" />
                    {!future ? <Field label="Actual business (₹)" value={actual} onChangeText={(v) => setActual(v.replace(/[^\d.]/g, '').slice(0, 10))} keyboardType="decimal-pad" hint={doctor.PreviousActual != null ? `Last month: ${rupees(doctor.PreviousActual)}` : undefined} /> : null}
                    <Field label="Remarks (optional)" value={remarks} onChangeText={(v) => setRemarks(v.slice(0, 300))} autoCapitalize="sentences" />
                    <Button title="Save" icon="check" onPress={save} busy={busy} />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// Expected vs actual business per doctor for a month, with a 6-month trend.
export default function DoctorBusiness({ navigation }) {
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [month, setMonth] = useState(monthKey());
    const state = useLoad(async () => (await api.get('/app/doctor-business', { params: { userId: userId || undefined, month } })).data, [userId, month], "Couldn't load doctor business.");
    const [editing, setEditing] = useState(null);

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Doctor engagement" title="Doctor business" onBack={() => navigation.goBack()} />
            <PersonPicker people={people} value={userId} onChange={setUserId} />
            <MonthSwitcher value={month} onChange={setMonth} allowFuture />
            <Loadable state={state} rows={5}>
                {(data) => {
                    const s = data.summary;
                    return (
                        <>
                            <StatGrid
                                items={[
                                    { icon: 'trending-up', label: 'Achievement', value: s.achievement == null ? '—' : `${s.achievement}%`, caption: `${rupees(s.actual)} of ${rupees(s.expected)}`, tone: s.achievement >= 100 ? 'success' : 'warning' },
                                    { icon: 'users', label: 'Doctors planned', value: `${s.planned}/${s.doctors}`, caption: `Last month ${rupees(s.previousActual)}` },
                                ]}
                            />
                            <SectionTitle title="Last 6 months" caption="Expected (light) vs actual" />
                            <Card style={{ marginBottom: space(1.5) }}>
                                <MiniBars data={data.trend.map((t) => ({ label: monthShort(t.month), value: t.actual, secondary: t.expected }))} />
                            </Card>
                            <SectionTitle title="Doctors" caption={data.editable ? 'Tap a doctor to enter expected / actual.' : undefined} />
                            {data.doctors.length ? (
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    {data.doctors.map((d, i) => {
                                        const pct = d.ExpectedValue ? Math.round(((d.ActualValue || 0) / d.ExpectedValue) * 100) : null;
                                        return (
                                            <View key={d.DoctorId} style={i > 0 && styles.line}>
                                                <ListRow
                                                    title={doctorName(d.DoctorName)}
                                                    caption={[titleCase(d.Speciality), d.Category && `Class ${d.Category}`, d.ExpectedValue != null ? `${rupees(d.ActualValue || 0)} / ${rupees(d.ExpectedValue)}` : 'Not planned'].filter(Boolean).join(' · ')}
                                                    right={pct != null ? <Tag label={`${pct}%`} tone={pct >= 100 ? 'success' : pct >= 50 ? 'warning' : 'error'} /> : null}
                                                    onPress={data.editable ? () => setEditing(d) : undefined}
                                                />
                                            </View>
                                        );
                                    })}
                                </Card>
                            ) : (
                                <Card>
                                    <Empty icon="users" title="No doctors assigned" />
                                </Card>
                            )}
                        </>
                    );
                }}
            </Loadable>
            {editing ? (
                <EntrySheet
                    doctor={editing}
                    month={month}
                    onClose={() => setEditing(null)}
                    onSaved={() => {
                        setEditing(null);
                        state.reload();
                    }}
                />
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4) },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
});
