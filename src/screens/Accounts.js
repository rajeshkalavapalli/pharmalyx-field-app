import { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, TextInput, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, monthKey, rupees } from '../api';
import { titleCase } from '../format';
import { colors, fonts, radius, space, text } from '../theme';
import useLoad from '../useLoad';
import { Button, Card, Empty, Header, KeyValue, ListRow, Loadable, MonthSwitcher, Screen, SectionTitle, StatGrid, Tag } from '../ui';
import { ORDER_STATUS } from './Orders';

// Retailers (chemists) or stockists assigned to me: this month's and lifetime business; tap for details.
export default function Accounts({ navigation, route }) {
    const kind = route.params?.kind === 'stockists' ? 'stockists' : 'retailers';
    const [month, setMonth] = useState(monthKey());
    const [query, setQuery] = useState('');
    const [open, setOpen] = useState(null);
    const state = useLoad(async () => (await api.get(`/app/sales/${kind}`, { params: { month } })).data, [kind, month], `Couldn't load ${kind}.`);
    const detail = useLoad(async () => (open ? (await api.get(`/app/sales/${kind}/${open}`, { params: { month } })).data : null), [kind, open, month], "Couldn't load the account.");
    const stockist = kind === 'stockists';

    const shown = useMemo(() => {
        const q = query.trim().toLowerCase();
        return (state.data?.accounts || []).filter((a) => !q || `${a.Name} ${a.AreaName || ''} ${a.OwnerName || ''}`.toLowerCase().includes(q));
    }, [state.data, query]);

    if (open) {
        return (
            <Screen refreshControl={detail.refreshControl}>
                <Header overline={stockist ? 'Stockist' : 'Retailer'} title={detail.data ? titleCase(detail.data.account.Name) : '…'} onBack={() => setOpen(null)} />
                <Loadable state={detail}>
                    {(d) => (
                        <>
                            <Card style={{ marginBottom: space(1.5) }}>
                                <KeyValue
                                    rows={[
                                        ['Owner', titleCase(d.account.OwnerName)],
                                        ['Phone', d.account.ContactNumber],
                                        ['Area', [titleCase(d.account.AreaName), titleCase(d.account.TerritoryName)].filter(Boolean).join(', ')],
                                        ['Drug licence', d.account.DrugLicenceNumber],
                                        ['GSTIN', d.account.GSTIN],
                                        ['This month', `${rupees(d.account.MonthValue)} · ${d.account.MonthOrders} orders`],
                                        ['All time', `${rupees(d.account.TotalValue)} · ${d.account.TotalOrders} orders`],
                                        ['Last order', d.account.LastOrderDate],
                                        !stockist && ['Last RCPA', d.account.LastRcpaDate],
                                    ]}
                                />
                                {d.account.Address ? <Text style={[text.small, { marginTop: space(1) }]}>{d.account.Address}</Text> : null}
                            </Card>
                            {d.account.ContactNumber ? <Button title="Call" icon="phone" variant="outline" onPress={() => Linking.openURL(`tel:${d.account.ContactNumber}`)} style={{ marginBottom: space(1.5) }} /> : null}
                            <SectionTitle title="Recent orders" />
                            {d.orders.length ? (
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    {d.orders.map((o, i) => (
                                        <View key={o.OrderId} style={i > 0 && styles.line}>
                                            <ListRow title={`${o.OrderNumber} · ${rupees(o.NetAmount)}`} caption={[o.OrderDate, o.UserName && titleCase(o.UserName)].filter(Boolean).join(' · ')} right={ORDER_STATUS[o.Status] ? <Tag label={ORDER_STATUS[o.Status].label} tone={ORDER_STATUS[o.Status].tone} /> : null} chevron={false} />
                                        </View>
                                    ))}
                                </Card>
                            ) : (
                                <Card>
                                    <Empty icon="shopping-bag" title="No orders yet" />
                                </Card>
                            )}
                        </>
                    )}
                </Loadable>
            </Screen>
        );
    }

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Sales & distribution" title={stockist ? 'Stockists' : 'Retailers'} onBack={() => navigation.goBack()} />
            <MonthSwitcher value={month} onChange={setMonth} />
            <View style={styles.search}>
                <Feather name="search" size={16} color={colors.inkMuted} />
                <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search name, area, owner" placeholderTextColor={colors.inkFaint} autoCorrect={false} autoCapitalize="none" />
            </View>
            <Loadable state={state} rows={6}>
                {(data) => {
                    const s = data.summary;
                    return (
                        <>
                            <StatGrid
                                items={[
                                    { icon: 'shopping-bag', label: 'This month', value: rupees(s.monthValue), caption: `${s.monthOrders} orders` },
                                    stockist
                                        ? { icon: 'clock', label: 'Pending supply', value: rupees(s.pendingValue), caption: `${s.pendingOrders} orders`, tone: 'warning' }
                                        : { icon: 'users', label: 'Ordering', value: `${s.ordering}/${s.total}`, caption: `${s.neverOrdered} never ordered`, tone: 'info' },
                                ]}
                            />
                            {shown.length ? (
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    {shown.map((a, i) => (
                                        <View key={a.AccountId} style={i > 0 && styles.line}>
                                            <ListRow
                                                icon={stockist ? 'truck' : 'home'}
                                                title={titleCase(a.Name)}
                                                caption={[titleCase(a.AreaName), `${rupees(a.MonthValue)} this month`, a.LastOrderDate ? `last order ${a.LastOrderDate}` : 'no orders yet'].filter(Boolean).join(' · ')}
                                                onPress={() => setOpen(a.AccountId)}
                                            />
                                        </View>
                                    ))}
                                </Card>
                            ) : (
                                <Card>
                                    <Empty icon={stockist ? 'truck' : 'home'} title={query ? 'No match' : `No ${kind} assigned`} caption={query ? undefined : 'Mapping is done in Configuration on the web.'} />
                                </Card>
                            )}
                        </>
                    );
                }}
            </Loadable>
        </Screen>
    );
}

const styles = StyleSheet.create({
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 46, marginBottom: space(1.5) },
    searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 14, color: colors.ink, paddingVertical: 8 },
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
});
