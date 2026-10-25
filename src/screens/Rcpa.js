import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, dateKey, errorMessage, getMyDoctors, monthKey } from '../api';
import { doctorName, titleCase } from '../format';
import { PersonPicker, usePeople } from '../people';
import { colors, fonts, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, Loadable, MonthSwitcher, ProgressBar, Screen, SectionTitle, Select, StatGrid } from '../ui';

const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return dateKey(d);
};
let seq = 0;
const newLine = () => ({ key: `r${++seq}`, ProductId: '', OurQuantity: '', CompetitorBrand: '', CompetitorCompany: '', CompetitorQuantity: '' });

function Num({ label, value, onChange }) {
    return (
        <View style={{ flex: 1 }}>
            <Text style={styles.small}>{label}</Text>
            <TextInput style={styles.num} value={value} onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.inkFaint} />
        </View>
    );
}

function NewRcpa({ onClose, onSaved }) {
    const [pharmacies, setPharmacies] = useState([]);
    const [doctors, setDoctors] = useState([]);
    const [products, setProducts] = useState([]);
    const [back, setBack] = useState(0);
    const [pharmacy, setPharmacy] = useState('');
    const [doctor, setDoctor] = useState('');
    const [lines, setLines] = useState([newLine()]);
    const [remarks, setRemarks] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.get('/app/rcpa/pharmacies').then((r) => setPharmacies(r.data?.pharmacies || [])).catch(() => {});
        getMyDoctors().then((r) => setDoctors(r?.doctors || [])).catch(() => {});
        api.get('/app/catalogue/products', { params: { active: '1' } }).then((r) => setProducts(r.data?.products || [])).catch(() => {});
    }, []);

    const set = (key, patch) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    const bad = lines.find((l) => !l.ProductId || (Number(l.CompetitorQuantity) > 0 && !l.CompetitorBrand.trim()));
    const ok = pharmacy && doctor && !bad;

    const save = async () => {
        setBusy(true);
        try {
            const r = (
                await api.post('/app/rcpa', {
                    AuditDate: daysAgo(back),
                    PharmacyId: pharmacy,
                    DoctorId: doctor,
                    Remarks: remarks.trim() || null,
                    Lines: lines.map((l) => ({ ProductId: l.ProductId, OurQuantity: Number(l.OurQuantity || 0), CompetitorBrand: l.CompetitorBrand.trim() || null, CompetitorCompany: l.CompetitorCompany.trim() || null, CompetitorQuantity: Number(l.CompetitorQuantity || 0) })),
                })
            ).data;
            toast(r?.message || 'RCPA saved');
            onSaved();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal visible animationType="slide" onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.bg }} behavior="padding">
                <View style={styles.modalHead}>
                    <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                        <Feather name="x" size={22} color={colors.inkSoft} />
                    </Pressable>
                    <Text style={[text.title, { flex: 1 }]}>New RCPA</Text>
                    <Button title="Save" small onPress={save} busy={busy} disabled={!ok} />
                </View>
                <View style={{ flex: 1 }}>
                    <Screen>
                        <Text style={[text.small, { marginBottom: space(1.5) }]}>At the chemist: how many of our product vs the competitor’s were sold against this doctor’s prescriptions.</Text>
                        <Chips options={[0, 1, 2, 3].map((n) => ({ value: n, label: n === 0 ? 'Today' : n === 1 ? 'Yesterday' : `${n} days ago` }))} value={back} onChange={setBack} />
                        <Select label="Chemist *" value={pharmacy} options={pharmacies.map((p) => ({ value: p.PharmacyId, label: titleCase(p.PharmacyName), detail: titleCase(p.AreaName) }))} onChange={setPharmacy} empty="No chemists are assigned to you." />
                        <Select label="Doctor *" value={doctor} options={doctors.map((d) => ({ value: d.DoctorId, label: doctorName(d.DoctorName), detail: titleCase(d.Speciality) }))} onChange={setDoctor} />
                        {lines.map((l, i) => (
                            <Card key={l.key} style={{ marginBottom: space(1.25), padding: space(1.5) }}>
                                <View style={styles.lineHead}>
                                    <Text style={[text.small, { flex: 1 }]}>Product {i + 1}</Text>
                                    {lines.length > 1 ? (
                                        <Pressable onPress={() => setLines((ls) => ls.filter((x) => x.key !== l.key))} hitSlop={10} accessibilityLabel="Remove product">
                                            <Feather name="trash-2" size={16} color={colors.errorDark} />
                                        </Pressable>
                                    ) : null}
                                </View>
                                <Select value={l.ProductId} options={products.map((p) => ({ value: p.ProductId, label: p.ProductName, detail: p.PackSize }))} onChange={(v) => set(l.key, { ProductId: v })} placeholder="Our product" searchable />
                                <Field label="Competitor brand" value={l.CompetitorBrand} onChangeText={(v) => set(l.key, { CompetitorBrand: v.slice(0, 150) })} autoCapitalize="words" />
                                <Field label="Competitor company (optional)" value={l.CompetitorCompany} onChangeText={(v) => set(l.key, { CompetitorCompany: v.slice(0, 150) })} autoCapitalize="words" />
                                <View style={{ flexDirection: 'row', gap: space(1) }}>
                                    <Num label="Our qty" value={l.OurQuantity} onChange={(v) => set(l.key, { OurQuantity: v })} />
                                    <Num label="Competitor qty" value={l.CompetitorQuantity} onChange={(v) => set(l.key, { CompetitorQuantity: v })} />
                                </View>
                            </Card>
                        ))}
                        <Button title="Add product" icon="plus" variant="ghost" small disabled={lines.length >= 20} onPress={() => setLines((ls) => [...ls, newLine()])} />
                        <Field label="Remarks (optional)" value={remarks} onChangeText={(v) => setRemarks(v.slice(0, 500))} multiline autoCapitalize="sentences" />
                        {bad ? <Text style={text.small}>Each line needs a product, and a competitor brand when it has a competitor quantity.</Text> : null}
                    </Screen>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// Retail chemist prescription audit: our share vs competitors, by product, for a month.
export default function Rcpa({ navigation }) {
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [month, setMonth] = useState(monthKey());
    const state = useLoad(async () => (await api.get('/app/rcpa', { params: { userId: userId || undefined, month } })).data, [userId, month], "Couldn't load RCPA.");
    const [adding, setAdding] = useState(false);
    const canCreate = !userId;

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Doctor engagement" title="RCPA" onBack={() => navigation.goBack()} right={canCreate ? <Button title="New" icon="plus" small onPress={() => setAdding(true)} /> : null} />
            <PersonPicker people={people} value={userId} onChange={setUserId} />
            <MonthSwitcher value={month} onChange={setMonth} />
            <Loadable state={state} rows={5}>
                {(data) => (
                    <>
                        <StatGrid
                            items={[
                                { icon: 'percent', label: 'Our share', value: data.summary.share == null ? '—' : `${data.summary.share}%`, caption: `${data.summary.ourQuantity} ours · ${data.summary.competitorQuantity} competitor`, tone: 'success' },
                                { icon: 'clipboard', label: 'Audits', value: `${data.summary.audits}`, caption: `${data.summary.chemists} chemists · ${data.summary.doctors} doctors` },
                            ]}
                        />
                        {data.products.length ? (
                            <>
                                <SectionTitle title="By product" />
                                <Card style={{ marginBottom: space(1.5) }}>
                                    {data.products.map((p) => (
                                        <View key={p.ProductId} style={{ marginBottom: space(1.25) }}>
                                            <View style={styles.row}>
                                                <Text style={[text.subtitle, { flex: 1, fontSize: 14 }]}>{p.ProductName}</Text>
                                                <Text style={text.small}>{p.share == null ? '—' : `${p.share}%`}</Text>
                                            </View>
                                            <ProgressBar value={(p.share || 0) / 100} tone={p.share >= 50 ? 'success' : 'warning'} height={6} />
                                        </View>
                                    ))}
                                </Card>
                            </>
                        ) : null}
                        {data.competitors.length ? (
                            <>
                                <SectionTitle title="Top competitor brands" />
                                <Card style={{ marginBottom: space(1.5) }}>
                                    {data.competitors.map((c) => (
                                        <View key={c.brand || c.Brand} style={[styles.row, { paddingVertical: 6 }]}>
                                            <Text style={[text.body, { flex: 1 }]}>{c.brand || c.Brand}{c.company ? ` · ${c.company}` : ''}</Text>
                                            <Text style={text.subtitle}>{c.quantity}</Text>
                                        </View>
                                    ))}
                                </Card>
                            </>
                        ) : null}
                        <SectionTitle title="Audits" />
                        {data.entries.length ? (
                            <View style={{ gap: space(1.25) }}>
                                {data.entries.map((e) => (
                                    <Card key={e.RcpaId} style={{ padding: space(1.5) }}>
                                        <Text style={text.subtitle}>{titleCase(e.PharmacyName)}</Text>
                                        <Text style={text.small}>{`${e.AuditDate} · ${doctorName(e.DoctorName)}`}</Text>
                                        {e.lines.map((l) => (
                                            <Text key={l.LineId} style={text.small}>
                                                {`• ${l.ProductName}: ${l.OurQuantity}${l.CompetitorBrand ? ` vs ${l.CompetitorBrand} ${l.CompetitorQuantity}` : ''}`}
                                            </Text>
                                        ))}
                                    </Card>
                                ))}
                            </View>
                        ) : (
                            <Card>
                                <Empty icon="percent" title="No audits this month" caption="Record what the chemist sold against each doctor's prescriptions." />
                                {canCreate ? <Button title="Record an audit" icon="plus" variant="outline" onPress={() => setAdding(true)} /> : null}
                            </Card>
                        )}
                    </>
                )}
            </Loadable>
            {adding ? (
                <NewRcpa
                    onClose={() => setAdding(false)}
                    onSaved={() => {
                        setAdding(false);
                        state.reload();
                    }}
                />
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 },
    small: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkSoft, marginBottom: 6 },
    num: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 10, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, backgroundColor: colors.paper },
    lineHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1) },
    modalHead: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(2), paddingTop: space(5), paddingBottom: space(1.5), backgroundColor: colors.paper, borderBottomWidth: 1, borderBottomColor: colors.line },
});
