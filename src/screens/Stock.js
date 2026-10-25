import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, errorMessage } from '../api';
import { doctorName, titleCase } from '../format';
import { PersonPicker, usePeople } from '../people';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, ListRow, Loadable, Screen, Select, StatGrid, Tag } from '../ui';

const ENTRY = { ISSUE: { label: 'Issued', tone: 'success' }, DISTRIBUTION: { label: 'Given', tone: 'info' }, RETURN: { label: 'Returned', tone: 'warning' }, ADJUSTMENT: { label: 'Adjusted', tone: 'neutral' } };
const LOW = 5;

// Issue (manager) or return (rep) units of a sample / gift.
function MoveSheet({ mode, kind, userId, people, balances, onClose, onSaved }) {
    const [items, setItems] = useState([]);
    const [person, setPerson] = useState(userId || '');
    const [item, setItem] = useState('');
    const [qty, setQty] = useState('');
    const [batch, setBatch] = useState('');
    const [remarks, setRemarks] = useState('');
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (mode !== 'issue') return;
        const path = kind === 'SAMPLE' ? '/app/catalogue/products' : '/app/catalogue/gifts';
        api.get(path, { params: { active: '1' } })
            .then((r) => setItems((kind === 'SAMPLE' ? r.data?.products : r.data?.gifts) || []))
            .catch(() => setItems([]));
    }, [mode, kind]);

    const options =
        mode === 'issue'
            ? items.map((i) => ({ value: i.ProductId || i.GiftId, label: i.ProductName || i.GiftName, detail: i.PackSize || i.Description }))
            : balances.filter((b) => b.Balance > 0).map((b) => ({ value: b.ItemId, label: b.ItemName, detail: `${b.Balance} in hand` }));
    const ok = item && Number(qty) > 0 && (mode === 'issue' ? person : remarks.trim().length >= 3);

    const save = async () => {
        setBusy(true);
        try {
            const body = mode === 'issue' ? { UserId: person, ItemType: kind, ItemId: item, Quantity: Number(qty), BatchNumber: batch.trim() || null, Remarks: remarks.trim() || null } : { ItemType: kind, ItemId: item, Quantity: Number(qty), Remarks: remarks.trim() };
            const r = (await api.post(`/app/stock/${mode}`, body)).data;
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
                        <Text style={[text.title, { flex: 1 }]}>{mode === 'issue' ? `Issue ${kind === 'SAMPLE' ? 'samples' : 'gifts'}` : `Return ${kind === 'SAMPLE' ? 'samples' : 'gifts'}`}</Text>
                        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    {mode === 'issue' ? (
                        <Select label="To" value={person} options={people.users.filter((u) => String(u.UserId).toLowerCase() !== people.meId).map((u) => ({ value: u.UserId, label: titleCase(u.Name) }))} onChange={setPerson} />
                    ) : null}
                    <Select label={kind === 'SAMPLE' ? 'Product' : 'Gift'} value={item} options={options} onChange={setItem} searchable />
                    <Field label="Quantity" value={qty} onChangeText={(v) => setQty(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" />
                    {mode === 'issue' && kind === 'SAMPLE' ? <Field label="Batch no. (optional)" value={batch} onChangeText={(v) => setBatch(v.slice(0, 50))} autoCapitalize="characters" /> : null}
                    <Field label={mode === 'issue' ? 'Remarks (optional)' : 'Reason *'} value={remarks} onChangeText={(v) => setRemarks(v.slice(0, 300))} autoCapitalize="sentences" />
                    <Button title={mode === 'issue' ? 'Issue' : 'Return'} icon="check" onPress={save} busy={busy} disabled={!ok} />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// Samples or gifts in hand: balances, what moved, return; managers issue to their team.
export default function Stock({ navigation, route }) {
    const kind = route.params?.kind === 'GIFT' ? 'GIFT' : 'SAMPLE';
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [tab, setTab] = useState('balances');
    const [moving, setMoving] = useState(null); // issue | return
    const balances = useLoad(async () => (await api.get('/app/stock/balances', { params: { userId: userId || undefined, itemType: kind } })).data.balances, [userId, kind], "Couldn't load stock.");
    const ledger = useLoad(async () => (tab === 'ledger' ? (await api.get('/app/stock/ledger', { params: { userId: userId || undefined, itemType: kind } })).data.ledger : []), [userId, kind, tab], "Couldn't load stock history.");
    const noun = kind === 'SAMPLE' ? 'samples' : 'gifts';

    return (
        <Screen refreshControl={balances.refreshControl}>
            <Header overline="Doctor engagement" title={kind === 'SAMPLE' ? 'Samples' : 'Gifts'} onBack={() => navigation.goBack()} />
            <PersonPicker people={people} value={userId} onChange={setUserId} />
            <View style={styles.actions}>
                {!userId ? <Button title="Return" icon="corner-up-left" variant="outline" small onPress={() => setMoving('return')} style={{ flex: 1 }} /> : null}
                {people.hasTeam ? <Button title="Issue to team" icon="send" small onPress={() => setMoving('issue')} style={{ flex: 1 }} /> : null}
            </View>
            <Chips
                options={[
                    { value: 'balances', label: 'In hand' },
                    { value: 'ledger', label: 'History' },
                ]}
                value={tab}
                onChange={setTab}
            />
            {tab === 'balances' ? (
                <Loadable state={balances}>
                    {(rows) => (
                        <>
                            <StatGrid
                                items={[
                                    { icon: 'package', label: 'Units in hand', value: `${rows.reduce((s, r) => s + r.Balance, 0)}`, caption: `${rows.length} items` },
                                    { icon: 'gift', label: 'Given this month', value: `${rows.reduce((s, r) => s + r.GivenThisMonth, 0)}`, tone: 'info' },
                                ]}
                            />
                            {rows.length ? (
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    {rows.map((r, i) => (
                                        <View key={r.ItemId} style={i > 0 && styles.line}>
                                            <ListRow title={r.ItemName} caption={`${r.ItemDetail ? `${r.ItemDetail} · ` : ''}issued ${r.TotalIssued} · given ${r.TotalGiven}`} right={<Tag label={`${r.Balance} left`} tone={r.Balance <= 0 ? 'error' : r.Balance <= LOW ? 'warning' : 'success'} />} chevron={false} />
                                        </View>
                                    ))}
                                </Card>
                            ) : (
                                <Card>
                                    <Empty icon="package" title={`No ${noun} in hand`} caption={`Your manager issues ${noun}; you give them in visits.`} />
                                </Card>
                            )}
                        </>
                    )}
                </Loadable>
            ) : (
                <Loadable state={ledger}>
                    {(rows) =>
                        rows.length ? (
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {rows.map((r, i) => (
                                    <View key={r.EntryId} style={i > 0 && styles.line}>
                                        <ListRow
                                            title={`${r.ItemName} · ${Math.abs(r.Quantity)}`}
                                            caption={[r.EntryDate, r.DoctorName && doctorName(r.DoctorName), r.BatchNumber && `batch ${r.BatchNumber}`, r.Remarks, r.CreatedByName && `by ${titleCase(r.CreatedByName)}`].filter(Boolean).join(' · ')}
                                            right={<Tag label={ENTRY[r.EntryType]?.label || r.EntryType} tone={ENTRY[r.EntryType]?.tone} />}
                                            chevron={false}
                                        />
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <Card>
                                <Empty icon="list" title="No movements this year" />
                            </Card>
                        )
                    }
                </Loadable>
            )}
            {moving ? (
                <MoveSheet
                    mode={moving}
                    kind={kind}
                    userId={userId}
                    people={people}
                    balances={balances.data || []}
                    onClose={() => setMoving(null)}
                    onSaved={() => {
                        setMoving(null);
                        balances.reload();
                        ledger.reload();
                    }}
                />
            ) : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    actions: { flexDirection: 'row', gap: space(1), marginBottom: space(1.5) },
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4), maxHeight: '90%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
});
