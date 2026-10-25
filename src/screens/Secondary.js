import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { api, errorMessage, monthKey, rupees } from '../api';
import { titleCase } from '../format';
import { usePermissions } from '../permissions';
import { colors, fonts, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Header, KeyValue, ListRow, Loadable, MonthSwitcher, Notice, ReasonDialog, Screen, SectionTitle, StatGrid, Tag } from '../ui';

export const STATEMENT_STATUS = {
    NOT_STARTED: { label: 'Not started', tone: 'neutral' },
    DRAFT: { label: 'Draft', tone: 'neutral' },
    SUBMITTED: { label: 'Sent for review', tone: 'warning' },
    APPROVED: { label: 'Approved', tone: 'success' },
    RETURNED: { label: 'Returned', tone: 'error' },
};
const monthLabel = (key) => new Date(`${String(key).slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

function Qty({ label, value, onChange, editable }) {
    return (
        <View style={{ flex: 1 }}>
            <Text style={styles.qtyLabel}>{label}</Text>
            {editable ? <TextInput style={styles.qty} value={String(value ?? '')} onChangeText={(v) => onChange(v.replace(/\D/g, '').slice(0, 7))} keyboardType="number-pad" /> : <Text style={[text.subtitle, { paddingVertical: 8 }]}>{value}</Text>}
        </View>
    );
}

// One stockist's monthly statement: opening + receipts + returns − sales = closing, per product.
function StatementEditor({ stockistId, month, onBack }) {
    const state = useLoad(async () => (await api.get('/app/secondary/statement', { params: { stockistId, month } })).data, [stockistId, month], "Couldn't load the statement.");
    const [edits, setEdits] = useState({});
    const [busy, setBusy] = useState(false);

    const rows = (state.data?.rows || []).map((r) => {
        const e = edits[r.ProductId] || {};
        const line = { ...r, ...e };
        const closing = Number(line.OpeningQty || 0) + Number(line.ReceiptQty || 0) + Number(line.ReturnQty || 0) - Number(line.SalesQty || 0);
        return { ...line, ClosingQty: closing };
    });
    const set = (id, patch) => setEdits((e) => ({ ...e, [id]: { ...(e[id] || {}), ...patch } }));
    const bad = rows.find((r) => r.ClosingQty < 0);

    const save = async (submit) => {
        setBusy(true);
        try {
            const r = (
                await api.put('/app/secondary/statement', {
                    Month: month,
                    StockistId: stockistId,
                    Submit: submit,
                    Lines: rows.map((x) => ({ ProductId: x.ProductId, OpeningQty: Number(x.OpeningQty || 0), ReceiptQty: Number(x.ReceiptQty || 0), SalesQty: Number(x.SalesQty || 0), ReturnQty: Number(x.ReturnQty || 0) })),
                })
            ).data;
            toast(r?.message || (submit ? 'Sent for review' : 'Draft saved'));
            setEdits({});
            if (submit) onBack();
            else state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    const data = state.data;
    const value = rows.reduce((s, r) => s + Number(r.SalesQty || 0) * Number(r.UnitPrice || 0), 0);
    return (
        <Screen
            refreshControl={state.refreshControl}
            footer={
                data?.canEdit ? (
                    <>
                        {bad ? <Text style={[text.small, { color: colors.errorDark, marginBottom: space(1) }]}>{`${bad.ProductName}: sales are more than the stock available.`}</Text> : null}
                        <View style={{ flexDirection: 'row', gap: space(1) }}>
                            <Button title="Save draft" variant="outline" onPress={() => save(false)} busy={busy} disabled={Boolean(bad)} style={{ flex: 1 }} />
                            <Button title="Send for review" icon="send" onPress={() => save(true)} busy={busy} disabled={Boolean(bad)} style={{ flex: 1 }} />
                        </View>
                    </>
                ) : null
            }
        >
            <Header overline={`Statement · ${monthLabel(month)}`} title={data ? titleCase(data.stockist?.StockistName) : 'Statement'} onBack={onBack} />
            <Loadable state={state} rows={6}>
                {() => (
                    <>
                        {data.statement ? <Tag label={STATEMENT_STATUS[data.statement.Status]?.label} tone={STATEMENT_STATUS[data.statement.Status]?.tone} /> : null}
                        {data.statement?.ReviewRemarks ? <Notice tone={data.statement.Status === 'RETURNED' ? 'error' : 'info'} title="Manager's remarks">{data.statement.ReviewRemarks}</Notice> : null}
                        {data.blockedReason ? <Notice tone="info">{data.blockedReason}</Notice> : null}
                        {data.openingLocked ? <Text style={[text.small, { marginVertical: space(1) }]}>Opening stock is last month’s approved closing stock.</Text> : null}
                        <Text style={[text.subtitle, { marginVertical: space(1) }]}>{`Sales value ${rupees(value)}`}</Text>
                        <View style={{ gap: space(1.25) }}>
                            {rows.map((r) => (
                                <Card key={r.ProductId} style={{ padding: space(1.5) }}>
                                    <View style={styles.top}>
                                        <Text style={[text.subtitle, { flex: 1 }]}>{r.ProductName}</Text>
                                        <Text style={text.small}>{rupees(r.UnitPrice)}</Text>
                                    </View>
                                    <View style={styles.qtyRow}>
                                        <Qty label="Opening" value={r.OpeningQty} editable={data.canEdit && !data.openingLocked} onChange={(v) => set(r.ProductId, { OpeningQty: v })} />
                                        <Qty label="Received" value={r.ReceiptQty} editable={data.canEdit} onChange={(v) => set(r.ProductId, { ReceiptQty: v })} />
                                        <Qty label="Returns" value={r.ReturnQty} editable={data.canEdit} onChange={(v) => set(r.ProductId, { ReturnQty: v })} />
                                        <Qty label="Sold" value={r.SalesQty} editable={data.canEdit} onChange={(v) => set(r.ProductId, { SalesQty: v })} />
                                    </View>
                                    <Text style={[text.small, { color: r.ClosingQty < 0 ? colors.errorDark : colors.inkMuted }]}>{`Closing ${r.ClosingQty}${r.PreviousSalesQty != null ? ` · sold last month ${r.PreviousSalesQty}` : ''}`}</Text>
                                </Card>
                            ))}
                        </View>
                    </>
                )}
            </Loadable>
        </Screen>
    );
}

function ReviewView({ statementId, onBack }) {
    const state = useLoad(async () => (await api.get(`/app/secondary/statements/${statementId}`)).data, [statementId], "Couldn't load the statement.");
    const [deciding, setDeciding] = useState(null);
    const decide = async (remarks) => {
        try {
            const r = (await api.post(`/app/secondary/statements/${statementId}/${deciding}`, { Remarks: remarks || null })).data;
            toast(r?.message || 'Done');
            setDeciding(null);
            onBack();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    const s = state.data?.statement;
    return (
        <Screen
            footer={
                state.data?.canReview ? (
                    <View style={{ flexDirection: 'row', gap: space(1) }}>
                        <Button title="Return" variant="danger" onPress={() => setDeciding('return')} style={{ flex: 1 }} />
                        <Button title="Approve" icon="check" onPress={() => setDeciding('approve')} style={{ flex: 1 }} />
                    </View>
                ) : null
            }
        >
            <Header overline={s ? `${titleCase(s.UserName)} · ${monthLabel(s.StatementMonth)}` : 'Statement'} title={s ? titleCase(s.StockistName) : '…'} onBack={onBack} />
            <Loadable state={state}>
                {(data) => (
                    <>
                        <Card style={{ marginBottom: space(1.5) }}>
                            <KeyValue rows={[['Sales value', rupees(data.statement.SalesValue)], ['Closing value', rupees(data.statement.ClosingValue)], ['Units sold', data.statement.TotalSalesQty]]} />
                        </Card>
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {data.lines.map((l, i) => (
                                <View key={l.ProductId} style={i > 0 && styles.line}>
                                    <ListRow title={l.ProductName} caption={`Open ${l.OpeningQty} + in ${l.ReceiptQty} + ret ${l.ReturnQty} − sold ${l.SalesQty} = ${l.ClosingQty}`} right={<Text style={text.subtitle}>{rupees(l.SalesValue)}</Text>} chevron={false} />
                                </View>
                            ))}
                        </Card>
                    </>
                )}
            </Loadable>
            <ReasonDialog visible={Boolean(deciding)} title={deciding === 'approve' ? 'Approve this statement?' : 'Return for correction?'} label={deciding === 'approve' ? 'Remarks (optional)' : 'What needs fixing'} minLength={deciding === 'return' ? 5 : 0} submitLabel={deciding === 'approve' ? 'Approve' : 'Return'} onSubmit={decide} onClose={() => setDeciding(null)} />
        </Screen>
    );
}

// Secondary sales: each stockist's monthly statement (MR prepares, manager reviews).
export default function Secondary({ navigation }) {
    const permissions = usePermissions();
    const [month, setMonth] = useState(monthKey());
    const [tab, setTab] = useState('statements');
    const [editing, setEditing] = useState(null); // stockistId
    const [reviewing, setReviewing] = useState(null); // statementId
    const state = useLoad(async () => (await api.get('/app/secondary', { params: { month } })).data, [month], "Couldn't load secondary sales.");
    const reviews = useLoad(async () => (permissions.has('secondary.approve') ? (await api.get('/app/secondary/reviews')).data.reviews : []), [permissions.codes ? 1 : 0], '');

    if (editing) return <StatementEditor stockistId={editing} month={month} onBack={() => { setEditing(null); state.reload(); }} />;
    if (reviewing) return <ReviewView statementId={reviewing} onBack={() => { setReviewing(null); reviews.reload(); state.reload(); }} />;

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Sales & distribution" title="Secondary sales" onBack={() => navigation.goBack()} />
            {permissions.has('secondary.approve') ? (
                <Chips
                    options={[
                        { value: 'statements', label: 'Statements' },
                        { value: 'reviews', label: `To review${reviews.data?.length ? ` ${reviews.data.length}` : ''}` },
                    ]}
                    value={tab}
                    onChange={setTab}
                />
            ) : null}
            {tab === 'reviews' ? (
                <Loadable state={reviews}>
                    {(rows) =>
                        rows.length ? (
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {rows.map((r, i) => (
                                    <View key={r.StatementId} style={i > 0 && styles.line}>
                                        <ListRow icon="file-text" title={titleCase(r.StockistName)} caption={`${titleCase(r.UserName)} · ${monthLabel(r.StatementMonth)} · ${rupees(r.SalesValue)}`} onPress={() => setReviewing(r.StatementId)} />
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <Card>
                                <Empty icon="check-circle" title="No statements waiting" />
                            </Card>
                        )
                    }
                </Loadable>
            ) : (
                <>
                    <MonthSwitcher value={month} onChange={setMonth} />
                    <Loadable state={state}>
                        {(data) => (
                            <>
                                {data.editableReason ? <Text style={[text.small, { marginBottom: space(1.5) }]}>{data.editableReason}</Text> : null}
                                <StatGrid
                                    items={[
                                        { icon: 'bar-chart', label: 'Sales value', value: rupees(data.summary.salesValue), caption: `${data.summary.salesQty} units` },
                                        { icon: 'file-text', label: 'Statements', value: `${data.summary.submitted}/${data.summary.stockists}`, caption: `${data.summary.approved} approved · ${data.summary.pending} pending`, tone: data.summary.pending ? 'warning' : 'success' },
                                    ]}
                                />
                                <SectionTitle title="Stockists" caption="Tap to enter or view the month's statement." />
                                {data.stockists.length ? (
                                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                                        {data.stockists.map((s, i) => (
                                            <View key={s.StockistId} style={i > 0 && styles.line}>
                                                <ListRow
                                                    icon="truck"
                                                    title={titleCase(s.StockistName)}
                                                    caption={[titleCase(s.AreaName), s.statement && `${rupees(s.statement.SalesValue)} sold`].filter(Boolean).join(' · ')}
                                                    right={<Tag label={STATEMENT_STATUS[s.status]?.label} tone={STATEMENT_STATUS[s.status]?.tone} />}
                                                    onPress={() => setEditing(s.StockistId)}
                                                />
                                            </View>
                                        ))}
                                    </Card>
                                ) : (
                                    <Card>
                                        <Empty icon="truck" title="No stockists assigned" />
                                    </Card>
                                )}
                            </>
                        )}
                    </Loadable>
                </>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: space(1) },
    qtyRow: { flexDirection: 'row', gap: space(1), marginBottom: 4 },
    qtyLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.inkMuted, marginBottom: 4 },
    qty: { borderWidth: 1, borderColor: colors.line, borderRadius: radius.sm, paddingHorizontal: 8, paddingVertical: 8, fontFamily: fonts.medium, fontSize: 14, color: colors.ink, backgroundColor: colors.paper },
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
});
