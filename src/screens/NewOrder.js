import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { createOrder, dateKey, errorMessage, getOrderOptions, rupees, uploadSlip } from '../api';
import { takePhoto } from '../camera';
import { getFix } from '../location';
import { colors, fonts, radius, space, text } from '../theme';
import { doctorName, titleCase } from '../format';
import { toast } from '../toast';
import { Button, Card, Chips, ErrorState, Field, Header, Notice, Screen, Select, SkeletonList } from '../ui';

const CUSTOMER = [
    { value: 'DOCTOR', label: 'From a doctor' },
    { value: 'CHEMIST', label: 'From a chemist' },
];
const daysAgo = (n) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    return dateKey(d);
};
const DATES = [
    { value: 0, label: 'Today' },
    { value: 1, label: 'Yesterday' },
    { value: 2, label: '2 days ago' },
];

let lineSeq = 0;
const newLine = () => ({ key: `l${++lineSeq}`, ProductId: '', Quantity: '', FreeQuantity: '', DiscountPercent: '' });
const amounts = (price, qty, disc) => {
    const gross = (Number(price) || 0) * (Number(qty) || 0);
    const discount = (gross * (Number(disc) || 0)) / 100;
    return { gross, discount, net: gross - discount };
};

function SmallInput({ label, value, onChangeText, decimal }) {
    return (
        <View style={{ flex: 1 }}>
            <Text style={styles.smallLabel}>{label}</Text>
            <TextInput
                style={styles.smallInput}
                value={value}
                onChangeText={(v) => onChangeText(decimal ? v.replace(/[^\d.]/g, '').slice(0, 6) : v.replace(/\D/g, '').slice(0, 6))}
                keyboardType={decimal ? 'decimal-pad' : 'number-pad'}
                placeholder="0"
                placeholderTextColor={colors.inkFaint}
            />
        </View>
    );
}

// Book a POB order. A chemist order needs live GPS at the chemist and a photo of the stamped slip.
export default function NewOrder({ navigation }) {
    const [options, setOptions] = useState(null);
    const [loadError, setLoadError] = useState('');
    const [customerType, setCustomerType] = useState('DOCTOR');
    const [customerId, setCustomerId] = useState('');
    const [stockistId, setStockistId] = useState('');
    const [back, setBack] = useState(0);
    const [lines, setLines] = useState([newLine()]);
    const [remarks, setRemarks] = useState('');
    const [slip, setSlip] = useState(null);
    const [fix, setFix] = useState(null);
    const [locating, setLocating] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const chemist = customerType === 'CHEMIST';

    useEffect(() => {
        getOrderOptions()
            .then((response) => {
                setOptions(response);
                if (response?.stockists?.length === 1) setStockistId(response.stockists[0].StockistId);
            })
            .catch((err) => setLoadError(errorMessage(err, "Couldn't load your doctors, chemists and products.")));
    }, []);

    const locate = async () => {
        setLocating(true);
        setFix(await getFix());
        setLocating(false);
    };
    // Chemist orders need GPS at the chemist: start finding it as soon as Chemist is chosen.
    const chooseType = (value) => {
        setCustomerType(value);
        setCustomerId('');
        if (value === 'CHEMIST' && !fix) locate();
    };

    const productById = useMemo(() => new Map((options?.products || []).map((p) => [p.ProductId, p])), [options]);
    const customers = chemist
        ? (options?.pharmacies || []).map((p) => ({ value: p.PharmacyId, label: titleCase(p.PharmacyName), detail: titleCase(p.AreaName) }))
        : (options?.doctors || []).map((d) => ({ value: d.DoctorId, label: doctorName(d.DoctorName), detail: [titleCase(d.Speciality), titleCase(d.AreaName)].filter(Boolean).join(' · ') }));
    const stockists = (options?.stockists || []).map((s) => ({ value: s.StockistId, label: titleCase(s.StockistName), detail: titleCase(s.AreaName) }));

    const setLine = (key, patch) => setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
    const priced = lines.map((line) => ({ ...line, product: productById.get(line.ProductId), ...amounts(productById.get(line.ProductId)?.UnitPrice, line.Quantity, line.DiscountPercent) }));
    const total = priced.reduce((sum, line) => sum + line.net, 0);
    const chosen = new Set(lines.map((line) => line.ProductId).filter(Boolean));

    const lineError = priced
        .map((line, i) => {
            if (!line.ProductId) return `Line ${i + 1}: choose a product.`;
            if (!(Number(line.Quantity) > 0)) return `Line ${i + 1}: quantity of at least 1.`;
            if (Number(line.FreeQuantity || 0) > Number(line.Quantity)) return `Line ${i + 1}: free can't exceed quantity.`;
            if (Number(line.DiscountPercent || 0) > 100) return `Line ${i + 1}: discount is 0–100%.`;
            return '';
        })
        .find(Boolean);
    const captured = fix?.status === 'CAPTURED';
    const missing = !customerId ? `Choose the ${chemist ? 'chemist' : 'doctor'}.` : !stockistId ? 'Choose the stockist.' : lineError || (chemist && !captured ? 'Capture your location at the chemist.' : chemist && !slip ? "Take a photo of the chemist's stamped slip." : '');

    const snap = async () => {
        try {
            const shot = await takePhoto();
            if (shot) setSlip(shot);
        } catch (err) {
            Alert.alert('Camera', err.message);
        }
    };

    const save = async () => {
        setSaving(true);
        setError('');
        try {
            const slipFields = chemist ? { SlipPhotoId: (await uploadSlip(slip.uri, slip.mimeType)).photoId, Location: fix } : {};
            const response = await createOrder({
                ...slipFields,
                OrderDate: chemist ? dateKey() : daysAgo(back),
                CustomerType: customerType,
                DoctorId: chemist ? null : customerId,
                PharmacyId: chemist ? customerId : null,
                StockistId: stockistId,
                Remarks: remarks.trim() || null,
                Lines: lines.map((line) => ({
                    ProductId: line.ProductId,
                    Quantity: Number(line.Quantity),
                    FreeQuantity: Number(line.FreeQuantity || 0),
                    DiscountPercent: Number(line.DiscountPercent || 0),
                })),
            });
            toast(response?.message || 'Order booked');
            navigation.goBack();
        } catch (err) {
            setError(errorMessage(err, "Couldn't book the order."));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Screen
            footer={
                options ? (
                    <>
                        {missing ? <Text style={[text.small, { marginBottom: space(1) }]}>{missing}</Text> : null}
                        <Button title={saving ? 'Booking…' : `Book order · ${rupees(total)}`} icon="check" onPress={save} busy={saving} disabled={Boolean(missing)} />
                    </>
                ) : null
            }
        >
            <Header overline="New POB" title="Book an order" onBack={() => navigation.goBack()} />

            {loadError ? <ErrorState message={loadError} onRetry={() => navigation.replace('NewOrder')} /> : null}
            {!options && !loadError ? <SkeletonList rows={3} /> : null}

            {options && (
                <>
                    <Chips options={CUSTOMER} value={customerType} onChange={chooseType} />

                    <Card style={{ marginBottom: space(2) }}>
                        <Select label={chemist ? 'Chemist *' : 'Doctor *'} value={customerId} options={customers} onChange={setCustomerId} empty={`No ${chemist ? 'chemists' : 'doctors'} assigned to you yet.`} />
                        <Select label="Supplying stockist *" value={stockistId} options={stockists} onChange={setStockistId} empty="No stockists assigned to you yet." />
                        {chemist ? (
                            <Text style={text.small}>Chemist orders are booked today, at the chemist.</Text>
                        ) : (
                            <>
                                <Text style={styles.smallLabel}>Order date</Text>
                                <Chips options={DATES} value={back} onChange={setBack} />
                            </>
                        )}
                    </Card>

                    <Text style={[text.title, { marginBottom: 4 }]}>Products</Text>
                    <Text style={[text.small, { marginBottom: space(1.5) }]}>Prices come from the catalogue. Free is the scheme (e.g. 10 + 1).</Text>

                    {priced.map((line, i) => (
                        <Card key={line.key} style={{ marginBottom: space(1.25), padding: space(1.5) }}>
                            <View style={styles.lineHead}>
                                <Text style={[text.small, { flex: 1 }]}>Line {i + 1}</Text>
                                {lines.length > 1 && (
                                    <Pressable onPress={() => setLines((current) => current.filter((l) => l.key !== line.key))} hitSlop={10} accessibilityLabel={`Remove line ${i + 1}`}>
                                        <Feather name="trash-2" size={16} color={colors.errorDark} />
                                    </Pressable>
                                )}
                            </View>
                            <Select
                                value={line.ProductId}
                                options={(options.products || []).filter((p) => !chosen.has(p.ProductId) || p.ProductId === line.ProductId).map((p) => ({ value: p.ProductId, label: p.ProductName, detail: `${rupees(p.UnitPrice)}${p.PackSize ? ` · ${p.PackSize}` : ''}` }))}
                                onChange={(v) => setLine(line.key, { ProductId: v })}
                                placeholder="Choose product"
                                searchable
                            />
                            <View style={styles.qtyRow}>
                                <SmallInput label="Qty" value={line.Quantity} onChangeText={(v) => setLine(line.key, { Quantity: v })} />
                                <SmallInput label="Free" value={line.FreeQuantity} onChangeText={(v) => setLine(line.key, { FreeQuantity: v })} />
                                <SmallInput label="Disc %" value={line.DiscountPercent} onChangeText={(v) => setLine(line.key, { DiscountPercent: v })} decimal />
                                <View style={{ flex: 1.2, alignItems: 'flex-end' }}>
                                    <Text style={styles.smallLabel}>Net</Text>
                                    <Text style={[text.subtitle, { paddingVertical: 10 }]}>{rupees(line.net)}</Text>
                                </View>
                            </View>
                        </Card>
                    ))}
                    <Button title="Add product" icon="plus" variant="ghost" small disabled={lines.length >= (options.maxLines || 30)} onPress={() => setLines((current) => [...current, newLine()])} style={{ marginBottom: space(2) }} />

                    {chemist && (
                        <Card style={{ marginBottom: space(2) }}>
                            <Text style={text.subtitle}>At the chemist</Text>
                            <View style={styles.statusRow}>
                                <Feather name={captured ? 'check-circle' : 'map-pin'} size={16} color={captured ? colors.successDark : colors.warningDark} />
                                <Text style={[text.small, { flex: 1 }]}>{locating ? 'Finding your location…' : captured ? `Location captured (±${Math.round(fix.accuracy || 0)} m)` : 'Location not found yet.'}</Text>
                                <Button title="Retry" small variant="outline" onPress={locate} disabled={locating} />
                            </View>
                            <Text style={[text.small, { marginTop: space(1.5), marginBottom: space(1) }]}>Photo of the stamped order slip (camera only). Book within {options.chemistRadius ?? 200} m of the chemist.</Text>
                            {slip ? (
                                <>
                                    <Image source={{ uri: slip.uri }} style={styles.photo} resizeMode="cover" />
                                    <Button title="Retake" icon="camera" variant="outline" small onPress={snap} style={{ marginTop: space(1) }} />
                                </>
                            ) : (
                                <Pressable onPress={snap} style={styles.photoEmpty} accessibilityRole="button" accessibilityLabel="Take slip photo">
                                    <Feather name="camera" size={22} color={colors.jade} />
                                    <Text style={[text.subtitle, { color: colors.jadeDark }]}>Take slip photo</Text>
                                </Pressable>
                            )}
                        </Card>
                    )}

                    <Field label="Remarks (optional)" value={remarks} onChangeText={(v) => setRemarks(v.slice(0, 500))} multiline autoCapitalize="sentences" />

                    <Card style={[styles.total, { marginBottom: space(2) }]}>
                        <Text style={[text.subtitle, { flex: 1 }]}>Order value</Text>
                        <Text style={text.metric}>{rupees(total)}</Text>
                    </Card>

                    {error ? <Notice tone="error">{error}</Notice> : null}
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    lineHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1) },
    qtyRow: { flexDirection: 'row', gap: space(1), marginTop: -space(1) },
    smallLabel: { fontFamily: fonts.semibold, fontSize: 12, color: colors.inkSoft, marginBottom: 6 },
    smallInput: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 10, paddingVertical: 10, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, backgroundColor: colors.paper },
    statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: space(1) },
    photo: { width: '100%', height: 190, borderRadius: radius.md, backgroundColor: colors.lineSoft },
    photoEmpty: { alignItems: 'center', justifyContent: 'center', gap: 6, height: 110, borderRadius: radius.md, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.jadeBright, backgroundColor: colors.jadeWash },
    total: { flexDirection: 'row', alignItems: 'center', padding: space(2) },
});
