import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api, dateKey, errorMessage, monthKey } from '../api';
import { titleCase } from '../format';
import { PersonPicker, usePeople } from '../people';
import { usePermissions } from '../permissions';
import { colors, fonts, radius, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, KeyValue, ListRow, Loadable, MonthSwitcher, Notice, ReasonDialog, Screen, SectionTitle, StatGrid, Tag } from '../ui';

const line = { borderTopWidth: 1, borderTopColor: colors.lineSoft };
const DAY = {
    PRESENT: { short: 'P', tone: 'success', label: 'Present' },
    ABSENT: { short: 'A', tone: 'error', label: 'Absent' },
    LEAVE: { short: 'L', tone: 'info', label: 'Leave' },
    HALF_DAY_LEAVE: { short: '½', tone: 'info', label: 'Half-day leave' },
    WEEK_OFF: { short: 'W', tone: 'neutral', label: 'Week off' },
    TODAY: { short: '•', tone: 'primary', label: 'Today' },
    UPCOMING: { short: '', tone: 'neutral', label: 'Upcoming' },
};
const TONE_BG = { success: colors.successSoft, error: colors.errorSoft, info: colors.infoSoft, neutral: colors.lineSoft, primary: colors.jadeMist };
const LEAVE_STATUS = { PENDING: { label: 'Pending', tone: 'warning' }, APPROVED: { label: 'Approved', tone: 'success' }, REJECTED: { label: 'Rejected', tone: 'error' }, CANCELLED: { label: 'Cancelled', tone: 'neutral' } };
const shortDate = (d) => new Date(`${String(d).slice(0, 10)}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });

// Month grid of one person's days (P / A / L / W).
function MonthGrid({ days }) {
    const first = (new Date(`${days[0].day}T00:00:00`).getDay() + 6) % 7;
    const cells = [...Array(first).fill(null), ...days];
    return (
        <View>
            <View style={styles.gridRow}>
                {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                    <Text key={i} style={styles.gridHead}>
                        {d}
                    </Text>
                ))}
            </View>
            <View style={styles.grid}>
                {cells.map((c, i) => {
                    if (!c) return <View key={`x${i}`} style={styles.cell} />;
                    const s = DAY[c.status] || DAY.UPCOMING;
                    return (
                        <View key={c.day} style={[styles.cell, { backgroundColor: TONE_BG[s.tone] }, c.late && { borderWidth: 1, borderColor: colors.warning }]}>
                            <Text style={styles.cellDay}>{Number(c.day.slice(8))}</Text>
                            <Text style={styles.cellCode}>{s.short}</Text>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

// Attendance by month: me or a team member, the month grid, and the team summary.
export function Attendance({ navigation }) {
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [month, setMonth] = useState(monthKey());
    const state = useLoad(async () => (await api.get('/app/attendance/month', { params: { month, userId: userId || undefined } })).data, [month, userId], "Couldn't load attendance.");
    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="HR" title="Attendance" onBack={() => navigation.goBack()} />
            <PersonPicker people={people} value={userId} onChange={setUserId} label="Person (blank = everyone I can see)" />
            <MonthSwitcher value={month} onChange={setMonth} />
            <Loadable state={state} rows={5}>
                {(d) =>
                    (d.people || []).length ? (
                        <View style={{ gap: space(1.5) }}>
                            {d.people.map((p) => (
                                <Card key={p.UserId}>
                                    <View style={styles.top}>
                                        <Text style={[text.subtitle, { flex: 1 }]}>{titleCase(p.Name)}</Text>
                                        <Tag label={`${p.summary.present} present`} tone="success" />
                                    </View>
                                    <Text style={[text.small, { marginBottom: space(1.25) }]}>{`${p.summary.absent} absent · ${p.summary.leave} leave · ${p.summary.weekOff} week off · ${p.summary.late} late${p.summary.avgHours != null ? ` · avg ${p.summary.avgHours} h` : ''}`}</Text>
                                    {d.people.length <= 3 && p.days?.length ? <MonthGrid days={p.days} /> : null}
                                </Card>
                            ))}
                        </View>
                    ) : (
                        <Card>
                            <Empty icon="clock" title="No attendance yet" />
                        </Card>
                    )
                }
            </Loadable>
        </Screen>
    );
}

// Leave: balances, my requests and my team's (approve / reject), and leave types for HR settings.
export function Leave({ navigation }) {
    const permissions = usePermissions();
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [year, setYear] = useState(new Date().getFullYear());
    const [tab, setTab] = useState('requests');
    const state = useLoad(async () => (await api.get('/app/leave', { params: { year, userId: userId || undefined } })).data, [year, userId], "Couldn't load leave.");
    const types = useLoad(async () => (tab === 'types' ? (await api.get('/app/leave/types')).data.types : null), [tab], "Couldn't load leave types.");
    const [pending, setPending] = useState(null); // { row, action }

    const act = async (remarks) => {
        const { row, action } = pending;
        try {
            const r = (await api.post(`/app/leave/${row.LeaveId}/${action}`, action === 'cancel' ? undefined : { Remarks: remarks || null })).data;
            toast(r?.message || 'Saved');
            setPending(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="HR" title="Leave" onBack={() => navigation.goBack()} right={!userId ? <Button title="Apply" icon="plus" small onPress={() => navigation.navigate('ApplyLeave', { balances: state.data?.balances || [] })} disabled={!state.data?.balances?.length} /> : null} />
            <Chips
                options={[
                    { value: 'requests', label: 'Requests' },
                    permissions.has('hrsettings.edit') || permissions.has('leave.approve') ? { value: 'types', label: 'Leave types' } : null,
                ].filter(Boolean)}
                value={tab}
                onChange={setTab}
            />
            {tab === 'types' ? (
                <Loadable state={types}>
                    {(rows) => (
                        <Card style={{ padding: 0, overflow: 'hidden' }}>
                            {rows.map((t, i) => (
                                <View key={t.LeaveTypeId} style={i > 0 && line}>
                                    <ListRow title={t.Name} caption={[t.IsPaid ? `${t.AnnualQuota} days a year` : 'Unpaid', t.AllowHalfDay ? 'half day allowed' : null, t.IsActive === false ? 'inactive' : null].filter(Boolean).join(' · ')} chevron={false} />
                                </View>
                            ))}
                        </Card>
                    )}
                </Loadable>
            ) : (
                <>
                    <PersonPicker people={people} value={userId} onChange={setUserId} />
                    <Chips options={[year - 1, year, year + 1].map((y) => ({ value: y, label: `${y}` }))} value={year} onChange={setYear} />
                    <Loadable state={state}>
                        {(d) => (
                            <>
                                {d.balances?.length ? (
                                    <View style={styles.balances}>
                                        {d.balances.map((b) => (
                                            <Card key={b.LeaveTypeId} style={styles.balance}>
                                                <Text style={text.small} numberOfLines={1}>
                                                    {b.Name}
                                                </Text>
                                                <Text style={text.metric}>{b.IsPaid ? b.available : '—'}</Text>
                                                <Text style={text.small}>{b.IsPaid ? `of ${b.AnnualQuota} · ${b.pending} pending` : 'Unpaid'}</Text>
                                            </Card>
                                        ))}
                                    </View>
                                ) : null}
                                <SectionTitle title="Requests" caption={`${d.requests.length} in ${d.year}`} />
                                {d.requests.length ? (
                                    <View style={{ gap: space(1.25) }}>
                                        {d.requests.map((r) => (
                                            <Card key={r.LeaveId} style={{ padding: space(1.5) }}>
                                                <View style={styles.top}>
                                                    <Text style={[text.subtitle, { flex: 1 }]}>{r.isOwn ? r.LeaveName : `${titleCase(r.UserName)} · ${r.LeaveName}`}</Text>
                                                    <Tag label={LEAVE_STATUS[r.Status]?.label} tone={LEAVE_STATUS[r.Status]?.tone} />
                                                </View>
                                                <Text style={text.small}>{`${r.FromDate === r.ToDate ? shortDate(r.FromDate) : `${shortDate(r.FromDate)} – ${shortDate(r.ToDate)}`} · ${r.HalfDay ? 'half day' : `${r.Days} day(s)`}`}</Text>
                                                {r.Reason ? <Text style={text.body}>“{r.Reason}”</Text> : null}
                                                {r.ReviewRemarks ? <Text style={text.small}>{`${titleCase(r.ReviewedByName) || 'Manager'}: “${r.ReviewRemarks}”`}</Text> : null}
                                                <View style={styles.actions}>
                                                    {r.canReview ? (
                                                        <>
                                                            <Button title="Reject" small variant="danger" onPress={() => setPending({ row: r, action: 'reject' })} style={{ flex: 1 }} />
                                                            <Button title="Approve" small icon="check" onPress={() => setPending({ row: r, action: 'approve' })} style={{ flex: 1 }} />
                                                        </>
                                                    ) : null}
                                                    {r.canCancel ? <Button title="Cancel leave" small variant="ghost" onPress={() => setPending({ row: r, action: 'cancel' })} /> : null}
                                                </View>
                                            </Card>
                                        ))}
                                    </View>
                                ) : (
                                    <Card>
                                        <Empty icon="sunset" title="No leave requests" />
                                    </Card>
                                )}
                            </>
                        )}
                    </Loadable>
                </>
            )}
            <ReasonDialog
                visible={Boolean(pending)}
                title={pending ? { approve: 'Approve leave?', reject: 'Reject leave?', cancel: 'Cancel this leave?' }[pending.action] : ''}
                caption={pending ? `${pending.row.LeaveName} · ${shortDate(pending.row.FromDate)}${pending.row.ToDate !== pending.row.FromDate ? ` – ${shortDate(pending.row.ToDate)}` : ''}` : ''}
                label={pending?.action === 'reject' ? 'Reason' : 'Comment (optional)'}
                minLength={pending?.action === 'reject' ? 3 : 0}
                submitLabel={pending ? { approve: 'Approve', reject: 'Reject', cancel: 'Cancel leave' }[pending.action] : ''}
                onSubmit={act}
                onClose={() => setPending(null)}
            />
        </Screen>
    );
}

const EVENT_ICON = { VISIT: 'map-pin', ORDER: 'shopping-bag', DCR: 'file-text', CHECK_IN: 'log-in', CHECK_OUT: 'log-out', LEAVE: 'sunset', DAY_START: 'play', RCPA: 'percent', EXPENSE: 'credit-card' };

// Activity timeline: everything a person did, day by day.
export function Activity({ navigation }) {
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [days, setDays] = useState(7);
    const from = (() => {
        const d = new Date();
        d.setDate(d.getDate() - (days - 1));
        return dateKey(d);
    })();
    const state = useLoad(async () => (await api.get('/app/activity', { params: { userId: userId || undefined, from, to: dateKey() } })).data, [userId, from], "Couldn't load activity.");
    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="HR" title="Activity" onBack={() => navigation.goBack()} />
            <PersonPicker people={people} value={userId} onChange={setUserId} />
            <Chips
                options={[
                    { value: 1, label: 'Today' },
                    { value: 7, label: '7 days' },
                    { value: 30, label: '30 days' },
                ]}
                value={days}
                onChange={setDays}
            />
            <Loadable state={state} rows={6}>
                {(d) => (
                    <>
                        <StatGrid
                            items={[
                                { icon: 'activity', label: 'Active days', value: `${d.totals.activeDays}`, caption: `${d.totals.events} activities` },
                                { icon: 'map-pin', label: 'Visits / orders', value: `${d.totals.visits}/${d.totals.orders}`, tone: 'info' },
                            ]}
                        />
                        {d.days
                            .filter((x) => x.events.length)
                            .reverse()
                            .map((x) => (
                                <View key={x.day}>
                                    <SectionTitle title={new Date(`${x.day}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })} />
                                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                                        {x.events.map((e, i) => (
                                            <View key={`${e.type}-${i}`} style={i > 0 && line}>
                                                <ListRow icon={EVENT_ICON[e.type] || 'circle'} tone="neutral" title={e.title} caption={[e.time, e.detail].filter(Boolean).join(' · ')} chevron={false} />
                                            </View>
                                        ))}
                                    </Card>
                                </View>
                            ))}
                        {!d.days.some((x) => x.events.length) ? (
                            <Card>
                                <Empty icon="activity" title="No activity in this period" />
                            </Card>
                        ) : null}
                    </>
                )}
            </Loadable>
        </Screen>
    );
}

const APPRAISAL_STATUS = { NOT_STARTED: { label: 'Not started', tone: 'neutral' }, PENDING_SELF: { label: 'Self-review due', tone: 'warning' }, PENDING_MANAGER: { label: 'With manager', tone: 'info' }, COMPLETED: { label: 'Completed', tone: 'success' } };

function Stars({ value, onChange }) {
    return (
        <View style={styles.stars}>
            {[1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5].map((n) => (
                <Pressable key={n} onPress={() => onChange(n)} style={[styles.star, value === n && styles.starOn]} accessibilityRole="button" accessibilityLabel={`Rating ${n}`}>
                    <Text style={[styles.starText, value === n && { color: colors.white }]}>{n}</Text>
                </Pressable>
            ))}
        </View>
    );
}

function AppraisalForm({ cycleId, userId, onBack }) {
    const state = useLoad(async () => (await api.get(`/app/appraisals/cycles/${cycleId}/review`, { params: { userId: userId || undefined } })).data, [cycleId, userId], "Couldn't load the appraisal.");
    const [rating, setRating] = useState(null);
    const [comments, setComments] = useState('');
    const [busy, setBusy] = useState(false);
    const d = state.data;
    const mode = d?.canManagerReview ? 'manager' : d?.canSelfReview ? 'self' : null;

    const save = async () => {
        setBusy(true);
        try {
            const url = mode === 'self' ? `/app/appraisals/cycles/${cycleId}/self` : `/app/appraisals/cycles/${cycleId}/manager/${userId}`;
            const r = (await api.put(url, { Rating: rating, Comments: comments.trim() })).data;
            toast(r?.message || 'Saved');
            onBack();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Screen footer={mode ? <Button title={mode === 'self' ? 'Submit self-review' : 'Complete appraisal'} icon="send" onPress={save} busy={busy} disabled={!rating || !comments.trim()} /> : null}>
            <Header overline={d?.cycle?.Name || 'Appraisal'} title={d?.appraisal ? titleCase(d.appraisal.UserName) : '…'} onBack={onBack} />
            <Loadable state={state}>
                {() => (
                    <>
                        {d.appraisal ? <Tag label={APPRAISAL_STATUS[d.appraisal.Status]?.label} tone={APPRAISAL_STATUS[d.appraisal.Status]?.tone} /> : null}
                        <Card style={{ marginVertical: space(1.5) }}>
                            <KeyValue
                                rows={[
                                    ['Period', `${shortDate(d.cycle.PeriodFrom)} – ${shortDate(d.cycle.PeriodTo)}`],
                                    ['KPI score', d.kpi?.score ?? d.appraisal?.KpiScore ?? '—'],
                                    ['Self rating', d.appraisal?.SelfRating ?? '—'],
                                    ['Manager rating', d.appraisal?.ManagerRating ?? '—'],
                                    ['Final score', d.appraisal?.FinalScore ?? '—'],
                                ]}
                            />
                        </Card>
                        {d.appraisal?.SelfComments ? <Notice tone="info" title="Self-review">{d.appraisal.SelfComments}</Notice> : null}
                        {d.appraisal?.ManagerComments ? <Notice tone="success" title={`Manager · ${titleCase(d.appraisal.ManagerName)}`}>{d.appraisal.ManagerComments}</Notice> : null}
                        {mode ? (
                            <>
                                <SectionTitle title={mode === 'self' ? 'Your rating' : 'Your rating as manager'} caption="1 to 5, in half steps" />
                                <Stars value={rating} onChange={setRating} />
                                <Field label={mode === 'self' ? 'Achievements and goals' : 'Feedback for the employee'} value={comments} onChangeText={(v) => setComments(v.slice(0, 2000))} multiline autoCapitalize="sentences" />
                            </>
                        ) : null}
                    </>
                )}
            </Loadable>
        </Screen>
    );
}

// Appraisals: cycles, my self-review, and my team's reviews.
export function Appraisals({ navigation }) {
    const cycles = useLoad(async () => (await api.get('/app/appraisals/cycles')).data.cycles, [], "Couldn't load appraisal cycles.");
    const [cycleId, setCycleId] = useState(null);
    const [person, setPerson] = useState(null); // { userId } or {} for me
    const cycle = useLoad(async () => (cycleId ? (await api.get(`/app/appraisals/cycles/${cycleId}`)).data : null), [cycleId], "Couldn't load the cycle.");

    if (cycleId && person) return <AppraisalForm cycleId={cycleId} userId={person.userId} onBack={() => { setPerson(null); cycle.reload(); }} />;

    return (
        <Screen refreshControl={cycles.refreshControl}>
            <Header overline="HR" title="Appraisals" onBack={() => (cycleId ? setCycleId(null) : navigation.goBack())} />
            {!cycleId ? (
                <Loadable state={cycles}>
                    {(rows) =>
                        rows.length ? (
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {rows.map((c, i) => (
                                    <View key={c.CycleId} style={i > 0 && line}>
                                        <ListRow icon="award" title={c.Name} caption={`${shortDate(c.PeriodFrom)} – ${shortDate(c.PeriodTo)}`} right={<Tag label={c.Status === 'OPEN' ? 'Open' : 'Closed'} tone={c.Status === 'OPEN' ? 'success' : 'neutral'} />} onPress={() => setCycleId(c.CycleId)} />
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <Card>
                                <Empty icon="award" title="No appraisal cycles yet" caption="HR opens a cycle on the web." />
                            </Card>
                        )
                    }
                </Loadable>
            ) : (
                <Loadable state={cycle}>
                    {(d) => (
                        <>
                            <SectionTitle title={d.cycle.Name} caption={`${shortDate(d.cycle.PeriodFrom)} – ${shortDate(d.cycle.PeriodTo)}`} />
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {d.people.map((p, i) => (
                                    <View key={p.UserId} style={i > 0 && line}>
                                        <ListRow
                                            title={p.isSelf ? `${titleCase(p.Name || p.UserName)} (me)` : titleCase(p.Name || p.UserName)}
                                            caption={[p.FinalScore != null && `final ${p.FinalScore}`, p.isDirectReport && 'reports to you'].filter(Boolean).join(' · ')}
                                            right={<Tag label={APPRAISAL_STATUS[p.Status]?.label} tone={APPRAISAL_STATUS[p.Status]?.tone} />}
                                            onPress={() => setPerson({ userId: p.isSelf ? undefined : p.UserId })}
                                        />
                                    </View>
                                ))}
                            </Card>
                        </>
                    )}
                </Loadable>
            )}
        </Screen>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    actions: { flexDirection: 'row', alignItems: 'center', gap: space(1), marginTop: space(1) },
    balances: { flexDirection: 'row', flexWrap: 'wrap', gap: space(1.25), marginBottom: space(1) },
    balance: { flexGrow: 1, minWidth: 100, padding: space(1.5) },
    gridRow: { flexDirection: 'row' },
    gridHead: { flex: 1, textAlign: 'center', fontFamily: fonts.bold, fontSize: 11, color: colors.inkMuted, marginBottom: 4 },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    cell: { width: `${100 / 7}%`, aspectRatio: 1, padding: 2, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper },
    cellDay: { fontFamily: fonts.medium, fontSize: 10, color: colors.inkMuted },
    cellCode: { fontFamily: fonts.bold, fontSize: 13, color: colors.ink },
    stars: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: space(2) },
    star: { width: 44, height: 40, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.lineStrong, alignItems: 'center', justifyContent: 'center' },
    starOn: { backgroundColor: colors.jade, borderColor: colors.jade },
    starText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft },
});
