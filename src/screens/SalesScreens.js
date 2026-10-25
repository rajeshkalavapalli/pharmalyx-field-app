import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, monthKey, rupees } from '../api';
import { doctorName, titleCase } from '../format';
import { colors, space, text } from '../theme';
import useLoad from '../useLoad';
import { Card, Chips, Empty, Header, ListRow, Loadable, MiniBars, MonthSwitcher, Screen, SectionTitle, StatGrid, Tag } from '../ui';
import { STATEMENT_STATUS } from './Secondary';

const STOCK_STATUS = {
    OUT: { label: 'Out of stock', tone: 'error' },
    LOW: { label: 'Low cover', tone: 'warning' },
    HEALTHY: { label: 'Healthy', tone: 'success' },
    HIGH: { label: 'Overstock', tone: 'info' },
    NO_MOVEMENT: { label: 'No movement', tone: 'neutral' },
};
const line = { borderTopWidth: 1, borderTopColor: colors.lineSoft };
const monthShort = (key) => new Date(`${String(key).slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'short' });
const change = (c) => (c == null ? '' : `${c >= 0 ? '+' : ''}${c}% vs last month`);

// Stock at each stockist from the latest statement: out of stock, low cover, overstock.
export function StockPosition({ navigation }) {
    const state = useLoad(async () => (await api.get('/app/sales/stock')).data, [], "Couldn't load stock position.");
    const [open, setOpen] = useState(null);
    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Sales & distribution" title="Stock position" onBack={() => navigation.goBack()} />
            <Loadable state={state}>
                {(data) => (
                    <>
                        <StatGrid
                            items={[
                                { icon: 'archive', label: 'Closing stock', value: rupees(data.summary.closingValue), caption: `${data.summary.reporting} of ${data.summary.stockists} stockists reporting` },
                                { icon: 'alert-triangle', label: 'Out / low', value: `${data.summary.outOfStock}/${data.summary.lowStock}`, caption: `${data.summary.overStock} overstocked`, tone: data.summary.outOfStock ? 'error' : 'warning' },
                            ]}
                        />
                        <Text style={[text.small, { marginBottom: space(1.5) }]}>{`Low cover = under ${data.thresholds.low} days of sales; overstock = over ${data.thresholds.high} days.`}</Text>
                        {data.stockists.length ? (
                            <View style={{ gap: space(1.25) }}>
                                {data.stockists.map((s) => (
                                    <Card key={s.StockistId} style={{ padding: 0, overflow: 'hidden' }}>
                                        <ListRow
                                            icon="truck"
                                            title={titleCase(s.StockistName)}
                                            caption={[titleCase(s.AreaName), s.StatementMonth ? `as of ${monthShort(s.StatementMonth)}` : 'no statement yet', rupees(s.ClosingValue)].join(' · ')}
                                            right={s.counts.out ? <Tag label={`${s.counts.out} out`} tone="error" /> : s.counts.low ? <Tag label={`${s.counts.low} low`} tone="warning" /> : s.Status ? <Tag label={STATEMENT_STATUS[s.Status]?.label} tone={STATEMENT_STATUS[s.Status]?.tone} /> : null}
                                            onPress={() => setOpen(open === s.StockistId ? null : s.StockistId)}
                                        />
                                        {open === s.StockistId
                                            ? s.items.map((item) => (
                                                  <View key={item.ProductId} style={[styles.item, line]}>
                                                      <Text style={[text.body, { flex: 1 }]}>{item.ProductName}</Text>
                                                      <Text style={text.small}>{`${item.ClosingQty} left${item.coverDays != null ? ` · ${item.coverDays} d` : ''}`}</Text>
                                                      <Tag label={STOCK_STATUS[item.stockStatus]?.label || item.stockStatus} tone={STOCK_STATUS[item.stockStatus]?.tone} />
                                                  </View>
                                              ))
                                            : null}
                                    </Card>
                                ))}
                            </View>
                        ) : (
                            <Card>
                                <Empty icon="archive" title="No stock reported yet" caption="Stock comes from the stockists' secondary sales statements." />
                            </Card>
                        )}
                    </>
                )}
            </Loadable>
        </Screen>
    );
}

// Business: POB, supplied, secondary sales and stock cover, with a trend; mine or my team's.
export function SalesBusiness({ navigation }) {
    const [month, setMonth] = useState(monthKey());
    const [scope, setScope] = useState('self');
    const [view, setView] = useState('products');
    const state = useLoad(async () => (await api.get('/app/sales/business', { params: { month, scope } })).data, [month, scope], "Couldn't load business.");
    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Sales & distribution" title="Business" onBack={() => navigation.goBack()} />
            {state.data?.hasTeam || scope === 'team' ? (
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
            <Loadable state={state} rows={5}>
                {(data) => {
                    const k = data.kpis;
                    const list = view === 'products' ? data.products : view === 'stockists' ? data.stockists : data.customers;
                    return (
                        <>
                            <StatGrid
                                items={[
                                    { icon: 'shopping-bag', label: 'POB', value: rupees(k.pob.value), caption: `${k.pob.orders} orders ${change(k.pob.change)}` },
                                    { icon: 'check-circle', label: 'Supplied', value: rupees(k.supplied.value), caption: k.supplied.rate == null ? '' : `${k.supplied.rate}% of POB`, tone: 'success' },
                                    { icon: 'bar-chart', label: 'Secondary sales', value: rupees(k.secondary.value), caption: `${k.secondary.units} units ${change(k.secondary.change)}`, tone: 'info' },
                                    { icon: 'archive', label: 'Stock', value: rupees(k.stock.value), caption: k.stock.coverDays == null ? 'No sales to compare' : `${k.stock.coverDays} days of cover`, tone: 'warning' },
                                ]}
                            />
                            <SectionTitle title="Trend" caption="POB (light) vs secondary sales" />
                            <Card style={{ marginBottom: space(1.5) }}>
                                <MiniBars data={data.trend.map((t) => ({ label: monthShort(t.month), value: t.secondary, secondary: t.pob }))} />
                            </Card>
                            <Chips
                                options={[
                                    { value: 'products', label: 'Products' },
                                    { value: 'stockists', label: 'Stockists' },
                                    { value: 'customers', label: 'Customers' },
                                ]}
                                value={view}
                                onChange={setView}
                            />
                            {list.length ? (
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    {list.slice(0, 25).map((r, i) => (
                                        <View key={r.id || r.CustomerId || i} style={i > 0 && line}>
                                            {view === 'customers' ? (
                                                <ListRow title={r.CustomerType === 'DOCTOR' ? doctorName(r.CustomerName || r.Name) : titleCase(r.CustomerName || r.Name)} caption={`${r.Orders ?? ''} orders`} right={<Text style={text.subtitle}>{rupees(r.Value)}</Text>} chevron={false} />
                                            ) : (
                                                <ListRow title={titleCase(r.name)} caption={`POB ${rupees(r.pobValue)} · secondary ${rupees(r.secondaryValue)}${r.closingValue ? ` · stock ${rupees(r.closingValue)}` : ''}`} chevron={false} />
                                            )}
                                        </View>
                                    ))}
                                </Card>
                            ) : (
                                <Card>
                                    <Empty icon="bar-chart" title="Nothing this month" />
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
    item: { flexDirection: 'row', alignItems: 'center', gap: space(1), paddingHorizontal: space(1.75), paddingVertical: space(1.1) },
});
