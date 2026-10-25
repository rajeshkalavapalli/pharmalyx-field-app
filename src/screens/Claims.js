import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, dateKey, errorMessage, monthKey, rupees } from '../api';
import { titleCase } from '../format';
import { usePermissions } from '../permissions';
import { colors, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, KeyValue, ListRow, Loadable, MonthSwitcher, Notice, ReasonDialog, Screen, SectionTitle, StatGrid, Tag } from '../ui';

export const CLAIM_STATUS = {
    NOT_STARTED: { label: 'Not started', tone: 'neutral' },
    DRAFT: { label: 'Draft', tone: 'neutral' },
    SUBMITTED: { label: 'With manager', tone: 'warning' },
    MANAGER_APPROVED: { label: 'With finance', tone: 'info' },
    APPROVED: { label: 'Approved for payment', tone: 'primary' },
    PAID: { label: 'Paid', tone: 'success' },
    RETURNED: { label: 'Returned', tone: 'error' },
};
const REVIEW_STEP = { HELD: 'Waiting for the reason', WITH_MANAGER: 'With manager', WITH_ADMIN: 'With head office', PAYABLE: 'Payable', NOT_PAYABLE: 'Not payable' };
const STATION = { HQ: 'HQ', EX_HQ: 'Ex-HQ', OUTSTATION: 'Outstation' };
const line = { borderTopWidth: 1, borderTopColor: colors.lineSoft };
const day = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const monthLabel = (m) => new Date(`${String(m).slice(0, 7)}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

function AddItem({ month, types, onClose, onSaved }) {
    const [type, setType] = useState(types[0]?.value || '');
    const [date, setDate] = useState(month === monthKey() ? dateKey() : `${month}-01`);
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [busy, setBusy] = useState(false);
    const save = async () => {
        setBusy(true);
        try {
            const r = (await api.post('/app/expenses/items', { Month: month, ExpenseType: type, ExpenseDate: date, Description: description.trim(), Amount: Number(amount) })).data;
            toast(r?.message || 'Expense added');
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
                        <Text style={[text.title, { flex: 1 }]}>Other expense</Text>
                        <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    <Chips options={types} value={type} onChange={setType} />
                    <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={(v) => setDate(v.slice(0, 10))} keyboardType="numbers-and-punctuation" />
                    <Field label="What was it for" value={description} onChangeText={(v) => setDescription(v.slice(0, 300))} autoCapitalize="sentences" />
                    <Field label="Amount (₹)" value={amount} onChangeText={(v) => setAmount(v.replace(/[^\d.]/g, '').slice(0, 9))} keyboardType="decimal-pad" />
                    <Button title="Add" icon="plus" onPress={save} busy={busy} disabled={!type || !description.trim() || !(Number(amount) > 0) || !/^\d{4}-\d{2}-\d{2}$/.test(date)} />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

function MyClaim({ navigation }) {
    const [month, setMonth] = useState(monthKey());
    const state = useLoad(async () => (await api.get('/app/expenses', { params: { month } })).data, [month], "Couldn't load your claim.");
    const [adding, setAdding] = useState(false);
    const [busy, setBusy] = useState(false);

    const removeItem = async (item) => {
        try {
            await api.delete(`/app/expenses/items/${item.ItemId}`, { params: { month } });
            toast('Expense removed');
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    const submit = async () => {
        setBusy(true);
        try {
            const r = (await api.post('/app/expenses/submit', { Month: month })).data;
            toast(r?.message || 'Claim sent to your manager');
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <MonthSwitcher value={month} onChange={setMonth} />
            <Loadable state={state} rows={5}>
                {(d) => (
                    <>
                        <View style={styles.tags}>
                            <Tag label={CLAIM_STATUS[d.status]?.label || d.status} tone={CLAIM_STATUS[d.status]?.tone} />
                            {d.designation ? <Tag label={d.designation} tone="neutral" /> : null}
                        </View>
                        {d.claim?.ManagerRemarks || d.claim?.FinanceRemarks ? <Notice tone={d.status === 'RETURNED' ? 'error' : 'info'} title="Remarks">{d.claim.FinanceRemarks || d.claim.ManagerRemarks}</Notice> : null}
                        {d.blockedReason ? <Text style={[text.small, { marginBottom: space(1.5) }]}>{d.blockedReason}</Text> : null}
                        <StatGrid
                            items={[
                                { icon: 'credit-card', label: 'Claim total', value: rupees(d.totals.total), caption: `DA ${rupees(d.totals.da)} · TA ${rupees(d.totals.ta)}` },
                                { icon: 'clock', label: 'On hold', value: rupees(d.holds.onHold), caption: `${d.holds.count} day(s) in review${d.holds.releasedTotal ? ` · ${rupees(d.holds.releasedTotal)} released` : ''}`, tone: d.holds.count ? 'warning' : 'brand' },
                            ]}
                        />
                        <Card style={{ padding: 0, marginBottom: space(1.5) }}>
                            <ListRow icon="calendar" title="Daily TA / DA statement" caption="Every day with status, hold reasons and running total" onPress={() => navigation.navigate('Allowance')} />
                        </Card>

                        <SectionTitle title="Other expenses" caption={d.otherLimit ? `Up to ${rupees(d.otherLimit)} a month` : undefined} />
                        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1) }}>
                            {d.items.length ? (
                                d.items.map((item, i) => (
                                    <View key={item.ItemId} style={i > 0 && line}>
                                        <ListRow
                                            title={`${item.TypeLabel} · ${rupees(item.Amount)}`}
                                            caption={[day(item.ExpenseDate), item.Description, item.ApprovedAmount != null && item.ApprovedAmount !== item.Amount && `approved ${rupees(item.ApprovedAmount)}`].filter(Boolean).join(' · ')}
                                            right={d.canEdit && !item.System ? (
                                                <Pressable onPress={() => removeItem(item)} hitSlop={10} accessibilityLabel="Remove expense">
                                                    <Feather name="trash-2" size={16} color={colors.errorDark} />
                                                </Pressable>
                                            ) : null}
                                            chevron={false}
                                        />
                                    </View>
                                ))
                            ) : (
                                <Empty icon="file-plus" title="No other expenses" caption="Courier, stationery, meeting travel and the like." />
                            )}
                        </Card>
                        {d.canEdit ? <Button title="Add expense" icon="plus" variant="ghost" small onPress={() => setAdding(true)} style={{ alignSelf: 'flex-start' }} /> : null}

                        <SectionTitle title="Working days" caption={`DA needs ${d.daMinValidVisits} counted visits a day.`} />
                        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.5) }}>
                            {d.days.length ? (
                                d.days.map((x, i) => (
                                    <View key={x.ExpenseDate} style={i > 0 && line}>
                                        <ListRow title={`${day(x.ExpenseDate)} · ${rupees(Number(x.DaAmount || 0) + Number(x.TaAmount || 0))}`} caption={[STATION[x.StationType] || x.StationType, `${x.DistanceKm} km`, x.TravelMode && titleCase(x.TravelMode), `${x.ValidVisits ?? x.VisitCount ?? 0} counted`, x.held && 'on hold'].filter(Boolean).join(' · ')} right={x.DaEligible ? null : <Tag label="No DA" tone="neutral" />} chevron={false} />
                                    </View>
                                ))
                            ) : (
                                <Empty icon="calendar" title="No field days yet" caption="Days come from your DCRs and verified visits." />
                            )}
                        </Card>
                        {d.canSubmit ? <Button title={`Submit claim · ${rupees(d.totals.total)}`} icon="send" onPress={submit} busy={busy} /> : null}
                        {adding ? (
                            <AddItem
                                month={month}
                                types={d.itemTypes}
                                onClose={() => setAdding(false)}
                                onSaved={() => {
                                    setAdding(false);
                                    state.reload();
                                }}
                            />
                        ) : null}
                    </>
                )}
            </Loadable>
        </>
    );
}

function ClaimReviews({ navigation }) {
    const state = useLoad(async () => (await api.get('/app/expenses/reviews')).data.reviews, [], "Couldn't load claims to review.");
    return (
        <Loadable state={state}>
            {(rows) =>
                rows.length ? (
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {rows.map((c, i) => (
                            <View key={c.ClaimId} style={i > 0 && line}>
                                <ListRow icon="file-text" title={titleCase(c.UserName)} caption={`${monthLabel(c.ClaimMonth)} · ${rupees(c.ClaimedAmount)}`} right={<Tag label={CLAIM_STATUS[c.Status]?.label} tone={CLAIM_STATUS[c.Status]?.tone} />} onPress={() => navigation.navigate('ClaimDetail', { claimId: c.ClaimId })} />
                            </View>
                        ))}
                    </Card>
                ) : (
                    <Card>
                        <Empty icon="check-circle" title="No claims waiting" caption="Monthly claims your team submits appear here." />
                    </Card>
                )
            }
        </Loadable>
    );
}

function ReviewCard({ r, mode, onDecide, onReport }) {
    return (
        <Card style={{ padding: space(1.5) }}>
            <View style={styles.top}>
                <Text style={[text.subtitle, { flex: 1 }]}>{titleCase(r.UserName)}</Text>
                <Text style={text.subtitle}>{rupees(r.Amount)}</Text>
            </View>
            <Text style={text.small}>{`${day(r.WorkDate)} · DA ${rupees(r.DaAmount)} · TA ${rupees(r.TaAmount)} · ${REVIEW_STEP[r.Status] || r.Status}`}</Text>
            {r.Findings.map((f) => (
                <Text key={f.code} style={[text.small, { color: colors.warningDark }]}>
                    • {f.text}
                </Text>
            ))}
            {r.EmployeeReason ? <Text style={[text.body, { marginTop: 4 }]}>“{r.EmployeeReason}”</Text> : r.AutoNote ? <Text style={[text.small, { fontStyle: 'italic' }]}>{r.AutoNote}</Text> : null}
            {r.ManagerComment ? <Text style={text.small}>{`${titleCase(r.ManagerName)}: “${r.ManagerComment}”`}</Text> : null}
            {r.AdminComment ? <Text style={text.small}>{`Head office: “${r.AdminComment}”`}</Text> : null}
            <View style={styles.actions}>
                {mode === 'manager' ? (
                    <>
                        <Button title="Reject (final)" small variant="danger" onPress={() => onDecide(r, 'manager-reject')} style={{ flex: 1 }} />
                        <Button title="Approve" small icon="check" onPress={() => onDecide(r, 'manager-approve')} style={{ flex: 1 }} />
                    </>
                ) : null}
                {mode === 'admin' ? (
                    <>
                        <Button title="Not payable" small variant="danger" onPress={() => onDecide(r, 'admin-reject')} style={{ flex: 1 }} />
                        <Button title="Payable" small icon="check" onPress={() => onDecide(r, 'admin-approve')} style={{ flex: 1 }} />
                    </>
                ) : null}
                {mode === 'grant' ? <Button title="Grant DA" small icon="gift" onPress={() => onDecide(r, 'grant-da')} style={{ flex: 1 }} /> : null}
                {onReport ? <Button title="Day report" small variant="ghost" icon="file-text" onPress={() => onReport(r)} /> : null}
            </View>
            {mode === 'admin' ? (
                <Pressable onPress={() => onDecide(r, 'admin-grant')} style={styles.grant} accessibilityRole="button">
                    <Feather name="gift" size={14} color={colors.jadeDark} />
                    <Text style={[text.small, { color: colors.jadeDark }]}>Payable and grant DA (special case)</Text>
                </Pressable>
            ) : null}
        </Card>
    );
}

function DayReviews({ navigation }) {
    const permissions = usePermissions();
    const headOffice = permissions.has('expensefinance.approve');
    const manager = permissions.has('expenses.approve');
    const [view, setView] = useState(manager ? 'manager' : 'admin');
    const path = { manager: 'manager', admin: 'admin', rejected: 'manager-rejections', approved: 'approved' }[view];
    const state = useLoad(async () => (await api.get(`/app/expenses/day-reviews/${path}`)).data.reviews, [path], "Couldn't load the days.");
    const [deciding, setDeciding] = useState(null); // { r, action }

    const decide = async (comment) => {
        const { r, action } = deciding;
        try {
            const url = action === 'admin-grant' ? 'admin-approve' : action;
            const body = action === 'admin-grant' ? { Comment: comment, GrantDa: true } : { Comment: comment };
            const res = (await api.post(`/app/expenses/day-reviews/${r.ReviewId}/${url}`, body)).data;
            toast(res?.message || 'Saved');
            setDeciding(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    const views = [manager && { value: 'manager', label: 'My team' }, headOffice && { value: 'admin', label: 'Final decision' }, headOffice && { value: 'approved', label: 'Approved without DA' }, headOffice && { value: 'rejected', label: 'Manager rejections' }].filter(Boolean);
    const mode = view === 'manager' ? 'manager' : view === 'admin' ? 'admin' : view === 'approved' ? 'grant' : null;
    const titles = { 'manager-approve': 'Approve this day?', 'manager-reject': 'Reject this day? (final)', 'admin-approve': 'Make this day payable?', 'admin-reject': 'Not payable?', 'admin-grant': 'Payable, with DA granted?', 'grant-da': 'Grant DA for this day?' };

    return (
        <>
            {views.length > 1 ? <Chips options={views} value={view} onChange={setView} /> : null}
            <Text style={[text.small, { marginBottom: space(1.5) }]}>
                {view === 'manager' ? 'Days on hold from your team. Rejecting is final; approving sends the day to head office.' : view === 'admin' ? 'Days your managers approved. You decide: payable or not payable.' : view === 'approved' ? 'Payable days that did not earn DA. Grant DA only in special cases.' : 'Days managers rejected (read only).'}
            </Text>
            <Loadable state={state}>
                {(rows) =>
                    rows.length ? (
                        <View style={{ gap: space(1.25) }}>
                            {rows.map((r) => (
                                <ReviewCard key={r.ReviewId} r={r} mode={mode} onDecide={(row, action) => setDeciding({ r: row, action })} onReport={headOffice ? (row) => navigation.navigate('DayReport', { reviewId: row.ReviewId }) : null} />
                            ))}
                        </View>
                    ) : (
                        <Card>
                            <Empty icon="check-circle" title="Nothing here" />
                        </Card>
                    )
                }
            </Loadable>
            <ReasonDialog visible={Boolean(deciding)} title={deciding ? titles[deciding.action] : ''} caption={deciding ? `${titleCase(deciding.r.UserName)} · ${day(deciding.r.WorkDate)}` : ''} label="Comment" minLength={3} submitLabel="Save decision" onSubmit={decide} onClose={() => setDeciding(null)} />
        </>
    );
}

// TA / claims: my monthly claim, claims to review, and TA / DA days on hold (manager → head office).
export default function Claims({ navigation, route }) {
    const permissions = usePermissions();
    const canReview = permissions.has('expenses.approve');
    const dayReviewer = canReview || permissions.has('expensefinance.approve');
    const initial = route.params?.tab === 'days' && dayReviewer ? 'days' : route.params?.tab === 'reviews' && canReview ? 'reviews' : 'mine';
    const [tab, setTab] = useState(initial);
    const tabs = [{ value: 'mine', label: 'My claim' }, canReview && { value: 'reviews', label: 'Claims to review' }, dayReviewer && { value: 'days', label: 'TA/DA days' }].filter(Boolean);
    return (
        <Screen>
            <Header overline="Expenses" title="TA / Claims" onBack={() => navigation.goBack()} />
            {tabs.length > 1 ? <Chips options={tabs} value={tab} onChange={setTab} /> : null}
            {tab === 'mine' && <MyClaim navigation={navigation} />}
            {tab === 'reviews' && <ClaimReviews navigation={navigation} />}
            {tab === 'days' && <DayReviews navigation={navigation} />}
        </Screen>
    );
}

// One claim: days, other expenses and the manager / finance actions.
export function ClaimDetail({ navigation, route }) {
    const { claimId } = route.params;
    const state = useLoad(async () => (await api.get(`/app/expenses/claims/${claimId}`)).data, [claimId], "Couldn't load the claim.");
    const [acting, setActing] = useState(null);

    const act = async (remarks) => {
        try {
            const url = { approve: 'manager-approve', return: 'return', final: 'final-approve', paid: 'mark-paid' }[acting];
            const body = acting === 'paid' ? { PaymentRef: remarks } : { Remarks: remarks || null };
            const r = (await api.post(`/app/expenses/claims/${claimId}/${url}`, body)).data;
            toast(r?.message || 'Saved');
            setActing(null);
            navigation.goBack();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    const d = state.data;
    const a = d?.actions || {};
    return (
        <Screen
            refreshControl={state.refreshControl}
            footer={
                a.managerReview || a.finalApprove || a.markPaid ? (
                    <View style={{ flexDirection: 'row', gap: space(1) }}>
                        {a.managerReview || a.finalApprove ? <Button title="Return" variant="danger" onPress={() => setActing('return')} style={{ flex: 1 }} /> : null}
                        {a.managerReview ? <Button title="Approve" icon="check" onPress={() => setActing('approve')} style={{ flex: 1 }} /> : null}
                        {a.finalApprove ? <Button title="Approve for payment" icon="check" onPress={() => setActing('final')} style={{ flex: 1 }} /> : null}
                        {a.markPaid ? <Button title="Mark paid" icon="credit-card" onPress={() => setActing('paid')} style={{ flex: 1 }} /> : null}
                    </View>
                ) : null
            }
        >
            <Header overline={d ? monthLabel(d.claim.ClaimMonth) : 'Claim'} title={d ? titleCase(d.claim.UserName) : '…'} onBack={() => navigation.goBack()} />
            <Loadable state={state}>
                {() => (
                    <>
                        <Tag label={CLAIM_STATUS[d.claim.Status]?.label} tone={CLAIM_STATUS[d.claim.Status]?.tone} />
                        <Card style={{ marginVertical: space(1.5) }}>
                            <KeyValue rows={[['DA', rupees(d.claim.DaTotal)], ['TA', rupees(d.claim.TaTotal)], ['Other', rupees(d.claim.OtherTotal)], ['Claimed', rupees(d.claim.ClaimedAmount)], d.claim.ApprovedAmount != null && ['Approved', rupees(d.claim.ApprovedAmount)]]} />
                        </Card>
                        <SectionTitle title="Days" />
                        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.5) }}>
                            {d.days.map((x, i) => (
                                <View key={x.DayId} style={i > 0 && line}>
                                    <ListRow title={`${day(x.ExpenseDate)} · ${rupees(Number(x.DaAmount || 0) + Number(x.TaAmount || 0))}`} caption={[STATION[x.StationType] || x.StationType, `${x.DistanceKm} km`, x.TravelMode && titleCase(x.TravelMode), x.Remarks].filter(Boolean).join(' · ')} chevron={false} />
                                </View>
                            ))}
                        </Card>
                        {d.items.length ? (
                            <>
                                <SectionTitle title="Other expenses" />
                                <Card style={{ padding: 0, overflow: 'hidden' }}>
                                    {d.items.map((item, i) => (
                                        <View key={item.ItemId} style={i > 0 && line}>
                                            <ListRow title={`${item.TypeLabel} · ${rupees(item.Amount)}`} caption={[day(item.ExpenseDate), item.Description].join(' · ')} chevron={false} />
                                        </View>
                                    ))}
                                </Card>
                            </>
                        ) : null}
                    </>
                )}
            </Loadable>
            <ReasonDialog
                visible={Boolean(acting)}
                title={{ approve: 'Approve this claim?', return: 'Return for correction?', final: 'Approve for payment?', paid: 'Mark as paid' }[acting] || ''}
                label={acting === 'paid' ? 'Payment reference' : acting === 'return' ? 'What needs fixing' : 'Remarks (optional)'}
                minLength={acting === 'return' || acting === 'paid' ? 3 : 0}
                submitLabel="Save"
                onSubmit={act}
                onClose={() => setActing(null)}
            />
        </Screen>
    );
}

// Head office: claims approved by managers → approve for payment → mark paid.
export function Payments({ navigation }) {
    const [status, setStatus] = useState('MANAGER_APPROVED');
    const state = useLoad(async () => (await api.get('/app/expenses/finance', { params: { status } })).data.claims, [status], "Couldn't load claims.");
    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Expenses" title="Payments" onBack={() => navigation.goBack()} />
            <Chips
                options={[
                    { value: 'MANAGER_APPROVED', label: 'To approve' },
                    { value: 'APPROVED', label: 'To pay' },
                    { value: 'PAID', label: 'Paid' },
                ]}
                value={status}
                onChange={setStatus}
            />
            <Loadable state={state}>
                {(rows) =>
                    rows.length ? (
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {rows.map((c, i) => (
                                <View key={c.ClaimId} style={i > 0 && line}>
                                    <ListRow icon="credit-card" title={titleCase(c.UserName)} caption={`${monthLabel(c.ClaimMonth)} · ${rupees(c.ApprovedAmount ?? c.ClaimedAmount)}${c.PaymentRef ? ` · ref ${c.PaymentRef}` : ''}`} onPress={() => navigation.navigate('ClaimDetail', { claimId: c.ClaimId })} />
                                </View>
                            ))}
                        </Card>
                    ) : (
                        <Card>
                            <Empty icon="check-circle" title="Nothing here" />
                        </Card>
                    )
                }
            </Loadable>
        </Screen>
    );
}

const RATE_FIELDS = [
    ['DaHq', 'DA at HQ'],
    ['DaExHq', 'DA Ex-HQ'],
    ['DaOutstation', 'DA outstation'],
    ['KmBike', 'Bike / km'],
    ['KmCar', 'Car / km'],
    ['KmBus', 'Bus / km'],
    ['KmTrain', 'Train / km'],
    ['KmAuto', 'Auto / km'],
    ['KmOther', 'Other / km'],
    ['OtherMonthlyLimit', 'Other expenses / month'],
];

// Rate card: DA and per-km TA rates per designation.
export function RateCard({ navigation }) {
    const permissions = usePermissions();
    const canEdit = permissions.has('expenserates.edit');
    const state = useLoad(async () => (await api.get('/app/expenses/rates')).data.designations, [], "Couldn't load the rate card.");
    const [editing, setEditing] = useState(null);
    const [values, setValues] = useState({});
    const [busy, setBusy] = useState(false);

    const open = (d) => {
        setEditing(d);
        setValues(Object.fromEntries(RATE_FIELDS.map(([k]) => [k, d[k] == null ? '' : String(d[k])])));
    };
    const save = async () => {
        setBusy(true);
        try {
            const r = (await api.put(`/app/expenses/rates/${editing.DesignationId}`, Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v === '' ? null : Number(v)])))).data;
            toast(r?.message || 'Rates saved');
            setEditing(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    if (editing)
        return (
            <Screen footer={<Button title="Save rates" icon="check" onPress={save} busy={busy} />}>
                <Header overline="Rate card" title={editing.DesignationName} onBack={() => setEditing(null)} />
                <Card>
                    {RATE_FIELDS.map(([k, label]) => (
                        <Field key={k} label={`${label} (₹)`} value={values[k]} onChangeText={(v) => setValues((s) => ({ ...s, [k]: v.replace(/[^\d.]/g, '') }))} keyboardType="decimal-pad" />
                    ))}
                </Card>
            </Screen>
        );

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Expenses" title="Rate card" onBack={() => navigation.goBack()} />
            <Loadable state={state}>
                {(rows) => (
                    <View style={{ gap: space(1.25) }}>
                        {rows.map((d) => (
                            <Card key={d.DesignationId} style={{ padding: space(1.5) }}>
                                <View style={styles.top}>
                                    <Text style={[text.subtitle, { flex: 1 }]}>{d.DesignationName}</Text>
                                    <Tag label={d.HasRates ? `${d.Users} people` : 'No rates'} tone={d.HasRates ? 'neutral' : 'warning'} />
                                </View>
                                {d.HasRates ? <Text style={text.small}>{`DA ${rupees(d.DaHq)} / ${rupees(d.DaExHq)} / ${rupees(d.DaOutstation)} · bike ${rupees(d.KmBike)}/km · car ${rupees(d.KmCar)}/km`}</Text> : null}
                                {canEdit ? <Button title="Edit rates" small variant="outline" onPress={() => open(d)} style={{ marginTop: space(1), alignSelf: 'flex-start' }} /> : null}
                            </Card>
                        ))}
                    </View>
                )}
            </Loadable>
        </Screen>
    );
}

// Head office: the printable day report (facts only) with its verification code.
export function DayReport({ navigation, route }) {
    const { reviewId } = route.params;
    const state = useLoad(async () => (await api.get(`/app/expenses/day-reviews/${reviewId}/report`)).data, [reviewId], "Couldn't load the day report.");
    const clock = (v) => (v ? new Date(v).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');
    return (
        <Screen>
            <Header overline="Day report" title={state.data ? titleCase(state.data.employee.name) : '…'} onBack={() => navigation.goBack()} />
            <Loadable state={state}>
                {(d) => (
                    <>
                        <Card style={{ marginBottom: space(1.5) }}>
                            <KeyValue rows={[['Reference', d.reference], ['Date', day(d.date)], ['Designation', d.employee.designation], ['Claimed', `DA ${rupees(d.claimed.da)} · TA ${rupees(d.claimed.ta)}`], ['Status', REVIEW_STEP[d.status] || d.status], ['Verification code', d.verificationCode]]} />
                        </Card>
                        <SectionTitle title="What the records show" />
                        <Card style={{ marginBottom: space(1.5) }}>
                            {d.findings.map((f) => (
                                <Text key={f.code} style={text.body}>
                                    • {f.text}
                                </Text>
                            ))}
                            <Text style={[text.small, { marginTop: space(1) }]}>{`Location trail: ${d.travel.km} km from ${d.travel.points} points (${clock(d.travel.first)} – ${clock(d.travel.last)})`}</Text>
                        </Card>
                        <SectionTitle title="Visits" />
                        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1.5) }}>
                            {d.visits.length ? (
                                d.visits.map((v, i) => (
                                    <View key={`${v.doctor}-${i}`} style={i > 0 && line}>
                                        <ListRow title={v.doctor} caption={[titleCase(v.area), `${clock(v.checkIn)} – ${clock(v.checkOut)}`, v.staySeconds != null && `${Math.round(v.staySeconds / 60)} min`, v.result].filter(Boolean).join(' · ')} chevron={false} />
                                    </View>
                                ))
                            ) : (
                                <Empty icon="map-pin" title="No visits recorded" />
                            )}
                        </Card>
                        <SectionTitle title="Review steps" />
                        <Card style={{ marginBottom: space(1.5) }}>
                            <KeyValue
                                rows={[
                                    ['Employee', d.steps.employee ? `“${d.steps.employee.reason}”` : d.steps.autoNote || 'No reason sent'],
                                    ['Manager', d.steps.manager ? `${titleCase(d.steps.manager.name)}: ${d.steps.manager.decision} · “${d.steps.manager.comment}”` : '—'],
                                    ['Head office', d.steps.admin ? `${titleCase(d.steps.admin.name)}: ${d.steps.admin.decision} · “${d.steps.admin.comment}”` : '—'],
                                    ['Policy accepted', d.policy.acceptedVersion ? `v${d.policy.acceptedVersion}` : 'Not accepted'],
                                ]}
                            />
                        </Card>
                        <Text style={text.small}>Facts only. Print or share from the web app; the verification code proves the record was not changed.</Text>
                    </>
                )}
            </Loadable>
        </Screen>
    );
}

const styles = StyleSheet.create({
    tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space(1.5) },
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: space(1), marginTop: space(1.25) },
    grant: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: space(1) },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4), maxHeight: '90%' },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
});

