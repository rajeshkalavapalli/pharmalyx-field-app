import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, dateKey, errorMessage, monthKey } from '../api';
import { doctorName, titleCase } from '../format';
import { PersonPicker, usePeople } from '../people';
import { usePermissions } from '../permissions';
import { colors, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Field, Header, ListRow, Loadable, MonthSwitcher, ReasonDialog, Screen, StatGrid, Tag } from '../ui';
import { RESULT } from './MyDay';

const FLAG_LABEL = {
    DAY_START_OUTSIDE: 'Day started outside territory',
    VISIT_OUTSIDE_TERRITORY: 'Visit outside territory',
    DRIVE_BY: 'Drive-by check-in',
    OUTSIDE_GEOFENCE: 'Away from clinic',
    SAME_SPOT: 'Many clinics, one spot',
    IMPOSSIBLE_TRAVEL: 'Impossible travel',
    MOCK_GPS: 'Fake GPS',
    NO_GPS: 'No GPS',
    POB_INFLATED: 'Inflated order quantity',
    POB_FIRST_LARGE: 'Large first order',
    POB_NO_REORDER: 'Large order, no reorder',
    POB_MONTH_END_SPIKE: 'Month-end order spike',
    POB_DUPLICATE_SLIP: 'Same slip photo reused',
    POB_UNSUPPLIED: 'POB not supplied in time',
};
const SEVERITY = { HIGH: 'error', MEDIUM: 'warning', LOW: 'info' };
const line = { borderTopWidth: 1, borderTopColor: colors.lineSoft };
const shortDate = (v) => (v ? new Date(String(v).length <= 10 ? `${v}T00:00:00` : v).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '—');
const firstOfMonth = () => `${monthKey()}-01`;

function VisitsTab({ canDecide, navigation }) {
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [validity, setValidity] = useState('REVIEW');
    const state = useLoad(async () => (await api.get('/app/work/visits', { params: { from: firstOfMonth(), to: dateKey(), userId: userId || undefined, validity: validity || undefined } })).data, [userId, validity], "Couldn't load visits.");
    const [pending, setPending] = useState(null); // { visit, validity }

    const override = async (reason) => {
        try {
            const r = (await api.post(`/app/work/visits/${pending.visit.VisitId}/override`, { Validity: pending.validity, Reason: reason })).data;
            toast(r?.message || 'Saved');
            setPending(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    return (
        <>
            <PersonPicker people={people} value={userId} onChange={setUserId} />
            <Chips
                options={[
                    { value: 'REVIEW', label: 'Needs a look' },
                    { value: 'INVALID', label: 'Not counted' },
                    { value: 'VALID', label: 'Counted' },
                    { value: '', label: 'All' },
                ]}
                value={validity}
                onChange={setValidity}
            />
            <Loadable state={state} rows={5}>
                {(data) =>
                    data.visits.length ? (
                        <View style={{ gap: space(1.25) }}>
                            {data.visits.map((v) => {
                                const r = RESULT[v.FinalValidity];
                                return (
                                    <Card key={v.VisitId} style={{ padding: space(1.5) }}>
                                        <View style={styles.top}>
                                            <Text style={[text.subtitle, { flex: 1 }]} numberOfLines={1} onPress={() => navigation.navigate('VisitDetail', { visitId: v.VisitId })}>
                                                {doctorName(v.DoctorName)}
                                            </Text>
                                            {r ? <Tag label={r.label.replace('Counted · ', '')} tone={r.tone} /> : null}
                                        </View>
                                        <Text style={text.small}>{[titleCase(v.EmployeeName), shortDate(v.VisitDate), titleCase(v.AreaName), v.DwellSeconds != null && `stayed ${Math.round(v.DwellSeconds / 60)} min`, v.DistanceFromClinicM != null && `${v.DistanceFromClinicM} m from clinic`].filter(Boolean).join(' · ')}</Text>
                                        {(v.reasons || []).map((x) => (
                                            <Text key={x.code} style={[text.small, { color: x.hard ? colors.errorDark : colors.warningDark }]}>
                                                • {x.text}
                                            </Text>
                                        ))}
                                        {v.OverrideReason ? <Text style={text.small}>{`Decided by ${titleCase(v.OverrideByName)}: “${v.OverrideReason}”`}</Text> : null}
                                        {canDecide ? (
                                            <View style={styles.actions}>
                                                {v.FinalValidity !== 'VALID' ? <Button title="Count it" small icon="check" onPress={() => setPending({ visit: v, validity: 'VALID' })} style={{ flex: 1 }} /> : null}
                                                {v.FinalValidity !== 'INVALID' ? <Button title="Don't count" small variant="danger" onPress={() => setPending({ visit: v, validity: 'INVALID' })} style={{ flex: 1 }} /> : null}
                                            </View>
                                        ) : null}
                                    </Card>
                                );
                            })}
                        </View>
                    ) : (
                        <Card>
                            <Empty icon="check-circle" title="Nothing here this month" />
                        </Card>
                    )
                }
            </Loadable>
            <ReasonDialog
                visible={Boolean(pending)}
                title={pending?.validity === 'VALID' ? 'Count this visit?' : "Don't count this visit?"}
                caption="This is recorded with your name and reason; the employee sees it."
                label="Reason"
                submitLabel="Save decision"
                onSubmit={override}
                onClose={() => setPending(null)}
            />
        </>
    );
}

function CoverageTab() {
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const [month, setMonth] = useState(monthKey());
    const state = useLoad(async () => (await api.get('/app/work/coverage', { params: { month: `${month}-01`, userId: userId || undefined } })).data, [month, userId], "Couldn't load coverage.");
    return (
        <>
            <PersonPicker people={people} value={userId} onChange={setUserId} />
            <MonthSwitcher value={month} onChange={setMonth} />
            <Loadable state={state} rows={5}>
                {(data) => {
                    const s = data.summary || {};
                    return (
                        <>
                            <StatGrid
                                items={[
                                    { icon: 'target', label: 'Coverage', value: `${s.percent ?? 0}%`, caption: `${s.met || 0} of ${s.doctors || 0} doctors met`, tone: 'success' },
                                    { icon: 'alert-circle', label: 'Missed', value: `${s.missed || 0}`, caption: `${s.valid || 0} of ${s.required || 0} required visits counted`, tone: s.missed ? 'warning' : 'brand' },
                                ]}
                            />
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {(data.rows || []).map((row, i) => (
                                    <View key={row.DoctorId} style={i > 0 && line}>
                                        <ListRow title={doctorName(row.DoctorName)} caption={[row.Category && `Class ${row.Category}`, titleCase(row.AreaName), row.timing?.label].filter(Boolean).join(' · ')} right={<Tag label={`${row.valid}/${row.required}`} tone={row.valid >= row.required ? 'success' : row.valid ? 'warning' : 'error'} />} />
                                    </View>
                                ))}
                            </Card>
                        </>
                    );
                }}
            </Loadable>
        </>
    );
}

function FlagsTab({ canDecide }) {
    const [status, setStatus] = useState('OPEN');
    const state = useLoad(async () => (await api.get('/app/work/flags', { params: { status } })).data, [status], "Couldn't load red flags.");
    const [pending, setPending] = useState(null);
    const act = async (note) => {
        try {
            const r = (await api.post(`/app/work/flags/${pending.flag.FlagId}`, { Status: pending.status, Note: note || null })).data;
            toast(r?.message || 'Saved');
            setPending(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    return (
        <>
            <Chips
                options={[
                    { value: 'OPEN', label: 'Open' },
                    { value: 'ACKNOWLEDGED', label: 'Acknowledged' },
                    { value: 'RESOLVED', label: 'Resolved' },
                ]}
                value={status}
                onChange={setStatus}
            />
            <Text style={[text.small, { marginBottom: space(1.5) }]}>Red flags lead to a review, not a penalty.</Text>
            <Loadable state={state}>
                {(data) =>
                    data.flags.length ? (
                        <View style={{ gap: space(1.25) }}>
                            {data.flags.map((f) => (
                                <Card key={f.FlagId} style={{ padding: space(1.5) }}>
                                    <View style={styles.top}>
                                        <Tag label={FLAG_LABEL[f.FlagType] || f.FlagType} tone={SEVERITY[f.Severity] || 'neutral'} />
                                        <Text style={[text.small, { marginLeft: 'auto' }]}>{shortDate(f.CreatedOn)}</Text>
                                    </View>
                                    <Text style={[text.subtitle, { marginTop: 6 }]}>{titleCase(f.EmployeeName)}</Text>
                                    {f.Details ? <Text style={text.small}>{typeof f.Details === 'string' ? f.Details : JSON.stringify(f.Details)}</Text> : null}
                                    {f.Note ? <Text style={text.small}>{`${titleCase(f.ActedByName)}: “${f.Note}”`}</Text> : null}
                                    {canDecide && f.Status === 'OPEN' ? (
                                        <View style={styles.actions}>
                                            <Button title="Acknowledge" small variant="outline" onPress={() => setPending({ flag: f, status: 'ACKNOWLEDGED' })} style={{ flex: 1 }} />
                                            <Button title="Resolve" small icon="check" onPress={() => setPending({ flag: f, status: 'RESOLVED' })} style={{ flex: 1 }} />
                                        </View>
                                    ) : null}
                                </Card>
                            ))}
                        </View>
                    ) : (
                        <Card>
                            <Empty icon="flag" title="No red flags here" />
                        </Card>
                    )
                }
            </Loadable>
            <ReasonDialog visible={Boolean(pending)} title={pending?.status === 'RESOLVED' ? 'Resolve this flag?' : 'Acknowledge this flag?'} label="Note (optional)" minLength={0} submitLabel="Save" onSubmit={act} onClose={() => setPending(null)} />
        </>
    );
}

function StockTab() {
    const people = usePeople();
    const [userId, setUserId] = useState('');
    const state = useLoad(async () => (await api.get('/app/stock/reconciliation', { params: { userId: userId || undefined } })).data, [userId], "Couldn't load sample stock.");
    const [counts, setCounts] = useState({});
    const [busy, setBusy] = useState(false);
    const entered = Object.entries(counts).filter(([, v]) => v !== '');

    const save = async () => {
        setBusy(true);
        try {
            const r = (
                await api.post('/app/stock/counts', {
                    UserId: userId || undefined,
                    Counts: entered.map(([key, value]) => {
                        const [ItemType, ItemId] = key.split(':');
                        return { ItemType, ItemId, CountedQty: Number(value) };
                    }),
                    Remarks: null,
                })
            ).data;
            toast(r?.message || 'Count saved');
            setCounts({});
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <PersonPicker people={people} value={userId} onChange={setUserId} />
            <Loadable state={state}>
                {(data) =>
                    data.items.length ? (
                        <>
                            <Text style={[text.small, { marginBottom: space(1.5) }]}>Expected = issued − given in visits − returned. Enter what is physically in hand.</Text>
                            <View style={{ gap: space(1.25) }}>
                                {data.items.map((item) => {
                                    const key = `${item.ItemType}:${item.ItemId}`;
                                    return (
                                        <Card key={key} style={{ padding: space(1.5) }}>
                                            <View style={styles.top}>
                                                <Text style={[text.subtitle, { flex: 1 }]}>{item.ItemName}</Text>
                                                <Tag label={`Expected ${item.Expected}`} tone="primary" />
                                            </View>
                                            <Text style={text.small}>{`Issued ${item.Issued} · given ${item.Given} · returned ${item.Returned}${item.LastCountedOn ? ` · last count ${shortDate(item.LastCountedOn)} (${item.LastCountDifference >= 0 ? '+' : ''}${item.LastCountDifference})` : ''}`}</Text>
                                            <Field label="Counted now" value={counts[key] ?? ''} onChangeText={(v) => setCounts((c) => ({ ...c, [key]: v.replace(/\D/g, '').slice(0, 6) }))} keyboardType="number-pad" />
                                        </Card>
                                    );
                                })}
                            </View>
                            <Button title={`Save count${entered.length ? ` (${entered.length})` : ''}`} icon="check" onPress={save} busy={busy} disabled={!entered.length} style={{ marginTop: space(1.5) }} />
                        </>
                    ) : (
                        <Card>
                            <Empty icon="package" title="No samples or gifts issued" />
                        </Card>
                    )
                }
            </Loadable>
        </>
    );
}

function RulesTab({ canEdit }) {
    const state = useLoad(async () => (await api.get('/app/work/settings')).data, [], "Couldn't load the rules.");
    const [values, setValues] = useState({});
    const [asking, setAsking] = useState(false);
    const changed = (state.data?.settings || []).filter((row) => values[row.key] !== undefined && Number(values[row.key]) !== row.value);
    const save = async (reason) => {
        try {
            const r = (await api.put('/app/work/settings', { Values: Object.fromEntries(changed.map((row) => [row.key, Number(values[row.key])])), Reason: reason })).data;
            toast(r?.message || 'Rules saved');
            setAsking(false);
            setValues({});
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    return (
        <Loadable state={state}>
            {(data) => (
                <>
                    {data.settings.map((row) => (
                        <Card key={row.key} style={{ marginBottom: space(1.25), padding: space(1.5) }}>
                            <Text style={text.subtitle}>{row.description || row.key}</Text>
                            {canEdit ? (
                                <Field label={row.limits ? `Allowed ${row.limits[0]}–${row.limits[1]}` : 'Value'} value={values[row.key] ?? String(row.value)} onChangeText={(v) => setValues((s) => ({ ...s, [row.key]: v.replace(/[^\d.]/g, '') }))} keyboardType="decimal-pad" />
                            ) : (
                                <Text style={text.title}>{row.value}</Text>
                            )}
                        </Card>
                    ))}
                    {canEdit ? <Button title={`Save ${changed.length} change(s)`} icon="check" disabled={!changed.length} onPress={() => setAsking(true)} /> : null}
                    <ReasonDialog visible={asking} title="Why are the rules changing?" caption="Changes are recorded with your name." label="Reason" submitLabel="Save rules" onSubmit={save} onClose={() => setAsking(false)} />
                </>
            )}
        </Loadable>
    );
}

function BoundariesTab({ canDecide }) {
    const state = useLoad(async () => (await api.get('/app/work/boundaries')).data, [], "Couldn't load boundaries.");
    const approve = async (id) => {
        try {
            const r = (await api.post(`/app/work/boundaries/${id}/approve`, { Remarks: null })).data;
            toast(r?.message || 'Boundary approved');
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    return (
        <Loadable state={state}>
            {(data) =>
                (data.users || []).length ? (
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {data.users.map((u, i) => (
                            <View key={u.UserId} style={[styles.pad, i > 0 && line]}>
                                <View style={styles.top}>
                                    <Text style={[text.subtitle, { flex: 1 }]}>{titleCase(u.Name)}</Text>
                                    <Tag label={u.approved ? 'Approved' : u.draft ? 'Draft' : 'None'} tone={u.approved ? 'success' : u.draft ? 'warning' : 'neutral'} />
                                </View>
                                <Text style={text.small}>{`${u.pinnedDoctors ?? 0} pinned doctors${u.draft ? ` · draft from ${u.draft.source}, ${u.draft.marginKm} km margin` : ''}`}</Text>
                                {u.draft && canDecide ? <Button title="Approve draft" small icon="check" onPress={() => approve(u.draft.BoundaryId)} style={{ marginTop: space(1), alignSelf: 'flex-start' }} /> : null}
                            </View>
                        ))}
                    </Card>
                ) : (
                    <Card>
                        <Empty icon="map" title="No boundaries yet" caption="Boundaries are drawn on the web from each person's pinned doctors." />
                    </Card>
                )
            }
        </Loadable>
    );
}

function ExceptionsTab({ canDecide }) {
    const state = useLoad(async () => (await api.get('/app/work/exceptions')).data, [], "Couldn't load exceptions.");
    const [revoking, setRevoking] = useState(null);
    const revoke = async (reason) => {
        try {
            const r = (await api.post(`/app/work/exceptions/${revoking.ExceptionId}/revoke`, { Reason: reason })).data;
            toast(r?.message || 'Revoked');
            setRevoking(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };
    const rows = state.data?.exceptions || [];
    return (
        <Loadable state={state}>
            {() =>
                rows.length ? (
                    <View style={{ gap: space(1.25) }}>
                        {rows.map((e) => (
                            <Card key={e.ExceptionId} style={{ padding: space(1.5) }}>
                                <View style={styles.top}>
                                    <Text style={[text.subtitle, { flex: 1 }]}>{titleCase(e.UserName)}</Text>
                                    <Tag label={e.RevokedOn ? 'Revoked' : titleCase(String(e.ExceptionType).replace(/_/g, ' '))} tone={e.RevokedOn ? 'neutral' : 'info'} />
                                </View>
                                <Text style={text.small}>{[`${shortDate(e.FromDate)} – ${shortDate(e.ToDate)}`, e.DoctorName && doctorName(e.DoctorName), e.CoverUserName && `cover: ${titleCase(e.CoverUserName)}`, `by ${titleCase(e.GrantedByName)}`].filter(Boolean).join(' · ')}</Text>
                                {e.Reason ? <Text style={text.small}>“{e.Reason}”</Text> : null}
                                {canDecide && !e.RevokedOn ? <Button title="Revoke" small variant="danger" onPress={() => setRevoking(e)} style={{ marginTop: space(1), alignSelf: 'flex-start' }} /> : null}
                            </Card>
                        ))}
                    </View>
                ) : (
                    <Card>
                        <Empty icon="calendar" title="No exceptions" caption="Exceptions (leave cover, special duty) are granted on the web." />
                    </Card>
                )
            }
            <ReasonDialog visible={Boolean(revoking)} title="Revoke this exception?" label="Reason" submitLabel="Revoke" onSubmit={revoke} onClose={() => setRevoking(null)} />
        </Loadable>
    );
}

function HospitalsTab() {
    const state = useLoad(async () => (await api.get('/app/work/hospitals')).data, [], "Couldn't load hospitals.");
    const rows = state.data?.hospitals || [];
    return (
        <Loadable state={state}>
            {() =>
                rows.length ? (
                    <Card style={{ padding: 0, overflow: 'hidden' }}>
                        {rows.map((h, i) => (
                            <View key={h.HospitalId} style={i > 0 && line}>
                                <ListRow icon="plus-square" title={titleCase(h.HospitalName)} caption={`${h.Doctors ?? 0} doctors · ${h.RadiusM} m radius${h.IsActive === false ? ' · inactive' : ''}`} chevron={false} />
                            </View>
                        ))}
                    </Card>
                ) : (
                    <Card>
                        <Empty icon="plus-square" title="No hospitals set up" caption="Hospitals with many doctors share one check-in area." />
                    </Card>
                )
            }
        </Loadable>
    );
}

// Head office / manager review of field work: visits, coverage, red flags, sample stock, and the rules.
export default function VerifiedWork({ navigation }) {
    const permissions = usePermissions();
    const canDecide = permissions.has('verifiedwork.approve');
    const canEdit = permissions.has('verifiedwork.edit');
    const [tab, setTab] = useState('visits');
    const tabs = [
        { value: 'visits', label: 'Visits' },
        { value: 'coverage', label: 'Coverage' },
        { value: 'flags', label: 'Red flags' },
        { value: 'stock', label: 'Samples' },
        { value: 'boundaries', label: 'Boundaries' },
        { value: 'exceptions', label: 'Exceptions' },
        { value: 'hospitals', label: 'Hospitals' },
        { value: 'rules', label: 'Rules' },
    ];
    return (
        <Screen>
            <Header overline="Field operations" title="Verified work" onBack={() => navigation.goBack()} />
            <Chips options={tabs} value={tab} onChange={setTab} />
            {tab === 'visits' && <VisitsTab canDecide={canDecide} navigation={navigation} />}
            {tab === 'coverage' && <CoverageTab />}
            {tab === 'flags' && <FlagsTab canDecide={canDecide} />}
            {tab === 'stock' && <StockTab />}
            {tab === 'rules' && <RulesTab canEdit={canEdit} />}
            {tab === 'boundaries' && <BoundariesTab canDecide={canDecide} />}
            {tab === 'exceptions' && <ExceptionsTab canDecide={canDecide} />}
            {tab === 'hospitals' && <HospitalsTab />}
        </Screen>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
    actions: { flexDirection: 'row', gap: space(1), marginTop: space(1.25) },
    pad: { padding: space(1.5) },
});

