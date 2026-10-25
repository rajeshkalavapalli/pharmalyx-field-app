import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { api, currentSession } from '../api';
import { ago, clock, doctorName, plural, titleCase } from '../format';
import { usePermissions } from '../permissions';
import { APPROVAL_PERMISSIONS } from '../menu';
import { colors, fonts, gradients, radius, space, text } from '../theme';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, ListRow, Loadable, MiniBars, Screen, SectionTitle, StatGrid, Tag } from '../ui';

const MEMBER_STATUS = {
    IN_FIELD: { label: 'In the field', tone: 'success' },
    DCR_SENT: { label: 'DCR sent', tone: 'primary' },
    NOT_STARTED: { label: 'No activity yet', tone: 'warning' },
    OFF: { label: 'Off today', tone: 'neutral' },
};
const COVERAGE_STATUS = { COVERED: { label: 'Covered', tone: 'success' }, PENDING: { label: 'Planned', tone: 'info' }, NOT_PLANNED: { label: 'Not planned', tone: 'warning' } };

const greeting = () => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const dayShort = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric' });
const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);

function TeamView({ data, navigation }) {
    const t = data.teamSummary;
    const names = new Map((data.team || []).map((m) => [String(m.UserId).toLowerCase(), m]));
    const members = (t.membersToday || []).map((m) => ({ ...names.get(String(m.UserId).toLowerCase()), ...m }));
    const approvals = data.approvals || {};
    const waiting = (approvals.tourPlans || 0) + (approvals.dcrs || 0) + (approvals.deviations || 0);

    return (
        <>
            <StatGrid
                items={[
                    { icon: 'users', label: 'Reps in the field', value: `${t.repsActiveToday}/${t.reps}`, caption: 'Active today', tone: t.repsActiveToday ? 'success' : 'warning' },
                    { icon: 'map-pin', label: 'Team visits today', value: `${t.visitsToday}`, caption: `${t.plannedToday} planned` },
                    t.businessAchievement != null && { icon: 'trending-up', label: 'Business achieved', value: `${t.businessAchievement}%`, caption: 'Of expected this month', tone: 'info' },
                    { icon: 'shuffle', label: 'Plan deviations', value: `${t.deviationsMonth}`, caption: 'This month', tone: t.deviationsMonth ? 'warning' : 'brand' },
                ]}
            />

            {waiting > 0 && (
                <Card style={{ marginBottom: space(1.5), padding: 0 }}>
                    <ListRow
                        icon="inbox"
                        tone="warning"
                        title={`${plural(waiting, 'item')} waiting for you`}
                        caption={[approvals.tourPlans && `${approvals.tourPlans} tour plan`, approvals.dcrs && `${approvals.dcrs} DCR`, approvals.deviations && `${approvals.deviations} deviation`].filter(Boolean).join(' · ')}
                        onPress={() => navigation.navigate('Approvals')}
                    />
                </Card>
            )}

            <SectionTitle title="Team today" caption={`${t.repsActiveToday} of ${t.reps} in the field`} />
            <Card style={{ padding: 0 }}>
                {members.length ? (
                    members.map((m, i) => {
                        const status = MEMBER_STATUS[m.status] || MEMBER_STATUS.NOT_STARTED;
                        return (
                            <View key={m.UserId} style={[styles.member, i > 0 && styles.rowLine]}>
                                <View style={styles.avatar}>
                                    <Text style={styles.avatarText}>{titleCase(m.Name || '?').charAt(0)}</Text>
                                </View>
                                <View style={{ flex: 1, minWidth: 0 }}>
                                    <Text style={text.subtitle} numberOfLines={1}>{titleCase(m.Name)}</Text>
                                    <Text style={text.small} numberOfLines={1}>
                                        {[`${m.visits}/${m.planned || 0} visits`, m.territory && titleCase(m.territory), m.firstVisit && `${clock(m.firstVisit)}–${clock(m.lastVisit)}`].filter(Boolean).join(' · ')}
                                    </Text>
                                </View>
                                <Tag label={status.label} tone={status.tone} />
                            </View>
                        );
                    })
                ) : (
                    <Empty icon="users" title="No one reports to you yet" caption="Your team appears here once people are assigned to you." />
                )}
            </Card>

            <SectionTitle title="Team visit performance" caption="Planned (light) vs completed, last 14 days" />
            <Card>
                <MiniBars data={(t.trend || []).map((d) => ({ label: dayShort(d.date), value: d.visits, secondary: d.planned }))} />
            </Card>

            {t.territoryCoverage && (
                <>
                    <SectionTitle title="Territory coverage" caption={`${t.territoryCoverage.covered} of ${t.territoryCoverage.total} covered this month`} />
                    <Card style={{ padding: 0 }}>
                        {t.territoryCoverage.top?.length ? (
                            t.territoryCoverage.top.map((row, i) => (
                                <View key={row.TerritoryId} style={[styles.member, i > 0 && styles.rowLine]}>
                                    <View style={{ flex: 1 }}>
                                        <Text style={text.subtitle}>{titleCase(row.TerritoryName)}</Text>
                                        <Text style={text.small}>{`${row.doctorsVisited}/${row.doctors} doctors · ${plural(row.visits, 'visit')}`}</Text>
                                    </View>
                                    <Tag label={`${row.coverage}% · ${COVERAGE_STATUS[row.status]?.label}`} tone={COVERAGE_STATUS[row.status]?.tone} />
                                </View>
                            ))
                        ) : (
                            <Empty icon="map" title="No team territories yet" caption="Map areas to your team on the web (Configuration)." />
                        )}
                    </Card>
                </>
            )}
        </>
    );
}

function WorkView({ data, navigation }) {
    const m = data.month;
    const schedule = data.today?.schedule || [];
    const growth = m.visitsPrevMonthToDate ? Math.round(((m.visits - m.visitsPrevMonthToDate) / m.visitsPrevMonthToDate) * 100) : null;

    return (
        <>
            <StatGrid
                items={[
                    { icon: 'map-pin', label: 'Visits this month', value: `${m.visits}`, caption: growth == null ? `${data.today.visits} today` : `${growth >= 0 ? '+' : ''}${growth}% vs last month`, tone: 'brand' },
                    { icon: 'target', label: 'Doctors covered', value: `${m.doctorsVisited}/${m.doctorsMapped}`, caption: `${pct(m.doctorsVisited, m.doctorsMapped)}% of your doctors`, tone: 'success' },
                    { icon: 'file-text', label: 'DCRs', value: `${m.dcrSent}`, caption: `${m.dcrApproved} approved${m.dcrMissed ? ` · ${m.dcrMissed} missed` : ''}`, tone: m.dcrMissed ? 'warning' : 'info' },
                    { icon: 'navigation', label: 'Distance', value: `${Math.round(m.distanceKm || 0)} km`, caption: m.avgCallMinutes ? `Avg call ${m.avgCallMinutes} min` : 'This month', tone: 'info' },
                ]}
            />

            <SectionTitle title="Today's schedule" caption={schedule.length ? `${schedule.filter((s) => s.planned).length} planned calls` : undefined} />
            <Card style={{ padding: 0 }}>
                {schedule.length ? (
                    schedule.slice(0, 8).map((item, i) => (
                        <View key={`${item.DoctorName}-${i}`} style={[styles.member, i > 0 && styles.rowLine]}>
                            <Feather name={item.Status === 'DONE' || item.VisitTime ? 'check-circle' : 'circle'} size={18} color={item.VisitTime ? colors.success : colors.inkFaint} />
                            <View style={{ flex: 1 }}>
                                <Text style={text.subtitle} numberOfLines={1}>{doctorName(item.DoctorName)}</Text>
                                <Text style={text.small} numberOfLines={1}>{[titleCase(item.HospitalName), item.VisitTime && `Visited ${String(item.VisitTime).slice(0, 5)}`].filter(Boolean).join(' · ') || (item.planned ? 'Planned' : 'Unplanned visit')}</Text>
                            </View>
                        </View>
                    ))
                ) : (
                    <>
                        <Empty icon="calendar" title="Nothing planned today" caption="Plan your calls in Pre-call Planning, or open My Day to see doctors due." />
                        <Button title="Open My Day" icon="sun" variant="outline" onPress={() => navigation.navigate('Today')} style={{ margin: space(2), marginTop: 0 }} />
                    </>
                )}
            </Card>

            <SectionTitle title="Visits, last 14 days" caption="Planned (light) vs completed" />
            <Card>
                <MiniBars data={(data.trend || []).map((d) => ({ label: dayShort(d.date), value: d.visits, secondary: d.planned }))} />
            </Card>

            {data.followUps?.due > 0 && (
                <>
                    <SectionTitle title="Follow-ups due" caption={data.followUps.overdue ? `${data.followUps.overdue} overdue` : 'In the next few days'} />
                    <Card style={{ padding: 0 }}>
                        {data.followUps.items.map((f, i) => (
                            <View key={`${f.VisitId || i}`} style={[styles.member, i > 0 && styles.rowLine]}>
                                <View style={{ flex: 1 }}>
                                    <Text style={text.subtitle} numberOfLines={1}>{doctorName(f.DoctorName)}</Text>
                                    <Text style={text.small} numberOfLines={2}>{f.FollowUpNote || f.Notes || 'Follow up'}</Text>
                                </View>
                                <Text style={text.small}>{f.FollowUpDate}</Text>
                            </View>
                        ))}
                    </Card>
                </>
            )}

            <SectionTitle title="Recent visits" />
            <Card style={{ padding: 0 }}>
                {data.recentVisits?.length ? (
                    data.recentVisits.map((v, i) => (
                        <View key={v.VisitId} style={[styles.member, i > 0 && styles.rowLine]}>
                            <View style={{ flex: 1 }}>
                                <Text style={text.subtitle} numberOfLines={1}>{doctorName(v.DoctorName)}</Text>
                                <Text style={text.small} numberOfLines={1}>{[titleCase(v.HospitalName || v.AreaName), v.VisitDate].filter(Boolean).join(' · ')}</Text>
                            </View>
                            {v.Feedback ? <Tag label={titleCase(v.Feedback)} tone={v.Feedback === 'POSITIVE' ? 'success' : v.Feedback === 'NEGATIVE' ? 'error' : 'neutral'} /> : null}
                        </View>
                    ))
                ) : (
                    <Empty icon="map-pin" title="No visits yet" caption="Your latest visits show here." />
                )}
            </Card>
        </>
    );
}

// Home: the same numbers as the web dashboard, with "My team" / "My work" for managers.
export default function Dashboard({ navigation }) {
    const state = useLoad(async () => (await api.get('/app/dashboard')).data, [], "Couldn't load the dashboard.");
    const permissions = usePermissions();
    const [view, setView] = useState(null);
    const user = currentSession()?.user;
    const hasTeam = Boolean(state.data?.teamSummary);
    const shown = view || (hasTeam ? 'team' : 'work');
    const name = titleCase(state.data?.user?.Name || user?.Name || user?.UserName || '');

    return (
        <Screen refreshControl={state.refreshControl}>
            <LinearGradient colors={gradients.ink} style={styles.hero}>
                <Text style={[text.overline, { color: colors.jadeGlow }]}>Welcome back</Text>
                <Text style={styles.heroTitle}>
                    {greeting()}, {name.split(' ')[0]}
                </Text>
                <Text style={styles.heroMeta}>
                    {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                    {state.data?.user?.DesignationName ? ` · ${state.data.user.DesignationName}` : ''}
                </Text>
                {hasTeam ? (
                    <Text style={styles.heroLine}>
                        {`${state.data.teamSummary.repsActiveToday} of ${state.data.teamSummary.reps} representatives in the field today`}
                    </Text>
                ) : state.data ? (
                    <Text style={styles.heroLine}>{`${plural(state.data.today.visits, 'visit')} today · ${plural(state.data.month.visits, 'visit')} this month`}</Text>
                ) : null}
                {permissions.any(APPROVAL_PERMISSIONS) && (
                    <Button title="Open approvals" icon="inbox" small onPress={() => navigation.navigate('Approvals')} style={{ marginTop: space(1.5), alignSelf: 'flex-start' }} />
                )}
            </LinearGradient>

            {hasTeam && (
                <Chips
                    options={[
                        { value: 'team', label: 'My team' },
                        { value: 'work', label: 'My work' },
                    ]}
                    value={shown}
                    onChange={setView}
                />
            )}

            <Loadable state={state} rows={5}>
                {(data) => (shown === 'team' && data.teamSummary ? <TeamView data={data} navigation={navigation} /> : <WorkView data={data} navigation={navigation} />)}
            </Loadable>
            {state.data ? <Text style={[text.small, { textAlign: 'center', marginTop: space(2) }]}>Pull down to refresh · updated {ago(new Date())}</Text> : null}
        </Screen>
    );
}

const styles = StyleSheet.create({
    hero: { borderRadius: radius.xl, padding: space(2.25), marginBottom: space(2) },
    heroTitle: { fontFamily: fonts.display, fontSize: 24, lineHeight: 30, color: colors.white, marginTop: 4 },
    heroMeta: { fontFamily: fonts.medium, fontSize: 12.5, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
    heroLine: { fontFamily: fonts.semibold, fontSize: 13, color: colors.jadeGlow, marginTop: space(1.25) },
    member: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingHorizontal: space(1.75), paddingVertical: space(1.4) },
    rowLine: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
    avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: colors.jadeMist, alignItems: 'center', justifyContent: 'center' },
    avatarText: { fontFamily: fonts.bold, fontSize: 15, color: colors.jadeDark },
});
