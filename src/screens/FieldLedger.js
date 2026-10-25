import { useEffect, useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, errorMessage, rupees, uploadImage } from '../api';
import { takePhoto } from '../camera';
import { titleCase } from '../format';
import { getFix } from '../location';
import { PersonPicker, usePeople } from '../people';
import { usePermissions } from '../permissions';
import { colors, fonts, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, KeyValue, ListRow, Loadable, Notice, Screen, SectionTitle, Select, StatGrid, Tag } from '../ui';

const line = { borderTopWidth: 1, borderTopColor: colors.lineSoft };
const day = (d) => (d ? new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—');
const BUCKETS = [
    ['d0_30', '0–30 d'],
    ['d31_60', '31–60 d'],
    ['d61_90', '61–90 d'],
    ['d90_plus', '90+ d'],
];
const MODES = [
    { value: 'CASH', label: 'Cash' },
    { value: 'UPI', label: 'UPI' },
    { value: 'CHEQUE', label: 'Cheque' },
    { value: 'BANK', label: 'Bank' },
];
const ENTRY = { DELIVERY: 'Delivered', PAYMENT: 'Payment', WRITE_OFF: 'Write-off', ADJUSTMENT: 'Adjustment', SCHEME: 'Scheme', ISSUE: 'Issued', RETURN: 'Returned', TRANSFER_IN: 'Received', TRANSFER_OUT: 'Handed over' };

function Sheet({ title, onClose, children }) {
    return (
        <Modal visible animationType="slide" transparent onRequestClose={onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <Pressable style={styles.backdrop} onPress={onClose} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHead}>
                        <Text style={[text.title, { flex: 1 }]}>{title}</Text>
                        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    {children}
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function usePhotoAndGps() {
    const [photo, setPhoto] = useState(null);
    const [fix, setFix] = useState(null);
    const [locating, setLocating] = useState(true);
    useEffect(() => {
        getFix().then((f) => {
            setFix(f);
            setLocating(false);
        });
    }, []);
    const snap = async () => {
        try {
            const shot = await takePhoto();
            if (shot) setPhoto(shot);
        } catch (err) {
            Alert.alert('Camera', err.message);
        }
    };
    return { photo, snap, fix, locating, captured: fix?.status === 'CAPTURED' };
}

// Deliver stock from my holding to a chemist: stamped receipt photo + GPS at the chemist.
function DeliverySheet({ options, pharmacyId, onClose, onSaved }) {
    const [chemist, setChemist] = useState(pharmacyId || '');
    const [qty, setQty] = useState({});
    const [remarks, setRemarks] = useState('');
    const [busy, setBusy] = useState(false);
    const cap = usePhotoAndGps();
    const c = options.chemists.find((x) => x.PharmacyId === chemist);
    const lines = Object.entries(qty).filter(([, v]) => Number(v) > 0);
    const total = lines.reduce((s, [id, v]) => s + Number(v) * (options.stock.find((b) => b.BatchId === id)?.UnitPrice || 0), 0);
    const ok = chemist && !c?.blocked && lines.length && cap.photo && cap.captured;

    const save = async () => {
        setBusy(true);
        try {
            const { photoId } = await uploadImage('/app/ledger/photo', cap.photo.uri, cap.photo.mimeType);
            const r = (await api.post('/app/ledger/deliveries', { PharmacyId: chemist, ReceiptPhotoId: photoId, Location: cap.fix, Lines: lines.map(([BatchId, v]) => ({ BatchId, Quantity: Number(v) })), Remarks: remarks.trim() || null })).data;
            toast(r?.message || 'Delivery recorded');
            onSaved();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet title="Deliver to chemist" onClose={onClose}>
            <Select label="Chemist" value={chemist} options={options.chemists.map((x) => ({ value: x.PharmacyId, label: titleCase(x.PharmacyName), detail: x.blocked ? `Blocked: ${x.reasons.join('; ')}` : `Owes ${rupees(x.balance)}` }))} onChange={setChemist} />
            {c?.blocked ? <Notice tone="error">{`Delivery not allowed: ${c.reasons.join('; ')}`}</Notice> : null}
            <Text style={styles.label}>Quantity per batch you hold</Text>
            {options.stock.length ? (
                options.stock.map((b) => (
                    <View key={b.BatchId} style={styles.batchRow}>
                        <View style={{ flex: 1 }}>
                            <Text style={text.subtitle}>{`${b.ProductName} · ${b.BatchNumber}`}</Text>
                            <Text style={text.small}>{`${b.Quantity} in hand · ${rupees(b.UnitPrice)} each · exp ${day(b.ExpiryDate)}`}</Text>
                        </View>
                        <TextInput style={styles.qty} value={qty[b.BatchId] || ''} onChangeText={(v) => setQty((q) => ({ ...q, [b.BatchId]: v.replace(/\D/g, '').slice(0, 5) }))} keyboardType="number-pad" placeholder="0" placeholderTextColor={colors.inkFaint} />
                    </View>
                ))
            ) : (
                <Text style={text.small}>You hold no stock to deliver.</Text>
            )}
            <Text style={[text.small, { marginVertical: space(1) }]}>{cap.locating ? 'Finding your location…' : cap.captured ? `At the chemist? GPS ±${Math.round(cap.fix.accuracy || 0)} m (within ${options.chemistRadius} m).` : 'Location not found. Allow location.'}</Text>
            {cap.photo ? <Image source={{ uri: cap.photo.uri }} style={styles.photo} resizeMode="cover" /> : null}
            <Button title={cap.photo ? 'Retake receipt photo' : "Photo of the chemist's stamped receipt *"} icon="camera" variant="outline" small onPress={cap.snap} style={{ marginBottom: space(1.5) }} />
            <Field label="Remarks (optional)" value={remarks} onChangeText={(v) => setRemarks(v.slice(0, 300))} />
            <Button title={`Record delivery · ${rupees(total)}`} icon="check" onPress={save} busy={busy} disabled={!ok} />
        </Sheet>
    );
}

// Payment collected from a chemist. Non-cash needs a reference; cash needs a receipt photo.
function PaymentSheet({ chemists, pharmacyId, onClose, onSaved }) {
    const [chemist, setChemist] = useState(pharmacyId || '');
    const [amount, setAmount] = useState('');
    const [mode, setMode] = useState('CASH');
    const [reference, setReference] = useState('');
    const [remarks, setRemarks] = useState('');
    const [busy, setBusy] = useState(false);
    const cap = usePhotoAndGps();
    const c = chemists.find((x) => x.PharmacyId === chemist);
    const ok = chemist && Number(amount) > 0 && (!c || Number(amount) <= c.balance) && (mode === 'CASH' ? cap.photo : reference.trim());

    const save = async () => {
        setBusy(true);
        try {
            const photoId = cap.photo ? (await uploadImage('/app/ledger/photo', cap.photo.uri, cap.photo.mimeType)).photoId : null;
            const r = (await api.post('/app/ledger/payments', { PharmacyId: chemist, Amount: Number(amount), Mode: mode, Reference: reference.trim() || null, ReceiptPhotoId: photoId, Location: cap.fix, Remarks: remarks.trim() || null })).data;
            toast(r?.message || 'Payment recorded');
            onSaved();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Sheet title="Collect payment" onClose={onClose}>
            <Select label="Chemist" value={chemist} options={chemists.map((x) => ({ value: x.PharmacyId, label: titleCase(x.PharmacyName), detail: `Owes ${rupees(x.balance)}` }))} onChange={setChemist} />
            <Field label="Amount (₹)" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, '').slice(0, 10))} keyboardType="decimal-pad" error={c && Number(amount) > c.balance ? `The chemist owes ${rupees(c.balance)}` : ''} />
            <Chips options={MODES} value={mode} onChange={setMode} />
            {mode !== 'CASH' ? <Field label="Reference no. *" value={reference} onChangeText={(v) => setReference(v.slice(0, 100))} autoCapitalize="characters" /> : null}
            {cap.photo ? <Image source={{ uri: cap.photo.uri }} style={styles.photo} resizeMode="cover" /> : null}
            <Button title={cap.photo ? 'Retake receipt photo' : `Receipt photo${mode === 'CASH' ? ' *' : ' (optional)'}`} icon="camera" variant="outline" small onPress={cap.snap} style={{ marginBottom: space(1.5) }} />
            <Field label="Remarks (optional)" value={remarks} onChangeText={(v) => setRemarks(v.slice(0, 300))} />
            <Button title="Record payment" icon="check" onPress={save} busy={busy} disabled={!ok} />
        </Sheet>
    );
}

function ChemistLedger({ pharmacyId, onBack, onDeliver, onPay }) {
    const state = useLoad(async () => (await api.get(`/app/ledger/chemists/${pharmacyId}`)).data, [pharmacyId], "Couldn't load the chemist's ledger.");
    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Chemist ledger" title={state.data ? titleCase(state.data.pharmacy.PharmacyName) : '…'} onBack={onBack} />
            <Loadable state={state}>
                {(d) => (
                    <>
                        {d.blocked ? <Notice tone="error" title="New supply blocked">{d.reasons.join('; ')}</Notice> : null}
                        <StatGrid
                            items={[
                                { icon: 'alert-circle', label: 'Owes', value: rupees(d.balance), caption: d.oldestDays ? `oldest ${d.oldestDays} days` : 'nothing overdue', tone: d.blocked ? 'error' : 'warning' },
                                { icon: 'sliders', label: 'Credit limit', value: d.limit == null ? 'None' : rupees(d.limit), caption: `Block after ${d.blockDays} days` },
                            ]}
                        />
                        <Card style={{ marginBottom: space(1.5) }}>
                            <KeyValue rows={BUCKETS.map(([k, l]) => [l, rupees(d.buckets?.[k])])} />
                        </Card>
                        <View style={styles.actions}>
                            <Button title="Deliver" icon="truck" onPress={onDeliver} disabled={d.blocked} style={{ flex: 1 }} />
                            <Button title="Collect payment" icon="dollar-sign" variant="outline" onPress={onPay} disabled={!d.balance} style={{ flex: 1 }} />
                        </View>
                        <SectionTitle title="Ledger" />
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {(d.entries || []).length ? (
                                d.entries.map((e, i) => (
                                    <View key={e.EntryId} style={i > 0 && line}>
                                        <ListRow
                                            title={`${ENTRY[e.EntryType] || titleCase(e.EntryType)} · ${rupees(e.Amount)}`}
                                            caption={[day(e.EntryDate), e.DeliveryNumber, e.PaymentMode && `${e.PaymentMode}${e.PaymentRef ? ` ${e.PaymentRef}` : ''}`, e.DepositStatus && titleCase(e.DepositStatus), e.CreatedByName && `by ${titleCase(e.CreatedByName)}`, e.VoidedOn && `voided: ${e.VoidReason}`].filter(Boolean).join(' · ')}
                                            chevron={false}
                                        />
                                    </View>
                                ))
                            ) : (
                                <Empty icon="book" title="No entries yet" />
                            )}
                        </Card>
                    </>
                )}
            </Loadable>
        </Screen>
    );
}

function StockTab({ userId }) {
    const state = useLoad(async () => (await api.get('/app/ledger/stock', { params: { userId: userId || undefined } })).data, [userId], "Couldn't load stock.");
    return (
        <Loadable state={state}>
            {(d) => (
                <>
                    <StatGrid
                        items={[
                            { icon: 'package', label: 'Stock in hand', value: rupees(d.totals.balanceValue), caption: `${d.totals.balanceQty} units · limit ${rupees(d.limit)}`, tone: d.totals.balanceValue > d.limit ? 'error' : 'brand' },
                            { icon: 'truck', label: 'Delivered', value: `${d.totals.delivered}`, caption: `issued ${d.totals.issued} · returned ${d.totals.returned}`, tone: 'info' },
                        ]}
                    />
                    {d.heldLong.length ? <Notice tone="warning" title={`Held more than ${d.holdDays} days`}>{d.heldLong.map((l) => `• ${l.ProductName} ${l.BatchNumber}: ${l.quantity} for ${l.ageDays} days`).join('\n')}</Notice> : null}
                    <SectionTitle title="By batch" />
                    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.5) }}>
                        {d.balances.length ? (
                            d.balances.map((b, i) => (
                                <View key={b.BatchId} style={i > 0 && line}>
                                    <ListRow title={`${b.ProductName} · ${b.BatchNumber}`} caption={`${b.Quantity} units · ${rupees(b.Value)} · exp ${day(b.ExpiryDate)}`} chevron={false} />
                                </View>
                            ))
                        ) : (
                            <Empty icon="package" title="No stock held" />
                        )}
                    </Card>
                    <SectionTitle title="Movements" />
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {d.entries.slice(0, 30).map((e, i) => (
                            <View key={e.EntryId} style={i > 0 && line}>
                                <ListRow title={`${ENTRY[e.EntryType] || titleCase(e.EntryType)} · ${e.ProductName} ${e.BatchNumber || ''}`} caption={[day(e.EntryDate), `${e.Quantity} units`, rupees(e.Value), e.PharmacyName && titleCase(e.PharmacyName), e.VoidedOn && 'voided'].filter(Boolean).join(' · ')} chevron={false} />
                            </View>
                        ))}
                    </Card>
                </>
            )}
        </Loadable>
    );
}

function DuesTab({ userId, onOpen }) {
    const state = useLoad(async () => (await api.get('/app/ledger/chemists', { params: { userId: userId || undefined } })).data, [userId], "Couldn't load chemist dues.");
    return (
        <Loadable state={state}>
            {(d) => (
                <>
                    <StatGrid
                        items={[
                            { icon: 'alert-circle', label: 'Total dues', value: rupees(d.totals.balance), caption: `${d.totals.blocked} chemists blocked`, tone: d.totals.blocked ? 'error' : 'warning' },
                            { icon: 'clock', label: 'Over 90 days', value: rupees(d.totals.buckets?.d90_plus), caption: `61–90 d ${rupees(d.totals.buckets?.d61_90)}`, tone: 'error' },
                        ]}
                    />
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {d.chemists.length ? (
                            d.chemists.map((c, i) => (
                                <View key={c.PharmacyId} style={i > 0 && line}>
                                    <ListRow title={titleCase(c.PharmacyName)} caption={[`owes ${rupees(c.balance)}`, c.oldestDays && `oldest ${c.oldestDays} d`, c.Owners && `with ${c.Owners}`].filter(Boolean).join(' · ')} right={c.blocked ? <Tag label="Blocked" tone="error" /> : null} onPress={() => onOpen(c.PharmacyId)} />
                                </View>
                            ))
                        ) : (
                            <Empty icon="home" title="No chemists" />
                        )}
                    </Card>
                </>
            )}
        </Loadable>
    );
}

function HoldingsTab() {
    const state = useLoad(async () => (await api.get('/app/ledger/holdings')).data, [], "Couldn't load holdings.");
    return (
        <Loadable state={state}>
            {(d) => (
                <>
                    <Text style={[text.small, { marginBottom: space(1.5) }]}>{`Stock each MR holds. Limit ${rupees(d.limit)}; flagged after ${d.holdDays} days.`}</Text>
                    <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.5) }}>
                        {d.holdings.map((h, i) => (
                            <View key={h.UserId} style={i > 0 && line}>
                                <ListRow title={titleCase(h.Name)} caption={`${h.Quantity} units`} right={<Tag label={rupees(h.Value)} tone={h.overLimit ? 'error' : 'neutral'} />} chevron={false} />
                            </View>
                        ))}
                    </Card>
                    {d.heldLong.length ? (
                        <>
                            <SectionTitle title="Held too long" />
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {d.heldLong.map((l, i) => (
                                    <View key={`${l.UserId}-${l.BatchNumber}-${i}`} style={i > 0 && line}>
                                        <ListRow title={`${l.ProductName} · ${l.BatchNumber}`} caption={`${titleCase(l.UserName)} · ${l.quantity} units · ${l.ageDays} days`} chevron={false} />
                                    </View>
                                ))}
                            </Card>
                        </>
                    ) : null}
                </>
            )}
        </Loadable>
    );
}

function DepositsTab() {
    const state = useLoad(async () => (await api.get('/app/ledger/payments/with-mr')).data, [], "Couldn't load payments.");
    const confirm = async (p) => {
        try {
            const r = (await api.post(`/app/ledger/payments/${p.EntryId}/confirm`)).data;
            toast(r?.message || 'Deposit confirmed');
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    return (
        <Loadable state={state}>
            {(d) =>
                d.payments.length ? (
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {d.payments.map((p, i) => (
                            <View key={p.EntryId} style={[styles.pad, i > 0 && line]}>
                                <Text style={text.subtitle}>{`${rupees(p.Amount)} · ${titleCase(p.PharmacyName)}`}</Text>
                                <Text style={text.small}>{[day(p.EntryDate), titleCase(p.UserName), `${p.PaymentMode}${p.PaymentRef ? ` ${p.PaymentRef}` : ''}`].join(' · ')}</Text>
                                <Button title="Money received" small icon="check" onPress={() => confirm(p)} style={{ marginTop: space(1), alignSelf: 'flex-start' }} />
                            </View>
                        ))}
                    </Card>
                ) : (
                    <Card>
                        <Empty icon="check-circle" title="No payments waiting" caption="Payments MRs collect wait here until the money reaches the company." />
                    </Card>
                )
            }
        </Loadable>
    );
}

function SchemesTab() {
    const state = useLoad(async () => (await api.get('/app/ledger/schemes')).data, [], "Couldn't load schemes.");
    return (
        <Loadable state={state}>
            {(d) =>
                d.schemes.length ? (
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {d.schemes.map((s, i) => (
                            <View key={s.SchemeId} style={i > 0 && line}>
                                <ListRow title={`${titleCase(s.Kind)} · ${rupees(s.Value)}`} caption={[day(s.BillingDate), s.ProductName, titleCase(s.PharmacyName || s.StockistName), s.DoctorName, s.Description, s.VoidedOn && `voided: ${s.VoidReason}`].filter(Boolean).join(' · ')} chevron={false} />
                            </View>
                        ))}
                    </Card>
                ) : (
                    <Card>
                        <Empty icon="tag" title="No schemes this month" caption="Schemes are recorded by head office on the web." />
                    </Card>
                )
            }
        </Loadable>
    );
}

function ExitsTab() {
    const state = useLoad(async () => (await api.get('/app/ledger/exits')).data, [], "Couldn't load exit clearances.");
    return (
        <Loadable state={state}>
            {(d) =>
                d.clearances.length ? (
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {d.clearances.map((c, i) => (
                            <View key={c.ClearanceId} style={i > 0 && line}>
                                <ListRow title={titleCase(c.UserName)} caption={`Leaving ${day(c.LeavingDate)} · ${c.OpenItems} of ${c.TotalItems} items open${c.SuccessorName ? ` · to ${titleCase(c.SuccessorName)}` : ''}`} right={<Tag label={titleCase(c.Status)} tone={c.Status === 'CLOSED' ? 'success' : 'warning'} />} chevron={false} />
                            </View>
                        ))}
                    </Card>
                ) : (
                    <Card>
                        <Empty icon="log-out" title="No exit clearances" caption="When someone leaves, their stock and dues are handed over here (started on the web)." />
                    </Card>
                )
            }
        </Loadable>
    );
}

// Field stock & dues: stock MRs hold, chemist dues and ledgers, deliveries and payments; head-office checks.
export default function FieldLedger({ navigation }) {
    const permissions = usePermissions();
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [tab, setTab] = useState('dues');
    const [chemist, setChemist] = useState(null);
    const [sheet, setSheet] = useState(null); // { kind: 'deliver' | 'pay', pharmacyId }
    const canRecord = permissions.has('ledger.create');
    const headOffice = permissions.has('ledger.approve');
    const options = useLoad(async () => (canRecord ? (await api.get('/app/ledger/options')).data : null), [canRecord, sheet ? 1 : 0], '');

    const sheets = (
        <>
            {sheet?.kind === 'deliver' && options.data ? <DeliverySheet options={options.data} pharmacyId={sheet.pharmacyId} onClose={() => setSheet(null)} onSaved={() => setSheet(null)} /> : null}
            {sheet?.kind === 'pay' && options.data ? <PaymentSheet chemists={options.data.chemists} pharmacyId={sheet.pharmacyId} onClose={() => setSheet(null)} onSaved={() => setSheet(null)} /> : null}
        </>
    );

    if (chemist)
        return (
            <>
                <ChemistLedger pharmacyId={chemist} onBack={() => setChemist(null)} onDeliver={() => setSheet({ kind: 'deliver', pharmacyId: chemist })} onPay={() => setSheet({ kind: 'pay', pharmacyId: chemist })} />
                {sheets}
            </>
        );

    const tabs = [
        { value: 'dues', label: 'Chemist dues' },
        { value: 'stock', label: 'Stock in hand' },
        headOffice && { value: 'holdings', label: 'Holdings' },
        headOffice && { value: 'deposits', label: 'Deposits' },
        headOffice && { value: 'schemes', label: 'Schemes' },
        headOffice && { value: 'exits', label: 'Exits' },
    ].filter(Boolean);

    return (
        <Screen>
            <Header overline="Sales & distribution" title="Field stock & dues" onBack={() => navigation.goBack()} />
            {canRecord ? (
                <View style={styles.actions}>
                    <Button title="Deliver" icon="truck" small onPress={() => setSheet({ kind: 'deliver' })} style={{ flex: 1 }} />
                    <Button title="Collect payment" icon="dollar-sign" variant="outline" small onPress={() => setSheet({ kind: 'pay' })} style={{ flex: 1 }} />
                </View>
            ) : null}
            <Chips options={tabs} value={tab} onChange={setTab} />
            {['dues', 'stock'].includes(tab) ? <PersonPicker people={people} value={userId} onChange={setUserId} /> : null}
            {tab === 'dues' && <DuesTab userId={userId} onOpen={setChemist} />}
            {tab === 'stock' && <StockTab userId={userId} />}
            {tab === 'holdings' && <HoldingsTab />}
            {tab === 'deposits' && <DepositsTab />}
            {tab === 'schemes' && <SchemesTab />}
            {tab === 'exits' && <ExitsTab />}
            {sheets}
        </Screen>
    );
}

const styles = StyleSheet.create({
    actions: { flexDirection: 'row', gap: space(1), marginBottom: space(1.5) },
    pad: { padding: space(1.5) },
    label: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.inkSoft, marginBottom: 6 },
    batchRow: { flexDirection: 'row', alignItems: 'center', gap: space(1), paddingVertical: space(1), borderBottomWidth: 1, borderBottomColor: colors.lineSoft },
    qty: { width: 70, borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 8, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, textAlign: 'center' },
    photo: { width: '100%', height: 150, borderRadius: radius.md, marginBottom: space(1), backgroundColor: colors.lineSoft },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4), maxHeight: '92%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
});
