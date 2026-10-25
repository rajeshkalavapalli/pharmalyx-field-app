import { useState } from 'react';
import { Alert, Image, StyleSheet, Text, View } from 'react-native';

import { api, authImage, errorMessage, monthKey, rupees } from '../api';
import { doctorName, titleCase } from '../format';
import { usePermissions } from '../permissions';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Header, Loadable, MonthSwitcher, ReasonDialog, Screen, SectionTitle, StatGrid, Tag } from '../ui';

// POB follow-up: Raised -> Under follow-up -> Supplied -> Verified (same labels as the web app).
export const ORDER_STATUS = {
    BOOKED: { label: 'Raised', tone: 'info' },
    CONFIRMED: { label: 'Under follow-up', tone: 'warning' },
    SUPPLIED: { label: 'Supplied', tone: 'success' },
    VERIFIED: { label: 'Verified', tone: 'primary' },
    CANCELLED: { label: 'Cancelled', tone: 'error' },
};
const statusOf = (order) => (order.Status === 'SUPPLIED' && order.VerifiedOn ? ORDER_STATUS.VERIFIED : ORDER_STATUS[order.Status]);
const shortDate = (key) => new Date(`${String(key).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Next steps (the server enforces the same rules). The MR marks supplied or cancels; the manager follows up and verifies.
const actionsFor = (order, team) => {
    if (team) {
        if (order.Status === 'BOOKED') return [{ status: 'CONFIRMED', label: 'Follow up with MR', variant: 'outline', remarks: 'optional' }];
        if (order.Status === 'SUPPLIED' && !order.VerifiedOn) return [{ status: 'VERIFIED', label: 'Verify', variant: 'primary', remarks: 'none' }];
        return [];
    }
    if (order.Status === 'BOOKED' || order.Status === 'CONFIRMED') {
        return [
            { status: 'SUPPLIED', label: 'Mark supplied', variant: 'primary', remarks: 'none' },
            { status: 'CANCELLED', label: 'Cancel', variant: 'danger', remarks: 'required' },
        ];
    }
    return [];
};

// POB orders for a month: mine (mark supplied / cancel) or my team's (follow up / verify).
export default function Orders({ navigation, route }) {
    const permissions = usePermissions();
    const [month, setMonth] = useState(monthKey());
    const [scope, setScope] = useState(route.params?.scope === 'team' ? 'team' : 'self');
    const state = useLoad(async () => (await api.get('/app/orders', { params: { month, scope } })).data, [month, scope], "Couldn't load orders.");
    const [pending, setPending] = useState(null); // { order, action }
    const [slipFor, setSlipFor] = useState(null);
    const team = scope === 'team';

    const run = async (order, action, remarks) => {
        try {
            const r = (await api.post(`/app/orders/${order.OrderId}/status`, { Status: action.status, Remarks: remarks || null })).data;
            toast(r?.message || 'Saved');
            setPending(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    const start = (order, action) => {
        if (action.remarks === 'none')
            Alert.alert(`${action.label}?`, `${order.OrderNumber} · ${order.CustomerName}`, [
                { text: 'Not now', style: 'cancel' },
                { text: action.label, onPress: () => run(order, action) },
            ]);
        else setPending({ order, action });
    };

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="POB orders" title={team ? 'Team orders' : 'My orders'} onBack={() => navigation.goBack()} right={!team && permissions.has('orders.create') ? <Button title="New" icon="plus" small onPress={() => navigation.navigate('NewOrder')} /> : null} />
            {state.data?.hasTeam || team ? (
                <Chips
                    options={[
                        { value: 'self', label: 'Mine' },
                        { value: 'team', label: 'My team' },
                    ]}
                    value={scope}
                    onChange={setScope}
                />
            ) : null}
            <MonthSwitcher value={month} onChange={setMonth} />
            <Loadable state={state}>
                {(data) => {
                    const s = data.summary;
                    return (
                        <>
                            <StatGrid
                                items={[
                                    { icon: 'shopping-bag', label: 'Order value', value: rupees(s.value), caption: `${s.orders} order${s.orders === 1 ? '' : 's'} · ${s.customers} customers` },
                                    { icon: 'clock', label: 'Waiting supply', value: `${s.pending}`, caption: `${rupees(s.suppliedValue)} supplied`, tone: 'warning' },
                                ]}
                            />
                            {team && data.followUpDue?.length ? <Text style={[text.small, { color: colors.warningDark, marginBottom: space(1.5) }]}>{`${data.followUpDue.length} order(s) older than ${data.followUpAfterDays} days are not supplied yet.`}</Text> : null}
                            {s.topProducts?.length ? (
                                <>
                                    <SectionTitle title="Top products" />
                                    <Card style={{ marginBottom: space(1.5) }}>
                                        {s.topProducts.map((p) => (
                                            <View key={p.ProductId} style={styles.productRow}>
                                                <Text style={[text.body, { flex: 1 }]}>{p.ProductName}</Text>
                                                <Text style={text.small}>{`${p.quantity}${p.freeQuantity ? ` + ${p.freeQuantity}` : ''}`}</Text>
                                                <Text style={[text.subtitle, { width: 90, textAlign: 'right' }]}>{rupees(p.value)}</Text>
                                            </View>
                                        ))}
                                    </Card>
                                </>
                            ) : null}
                            <SectionTitle title="Orders" caption={team ? 'Follow up raised orders; verify supplied ones.' : 'Mark an order supplied once the stockist delivers it.'} />
                            {data.orders.length ? (
                                <View style={{ gap: space(1.25) }}>
                                    {data.orders.map((order) => {
                                        const status = statusOf(order);
                                        return (
                                            <Card key={order.OrderId} style={{ padding: space(1.5) }}>
                                                <View style={styles.top}>
                                                    <Text style={[text.subtitle, { flex: 1 }]} numberOfLines={1}>
                                                        {order.CustomerType === 'DOCTOR' ? doctorName(order.CustomerName) : titleCase(order.CustomerName)}
                                                    </Text>
                                                    <Text style={text.subtitle}>{rupees(order.NetAmount)}</Text>
                                                </View>
                                                <Text style={text.small} numberOfLines={1}>
                                                    {[order.OrderNumber, shortDate(order.OrderDate), titleCase(order.StockistName), team && titleCase(order.UserName)].filter(Boolean).join(' · ')}
                                                </Text>
                                                <View style={styles.tags}>
                                                    {status ? <Tag label={status.label} tone={status.tone} /> : null}
                                                    <Tag label={order.CustomerType === 'DOCTOR' ? 'Doctor' : 'Chemist'} tone="neutral" />
                                                    {order.TotalFreeQuantity ? <Tag label={`${order.TotalFreeQuantity} free`} tone="neutral" /> : null}
                                                    {order.DistanceFromChemistM != null ? <Tag label={`${order.DistanceFromChemistM} m from chemist`} tone={order.DistanceFromChemistM > 200 ? 'warning' : 'neutral'} /> : null}
                                                </View>
                                                {(order.lines || []).slice(0, 5).map((line) => (
                                                    <Text key={line.ProductId} style={text.small}>
                                                        • {line.ProductName} × {line.Quantity}
                                                        {line.FreeQuantity ? ` + ${line.FreeQuantity}` : ''}
                                                    </Text>
                                                ))}
                                                {order.StatusRemarks ? <Text style={[text.small, { marginTop: 4 }]}>Note: “{order.StatusRemarks}”</Text> : null}
                                                {order.HasSlip ? (
                                                    slipFor === order.OrderId ? (
                                                        <Image source={authImage(`/app/orders/${order.OrderId}/slip`)} style={styles.slip} resizeMode="contain" />
                                                    ) : (
                                                        <Button title="View order slip" icon="image" variant="ghost" small onPress={() => setSlipFor(order.OrderId)} style={{ alignSelf: 'flex-start', marginTop: 4 }} />
                                                    )
                                                ) : null}
                                                {actionsFor(order, team).length ? (
                                                    <View style={styles.actions}>
                                                        {actionsFor(order, team).map((action) => (
                                                            <Button key={action.status} title={action.label} small variant={action.variant} onPress={() => start(order, action)} style={{ flex: 1 }} />
                                                        ))}
                                                    </View>
                                                ) : null}
                                            </Card>
                                        );
                                    })}
                                </View>
                            ) : (
                                <Card>
                                    <Empty icon="shopping-bag" title="No orders this month" caption={team ? 'Orders your team books appear here.' : 'Book the doctor or chemist orders you collect in the field.'} />
                                    {!team && month === monthKey() && permissions.has('orders.create') ? <Button title="Book an order" icon="plus" variant="outline" onPress={() => navigation.navigate('NewOrder')} /> : null}
                                </Card>
                            )}
                        </>
                    );
                }}
            </Loadable>
            <ReasonDialog
                visible={Boolean(pending)}
                title={pending ? `${pending.action.label}?` : ''}
                caption={pending ? `${pending.order.OrderNumber} · ${pending.order.CustomerName}` : ''}
                label={pending?.action.remarks === 'required' ? 'Reason' : 'Remarks (optional)'}
                minLength={pending?.action.remarks === 'required' ? 3 : 0}
                submitLabel={pending?.action.label || 'Save'}
                onSubmit={(remarks) => run(pending.order, pending.action, remarks)}
                onClose={() => setPending(null)}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginVertical: 6 },
    actions: { flexDirection: 'row', gap: space(1), marginTop: space(1.25) },
    productRow: { flexDirection: 'row', alignItems: 'center', gap: space(1), paddingVertical: 5 },
    slip: { width: '100%', height: 260, borderRadius: radius.md, marginTop: space(1), backgroundColor: colors.lineSoft },
});
