import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { useAttention } from '../attention';
import { colors, space, text } from '../theme';
import { Button, Card, Empty, Header, ListRow, Screen, SectionTitle, SkeletonList } from '../ui';

const ORDER = ['Waiting for you', 'Your day', 'Doctors', 'Planning', 'Risk alerts'];

// Everything that needs the person's attention, grouped; opening the tab marks them as read.
export default function Alerts({ navigation }) {
    const attention = useAttention();

    useFocusEffect(
        useCallback(() => {
            attention.reload();
            // Mark as read when leaving the tab, so the dots stay visible while reading.
            return () => attention.markSeen();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])
    );

    const groups = ORDER.map((g) => ({ title: g, items: attention.alerts.filter((a) => a.group === g) })).filter((g) => g.items.length);

    return (
        <Screen>
            <Header overline="Alerts" title={attention.unseen ? `${attention.unseen} new` : 'All caught up'} right={attention.unseen ? <Button title="Mark read" small variant="ghost" onPress={attention.markSeen} /> : null} />
            {!attention.ready ? (
                <SkeletonList rows={5} />
            ) : groups.length ? (
                groups.map((g) => (
                    <View key={g.title}>
                        <SectionTitle title={g.title} />
                        <Card style={{ padding: 0, overflow: 'hidden', marginBottom: space(1) }}>
                            {g.items.map((a, i) => (
                                <View key={a.key} style={[i > 0 && styles.line, a.unread && styles.unread]}>
                                    <ListRow icon={a.icon} tone={a.tone === 'info' ? 'info' : a.tone} title={a.title} caption={a.caption} onPress={() => navigation.navigate(a.screen, a.params || {})} right={a.unread ? <View style={styles.dot} /> : null} />
                                </View>
                            ))}
                        </Card>
                    </View>
                ))
            ) : (
                <Card>
                    <Empty icon="bell" title="Nothing needs you right now" caption="Approvals, TA/DA days on hold, doctors to verify and plans due will show up here." />
                </Card>
            )}
            <Text style={[text.small, { textAlign: 'center', marginTop: space(2) }]}>Updated every few minutes and whenever you open Home or Alerts.</Text>
        </Screen>
    );
}

const styles = StyleSheet.create({
    line: { borderTopWidth: 1, borderTopColor: colors.lineSoft },
    unread: { backgroundColor: colors.jadeWash },
    dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.jade },
});
