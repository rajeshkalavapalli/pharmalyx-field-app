import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';

import { api, errorMessage } from '../api';
import { titleCase } from '../format';
import { colors, fonts, space, text } from '../theme';
import { toast } from '../toast';
import useLoad from '../useLoad';
import { Button, Card, Chips, Empty, Header, Loadable, ReasonDialog, Screen, Tag } from '../ui';

// Where a non-inline item opens in the app (same targets as the web links).
const OPEN = {
    DOCTOR_REQUEST: (item) => ['RequestDetail', { requestId: item.id }],
    DOCTOR_VERIFICATION: (item) => ['VerificationDetail', { verificationId: item.id }],
    POB_FOLLOW_UP: () => ['Orders', { scope: 'team' }],
    STP: () => ['Stp', {}],
    STATEMENT: () => ['Secondary', {}],
    DOCTOR_PLAN: () => ['DoctorPlan', {}],
    CLAIM: () => ['Claims', { tab: 'reviews' }],
    PAYMENT: () => ['Payments', {}],
    DAY_REVIEW_MANAGER: () => ['Claims', { tab: 'days' }],
    DAY_REVIEW_ADMIN: () => ['Claims', { tab: 'days' }],
    TOUR_PLAN: () => ['TourPlan', { team: true }],
    DEVIATION: () => ['Deviations', {}],
    DCR: () => ['Dcr', { tab: 'reviews' }],
    LEAVE: () => ['Leave', {}],
    VISIT_EXPLANATION: () => ['Visits', {}],
};
// Types whose decision needs a comment both ways (the module's own rule).
const COMMENT_BOTH_WAYS = new Set(['DAY_REVIEW_MANAGER', 'DAY_REVIEW_ADMIN']);

const age = (days) => (days == null ? '' : days === 0 ? 'today' : `${days} day${days === 1 ? '' : 's'} ago`);

// Everything waiting for my decision, oldest first. Simple items are decided here; others open their screen.
export default function Approvals({ navigation }) {
    const state = useLoad(async () => (await api.get('/app/approvals')).data, [], "Couldn't load approvals.");
    const [type, setType] = useState('ALL');
    const [deciding, setDeciding] = useState(null); // { item, decision: 'approve' | 'return' | 'grant' }

    const decide = async (remarks) => {
        const { item, decision } = deciding;
        try {
            let response;
            if (decision === 'grant') {
                response = (await api.post(`/app/expenses/day-reviews/${item.id}/admin-approve`, { Comment: remarks, GrantDa: true })).data;
            } else {
                response = (await api.post(`/app/approvals/${item.type}/${item.id}/${decision}`, { Remarks: remarks || null })).data;
            }
            toast(response?.message || 'Done');
            setDeciding(null);
            state.reload();
        } catch (err) {
            toast(errorMessage(err), 'error');
        }
    };

    const open = (item) => {
        const target = OPEN[item.type]?.(item);
        if (target) navigation.navigate(...target);
    };

    const data = state.data;
    const filters = data ? [{ value: 'ALL', label: `All ${data.total}` }, ...data.types.filter((t) => t.count).map((t) => ({ value: t.type, label: `${t.label} ${t.count}` }))] : [];
    const items = data ? data.items.filter((i) => type === 'ALL' || i.type === type) : [];
    const needsComment = deciding && (deciding.decision !== 'approve' || COMMENT_BOTH_WAYS.has(deciding.item.type));

    return (
        <Screen refreshControl={state.refreshControl}>
            <Header overline="Approvals" title={data ? (data.total ? `${data.total} waiting` : 'All clear') : 'Inbox'} onBack={navigation.canGoBack() ? () => navigation.goBack() : undefined} />
            {data?.overdue ? <Text style={[text.small, { color: colors.warningDark, marginTop: -space(1.5), marginBottom: space(1.5) }]}>{`${data.overdue} waiting more than ${data.overdueDays} days`}</Text> : null}
            {filters.length > 2 ? <Chips options={filters} value={type} onChange={setType} /> : null}

            <Loadable state={state} rows={5}>
                {() =>
                    items.length ? (
                        <View style={{ gap: space(1.25) }}>
                            {items.map((item) => (
                                <Card key={item.key} style={{ padding: space(1.5) }}>
                                    <Pressable onPress={() => open(item)} disabled={!OPEN[item.type]} accessibilityRole="button">
                                        <View style={styles.top}>
                                            <Tag label={item.typeLabel} tone="primary" />
                                            {item.overdue ? <Tag label="Overdue" tone="warning" /> : null}
                                            <Text style={[text.small, { marginLeft: 'auto' }]}>{age(item.ageDays)}</Text>
                                        </View>
                                        <Text style={[text.subtitle, { marginTop: 6 }]}>{titleCase(item.userName)}</Text>
                                        <Text style={styles.period}>{item.period}</Text>
                                        {item.summary ? (
                                            <Text style={text.small} numberOfLines={4}>
                                                {item.summary}
                                            </Text>
                                        ) : null}
                                    </Pressable>
                                    {item.inline ? (
                                        <View style={styles.actions}>
                                            <Button title={item.returnLabel} small variant="danger" onPress={() => setDeciding({ item, decision: 'return' })} style={{ flex: 1 }} />
                                            <Button title={item.type === 'DAY_REVIEW_ADMIN' ? 'Payable' : 'Approve'} small icon="check" onPress={() => setDeciding({ item, decision: 'approve' })} style={{ flex: 1 }} />
                                        </View>
                                    ) : (
                                        <Button title="Review" small variant="outline" icon="arrow-right" onPress={() => open(item)} style={{ marginTop: space(1.25) }} />
                                    )}
                                    {item.type === 'DAY_REVIEW_ADMIN' ? (
                                        <Pressable onPress={() => setDeciding({ item, decision: 'grant' })} style={styles.grant} accessibilityRole="button">
                                            <Feather name="gift" size={14} color={colors.jadeDark} />
                                            <Text style={styles.grantText}>Payable and grant DA (special case)</Text>
                                        </Pressable>
                                    ) : null}
                                </Card>
                            ))}
                        </View>
                    ) : (
                        <Card>
                            <Empty icon="check-circle" title="Nothing waiting for you" caption="Tour plans, DCRs, leave, doctor requests, claims and TA / DA reviews from your team appear here." />
                        </Card>
                    )
                }
            </Loadable>

            <ReasonDialog
                visible={Boolean(deciding)}
                title={deciding ? (deciding.decision === 'grant' ? 'Payable, with DA granted' : deciding.decision === 'approve' ? (deciding.item.type === 'DAY_REVIEW_ADMIN' ? 'Make this day payable?' : 'Approve?') : `${deciding.item.returnLabel}?`) : ''}
                caption={deciding ? `${titleCase(deciding.item.userName)} · ${deciding.item.period}` : ''}
                label={needsComment ? 'Comment' : 'Comment (optional)'}
                minLength={needsComment ? 3 : 0}
                submitLabel={deciding ? (deciding.decision === 'grant' ? 'Grant DA' : deciding.decision === 'approve' ? (deciding.item.type === 'DAY_REVIEW_ADMIN' ? 'Payable' : 'Approve') : deciding.item.returnLabel) : ''}
                onSubmit={decide}
                onClose={() => setDeciding(null)}
            />
        </Screen>
    );
}

const styles = StyleSheet.create({
    top: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    period: { fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft, marginTop: 2, marginBottom: 4 },
    actions: { flexDirection: 'row', gap: space(1), marginTop: space(1.25) },
    grant: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', marginTop: space(1) },
    grantText: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.jadeDark },
});
