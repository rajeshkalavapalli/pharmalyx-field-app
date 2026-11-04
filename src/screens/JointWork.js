import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { api, dateKey, errorMessage, monthKey } from '../api';
import { titleCase } from '../format';
import { toast } from '../toast';
import { colors, space, text } from '../theme';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Header, ListRow, Loadable, MonthSwitcher, MultiSelect, ReasonDialog, Screen, SectionTitle, StatGrid, Tag } from '../ui';

const STATUS = {
    PENDING: { label: 'Waiting', tone: 'warning' },
    CONFIRMED: { label: 'Confirmed', tone: 'success' },
    DECLINED: { label: 'Declined', tone: 'neutral' },
};

const shiftDay = (by) => {
    const d = new Date();
    d.setDate(d.getDate() + by);
    return dateKey(d);
};
const dayLabel = (key) => new Date(`${key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
const person = (name, designation) => [titleCase(name), designation].filter(Boolean).join(' · ');

// Joint work: ask your manager / colleagues to work a day with you; answer requests and give coaching feedback.
export default function JointWork({ navigation }) {
    const [month, setMonth] = useState(monthKey());
    const state = useLoad(async () => (await api.get('/app/joint-work', { params: { month } })).data, [month], "Couldn't load joint work.");
    const people = useLoad(async () => (await api.get('/app/people')).data, [], '');
    const [day, setDay] = useState(dateKey());
    const [chosen, setChosen] = useState([]);
    const [busy, setBusy] = useState(false);
    const [feedbackFor, setFeedbackFor] = useState(null);
    const [rating, setRating] = useState(4);

    const act = async (work) => {
        try {
            const r = (await work()).data;
            toast(r?.message || 'Done');
            state.reload();
            return true;
        } catch (err) {
            toast(errorMessage(err), 'error');
            return false;
        }
    };

    const ask = async () => {
        setBusy(true);
        if (await act(() => api.post('/app/joint-work', { WorkDate: day, ColleagueUserIds: chosen }))) setChosen([]);
        setBusy(false);
    };

    const colleagues = (people.data?.colleagues || []).map((c) => ({ value: c.id, label: titleCase(c.name), detail: c.designation || undefined }));

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Daily work" title="Joint Work" onBack={() => navigation.goBack()} />

            <Card style={{ marginBottom: space(2) }}>
                <Text style={[text.subtitle, { marginBottom: space(1) }]}>Ask for joint work</Text>
                <Chips
                    options={[
                        { value: dateKey(), label: 'Today' },
                        { value: shiftDay(1), label: 'Tomorrow' },
                        { value: shiftDay(2), label: dayLabel(shiftDay(2)) },
                        { value: shiftDay(3), label: dayLabel(shiftDay(3)) },
                    ]}
                    value={day}
                    onChange={setDay}
                />
                <MultiSelect label="Colleagues" value={chosen} options={colleagues} onChange={setChosen} placeholder="Your manager, team or territory colleagues" max={5} empty="No colleagues found." />
                <Button title="Send request" icon="users" onPress={ask} busy={busy} disabled={!chosen.length} />
                <Text style={[text.small, { marginTop: space(1) }]}>Your visits that day are marked as joint work with them. They confirm it from their app.</Text>
            </Card>

            <MonthSwitcher value={month} onChange={setMonth} allowFuture />
            <Loadable state={state} rows={4}>
                {(data) => (
                    <>
                        <StatGrid
                            items={[
                                { icon: 'users', label: 'Days with my team', value: `${data.summary.jointDays}`, caption: `${data.summary.jointCalls} joint calls`, tone: 'info' },
                                { icon: 'inbox', label: 'Waiting for me', value: `${data.summary.pending}`, caption: `${data.summary.feedbackDue} feedback due`, tone: data.summary.pending ? 'warning' : 'success' },
                            ]}
                        />

                        <SectionTitle title="Asked to join" caption="Confirm the day, then give coaching feedback" />
                        {data.withMe.length ? (
                            <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(2) }}>
                                {data.withMe.map((row, i) => (
                                    <View key={row.JointWorkId} style={[styles.row, i > 0 && styles.line]}>
                                        <ListRow
                                            icon="user"
                                            title={person(row.UserName, row.UserDesignation)}
                                            caption={`${dayLabel(row.WorkDate)} · ${row.JointCalls} joint call${row.JointCalls === 1 ? '' : 's'}`}
                                            right={<Tag label={STATUS[row.Status]?.label || row.Status} tone={STATUS[row.Status]?.tone} />}
                                            chevron={false}
                                        />
                                        {row.Rating ? <Text style={styles.feedback}>{`${stars(row.Rating)}${row.CoachingNotes ? `  “${row.CoachingNotes}”` : ''}`}</Text> : null}
                                        {row.Status === 'PENDING' && row.canRespond ? (
                                            <View style={styles.actions}>
                                                <Button title="Decline" small variant="outline" onPress={() => act(() => api.post(`/app/joint-work/${row.JointWorkId}/respond`, { Accept: false }))} style={{ flex: 1 }} />
                                                <Button title="Confirm" small icon="check" onPress={() => act(() => api.post(`/app/joint-work/${row.JointWorkId}/respond`, { Accept: true }))} style={{ flex: 1 }} />
                                            </View>
                                        ) : null}
                                        {row.canGiveFeedback ? (
                                            <View style={styles.actions}>
                                                <Button title={row.FeedbackOn ? 'Edit feedback' : 'Give feedback'} small variant="outline" icon="award" onPress={() => { setRating(row.Rating || 4); setFeedbackFor(row); }} style={{ flex: 1 }} />
                                            </View>
                                        ) : null}
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <Card style={{ marginBottom: space(2) }}>
                                <Empty icon="users" title="No requests this month" />
                            </Card>
                        )}

                        <SectionTitle title="My joint work" caption="Days I asked colleagues to join" />
                        {data.asked.length ? (
                            <Card style={{ padding: 0, overflow: 'hidden' }}>
                                {data.asked.map((row, i) => (
                                    <View key={row.JointWorkId} style={[styles.row, i > 0 && styles.line]}>
                                        <ListRow
                                            icon="users"
                                            title={person(row.ColleagueName, row.ColleagueDesignation)}
                                            caption={`${dayLabel(row.WorkDate)} · ${row.JointCalls} joint call${row.JointCalls === 1 ? '' : 's'}${row.ResponseNote ? ` · “${row.ResponseNote}”` : ''}`}
                                            right={<Tag label={STATUS[row.Status]?.label || row.Status} tone={STATUS[row.Status]?.tone} />}
                                            chevron={false}
                                        />
                                        {row.Rating ? <Text style={styles.feedback}>{`Coaching: ${stars(row.Rating)}${row.CoachingNotes ? `  “${row.CoachingNotes}”` : ''}`}</Text> : null}
                                        {row.canCancel ? (
                                            <View style={styles.actions}>
                                                <Button title="Cancel request" small variant="ghost" onPress={() => act(() => api.delete(`/app/joint-work/${row.JointWorkId}`))} style={{ flex: 1 }} />
                                            </View>
                                        ) : null}
                                    </View>
                                ))}
                            </Card>
                        ) : (
                            <Card>
                                <Empty icon="calendar" title="No joint work asked this month" caption="Ask your manager above to plan a day together." />
                            </Card>
                        )}
                    </>
                )}
            </Loadable>

            <ReasonDialog
                visible={Boolean(feedbackFor)}
                title={feedbackFor ? `Coaching for ${titleCase(feedbackFor.UserName)}` : ''}
                caption={feedbackFor ? `${dayLabel(feedbackFor.WorkDate)} · ${feedbackFor.JointCalls} joint calls. ${feedbackFor.UserName ? titleCase(feedbackFor.UserName) : 'They'} will see this feedback.` : ''}
                label="Coaching notes (detailing, product knowledge, doctor rapport)"
                minLength={0}
                submitLabel="Save feedback"
                onSubmit={async (notes) => {
                    if (await act(() => api.post(`/app/joint-work/${feedbackFor.JointWorkId}/feedback`, { Rating: rating, Notes: notes }))) setFeedbackFor(null);
                }}
                onClose={() => setFeedbackFor(null)}
            >
                <Text style={[text.small, { marginBottom: space(1) }]}>Overall rating</Text>
                <Chips options={[1, 2, 3, 4, 5].map((n) => ({ value: n, label: `${n} ★` }))} value={rating} onChange={setRating} />
            </ReasonDialog>
        </Screen>
    );
}

const styles = StyleSheet.create({
    row: { paddingBottom: space(1) },
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
    actions: { flexDirection: 'row', gap: space(1), paddingHorizontal: space(1.5) },
    feedback: { ...text.small, color: colors.ink, paddingHorizontal: space(1.5), marginBottom: space(1) },
});
