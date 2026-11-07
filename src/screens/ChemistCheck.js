import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, errorMessage } from '../api';
import { titleCase } from '../format';
import { toast } from '../toast';
import { colors, fonts, radius, space, text } from '../theme';
import { Button, Card, Empty, Field, Header, Notice, Screen, Select } from '../ui';
import { t } from '../i18n';

// At a chemist: is each of our products on the shelf? Missing products reach the manager as an alert.
export default function ChemistCheck({ navigation }) {
    const [pharmacies, setPharmacies] = useState([]);
    const [products, setProducts] = useState([]);
    const [chemist, setChemist] = useState('');
    const [last, setLast] = useState({}); // productId -> { Available, CheckDate }
    const [marks, setMarks] = useState({}); // productId -> true / false
    const [notes, setNotes] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        api.get('/app/rcpa/pharmacies').then((r) => setPharmacies(r.data?.pharmacies || [])).catch(() => setPharmacies([]));
        api.get('/app/catalogue/products', { params: { active: '1' } }).then((r) => setProducts(r.data?.products || [])).catch(() => setProducts([]));
    }, []);

    // A new chemist starts with no marks.
    const chooseChemist = (value) => {
        setChemist(value);
        setMarks({});
        setLast({});
    };

    useEffect(() => {
        if (!chemist) return;
        api.get('/app/chemists/availability', { params: { pharmacyId: chemist } })
            .then((r) => setLast(Object.fromEntries((r.data?.items || []).map((i) => [String(i.ProductId).toLowerCase(), i]))))
            .catch(() => setLast({}));
    }, [chemist]);

    const marked = Object.entries(marks);
    const save = async () => {
        setBusy(true);
        try {
            const r = (await api.post('/app/chemists/availability', { PharmacyId: chemist, Notes: notes.trim() || null, Items: marked.map(([ProductId, Available]) => ({ ProductId, Available })) })).data;
            toast(r.message || 'Saved');
            navigation.goBack();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const mark = (id, value) => setMarks((m) => (m[id] === value ? Object.fromEntries(Object.entries(m).filter(([k]) => k !== id)) : { ...m, [id]: value }));

    return (
        <Screen>
            <Header overline="At the chemist" title={t("Product availability")} onBack={() => navigation.goBack()} />
            <Select
                label={t("Chemist")}
                value={chemist}
                options={pharmacies.map((p) => ({ value: p.PharmacyId, label: titleCase(p.PharmacyName), detail: titleCase(p.AreaName) }))}
                onChange={chooseChemist}
                empty="No chemists assigned to you yet."
            />
            {!chemist ? (
                <Empty icon="home" title="Choose the chemist you are at" caption="Then mark each of our products as on the shelf or missing." />
            ) : (
                <>
                    <Notice tone="info" icon="info">Tap ✓ if it is on the shelf, ✕ if it is missing. Only the products you mark are saved.</Notice>
                    <Card style={{ marginBottom: space(2) }}>
                        {products.map((p) => {
                            const id = String(p.ProductId).toLowerCase();
                            const value = marks[id];
                            const prev = last[id];
                            return (
                                <View key={id} style={styles.row}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={styles.name} numberOfLines={1}>{p.ProductName}</Text>
                                        <Text style={text.small}>{prev ? `Last check ${prev.CheckDate}: ${prev.Available ? 'on the shelf' : 'missing'}` : 'Not checked yet'}</Text>
                                    </View>
                                    <Pressable onPress={() => mark(id, true)} style={[styles.toggle, value === true && styles.yes]} accessibilityLabel={`${p.ProductName} on the shelf`}>
                                        <Feather name="check" size={16} color={value === true ? colors.white : colors.successDark} />
                                    </Pressable>
                                    <Pressable onPress={() => mark(id, false)} style={[styles.toggle, value === false && styles.no]} accessibilityLabel={`${p.ProductName} missing`}>
                                        <Feather name="x" size={16} color={value === false ? colors.white : colors.errorDark} />
                                    </Pressable>
                                </View>
                            );
                        })}
                    </Card>
                    <Field label={t("Notes (optional)")} value={notes} onChangeText={(v) => setNotes(v.slice(0, 300))} multiline autoCapitalize="sentences" placeholder="e.g. stockist supply late, competitor scheme" />
                    <Button title={marked.length ? `Save ${marked.length} product(s)` : 'Mark products to save'} icon="check" onPress={save} busy={busy} disabled={!marked.length} />
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    row: { flexDirection: 'row', alignItems: 'center', gap: space(1), paddingVertical: space(1) },
    name: { fontFamily: fonts.semibold, fontSize: 14, color: colors.ink },
    toggle: { width: 38, height: 38, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.paper },
    yes: { backgroundColor: colors.successDark, borderColor: colors.successDark },
    no: { backgroundColor: colors.errorDark, borderColor: colors.errorDark },
});
