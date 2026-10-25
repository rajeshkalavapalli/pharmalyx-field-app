import { useCallback, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';

import { currentSession } from '../api';
import { useAttention } from '../attention';
import { titleCase } from '../format';
import { visibleSections } from '../menu';
import { usePermissions } from '../permissions';
import { colors, fonts, gradients, radius, shadow, space, text, tileTones } from '../theme';
import { Empty, Screen, Skeleton } from '../ui';
import { BUILT } from './registry';

const MAX_TILES = 8; // more than this: 7 tiles + "More"

const open = (navigation, item) => navigation.navigate(item.screen, { ...(item.params || {}), title: item.label });

// One rounded icon tile with its label (max 2 lines) and an optional count badge.
export function Tile({ icon, label, tone = 'teal', badge, onPress }) {
    const t = tileTones[tone] || tileTones.teal;
    return (
        <Pressable onPress={onPress} style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]} accessibilityRole="button" accessibilityLabel={badge ? `${label}, ${badge} need attention` : label}>
            <View style={[styles.tileIcon, { backgroundColor: t.bg }]}>
                <Feather name={icon} size={24} color={t.fg} />
                {badge ? (
                    <View style={styles.badge}>
                        <Text style={styles.badgeText}>{badge > 99 ? '99+' : badge}</Text>
                    </View>
                ) : null}
            </View>
            <Text style={styles.tileLabel} numberOfLines={2}>
                {label}
            </Text>
        </Pressable>
    );
}

// A white section block: title, "See all", 4-column grid.
export function SectionGrid({ section, badges, navigation, limit = MAX_TILES }) {
    const overflow = section.items.length > limit;
    const items = overflow ? section.items.slice(0, limit - 1) : section.items;
    return (
        <View style={styles.section}>
            <View style={styles.sectionHead}>
                <Text style={styles.sectionTitle}>{section.title}</Text>
                {overflow ? (
                    <Pressable onPress={() => navigation.navigate('MenuSection', { title: section.title })} hitSlop={10} style={styles.seeAll} accessibilityRole="button">
                        <Text style={styles.seeAllText}>See all</Text>
                        <Feather name="chevron-right" size={16} color={colors.jade} />
                    </Pressable>
                ) : null}
            </View>
            <View style={styles.grid}>
                {items.map((item) => (
                    <Tile key={`${item.screen}-${item.label}`} icon={item.icon} label={item.label} tone={section.tone} badge={item.badge ? badges[item.badge] : 0} onPress={() => open(navigation, item)} />
                ))}
                {overflow ? <Tile icon="grid" label="More" tone={section.tone} onPress={() => navigation.navigate('MenuSection', { title: section.title })} /> : null}
            </View>
        </View>
    );
}

function GridSkeleton() {
    return [0, 1, 2].map((s) => (
        <View key={s} style={styles.section}>
            <Skeleton width={120} height={16} style={{ marginBottom: space(2) }} />
            <View style={styles.grid}>
                {[0, 1, 2, 3].map((i) => (
                    <View key={i} style={styles.tile}>
                        <Skeleton width={56} height={56} radius={16} />
                        <Skeleton width={48} height={10} style={{ marginTop: 8 }} />
                    </View>
                ))}
            </View>
        </View>
    ));
}

const HIGHLIGHT_TONE = { primary: tileTones.teal, success: tileTones.green, warning: tileTones.orange, info: tileTones.blue, error: { bg: colors.errorSoft, fg: colors.errorDark } };

function HelpSheet({ visible, onClose }) {
    const tips = [
        ['sun', 'Start your day in My Day. It checks you in and records your location trail for TA.'],
        ['map-pin', 'Tap the round Check in button at a clinic. Stay a few minutes so the visit counts in full.'],
        ['bell', 'Alerts shows what needs you: approvals, TA/DA days on hold, doctors to verify.'],
        ['search', 'Search above finds any screen by name.'],
        ['life-buoy', 'Forgot your password or missing a screen? Ask your administrator.'],
    ];
    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <Pressable style={styles.backdrop} onPress={onClose} />
            <View style={styles.sheet}>
                <View style={styles.sheetHead}>
                    <Text style={[text.title, { flex: 1 }]}>Help</Text>
                    <Pressable onPress={onClose} hitSlop={10} accessibilityLabel="Close">
                        <Feather name="x" size={20} color={colors.inkMuted} />
                    </Pressable>
                </View>
                {tips.map(([icon, tip]) => (
                    <View key={icon} style={styles.tip}>
                        <Feather name={icon} size={18} color={colors.jade} />
                        <Text style={[text.body, { flex: 1 }]}>{tip}</Text>
                    </View>
                ))}
            </View>
        </Modal>
    );
}

// Home: profile header, search, live highlights, and every screen the role allows as icon grids.
export default function Menu({ navigation }) {
    const permissions = usePermissions();
    const attention = useAttention();
    const [query, setQuery] = useState('');
    const [help, setHelp] = useState(false);
    const user = currentSession()?.user;
    const name = titleCase(user?.Name || user?.UserName || '');
    const role = user?.DesignationName || user?.organisation?.Name || '';

    useFocusEffect(
        useCallback(() => {
            attention.reload();
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [])
    );

    const sections = useMemo(() => (permissions.codes ? visibleSections(permissions, BUILT) : null), [permissions]);
    const q = query.trim().toLowerCase();
    const results = useMemo(() => {
        if (!sections || !q) return null;
        const items = sections.flatMap((s) => s.items.map((i) => ({ ...i, tone: s.tone, section: s.title })));
        return items.filter((i) => `${i.label} ${i.section}`.toLowerCase().includes(q));
    }, [sections, q]);

    return (
        <Screen>
            <View style={styles.header}>
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.avatar}>
                    <Text style={styles.avatarText}>{name.charAt(0) || '?'}</Text>
                </LinearGradient>
                <Pressable style={{ flex: 1, minWidth: 0 }} onPress={() => navigation.navigate('Me')} accessibilityRole="button" accessibilityLabel="My profile">
                    <Text style={styles.name} numberOfLines={1}>
                        {name}
                    </Text>
                    <Text style={text.small} numberOfLines={1}>
                        {[user?.UserName, role].filter(Boolean).join(' · ')}
                    </Text>
                </Pressable>
                <Pressable onPress={() => navigation.navigate('Alerts')} hitSlop={8} style={styles.iconButton} accessibilityLabel={`Alerts${attention.unseen ? `, ${attention.unseen} unread` : ''}`}>
                    <Feather name="bell" size={20} color={colors.inkSoft} />
                    {attention.unseen ? <View style={styles.dot}><Text style={styles.dotText}>{attention.unseen > 9 ? '9+' : attention.unseen}</Text></View> : null}
                </Pressable>
                <Pressable onPress={() => setHelp(true)} hitSlop={8} style={styles.iconButton} accessibilityLabel="Help">
                    <Feather name="help-circle" size={20} color={colors.inkSoft} />
                </Pressable>
            </View>

            <View style={styles.search}>
                <Feather name="search" size={17} color={colors.inkMuted} />
                <TextInput style={styles.searchInput} value={query} onChangeText={setQuery} placeholder="Search features" placeholderTextColor={colors.inkFaint} autoCorrect={false} autoCapitalize="none" returnKeyType="search" />
                {query ? (
                    <Pressable onPress={() => setQuery('')} hitSlop={10} accessibilityLabel="Clear search">
                        <Feather name="x-circle" size={17} color={colors.inkFaint} />
                    </Pressable>
                ) : null}
            </View>

            {!q && attention.highlights.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip} style={styles.stripWrap}>
                    {attention.highlights.map((h) => {
                        const t = HIGHLIGHT_TONE[h.tone] || tileTones.teal;
                        return (
                            <Pressable key={h.key} onPress={() => navigation.navigate(h.screen, h.params || {})} style={({ pressed }) => [styles.highlight, { backgroundColor: t.bg }, pressed && styles.tilePressed]} accessibilityRole="button">
                                <Feather name={h.icon} size={16} color={t.fg} />
                                <Text style={[styles.highlightText, { color: t.fg }]} numberOfLines={1}>
                                    {h.text}
                                </Text>
                                <Feather name="chevron-right" size={15} color={t.fg} />
                            </Pressable>
                        );
                    })}
                </ScrollView>
            ) : null}

            {!sections ? (
                <GridSkeleton />
            ) : results ? (
                results.length ? (
                    <View style={styles.section}>
                        <Text style={[styles.sectionTitle, { marginBottom: space(1.75) }]}>{`${results.length} result${results.length === 1 ? '' : 's'}`}</Text>
                        <View style={styles.grid}>
                            {results.map((item) => (
                                <Tile key={`${item.screen}-${item.label}`} icon={item.icon} label={item.label} tone={item.tone} badge={item.badge ? attention.badges[item.badge] : 0} onPress={() => open(navigation, item)} />
                            ))}
                        </View>
                    </View>
                ) : (
                    <Empty icon="search" title="No feature matches" caption="Try another word, like “visit”, “leave” or “report”." />
                )
            ) : sections.length ? (
                sections.map((section) => <SectionGrid key={section.title} section={section} badges={attention.badges} navigation={navigation} />)
            ) : (
                <Empty icon="lock" title="Nothing to show for your role" caption="Ask your administrator to check your role in Roles & Permissions." />
            )}
            <HelpSheet visible={help} onClose={() => setHelp(false)} />
        </Screen>
    );
}

// "See all": every tile of one section.
export function MenuSection({ navigation, route }) {
    const permissions = usePermissions();
    const attention = useAttention();
    const section = useMemo(() => (permissions.codes ? visibleSections(permissions, BUILT).find((s) => s.title === route.params?.title) : null), [permissions, route.params?.title]);
    return (
        <Screen>
            <View style={styles.header}>
                <Pressable onPress={() => navigation.goBack()} hitSlop={10} style={styles.iconButton} accessibilityLabel="Back">
                    <Feather name="arrow-left" size={18} color={colors.inkSoft} />
                </Pressable>
                <Text style={[text.display, { flex: 1 }]}>{route.params?.title}</Text>
            </View>
            {section ? <SectionGrid section={section} badges={attention.badges} navigation={navigation} limit={999} /> : <GridSkeleton />}
        </Screen>
    );
}

const styles = StyleSheet.create({
    header: { flexDirection: 'row', alignItems: 'center', gap: space(1.25), marginBottom: space(2) },
    avatar: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', ...shadow.glow },
    avatarText: { fontFamily: fonts.heavy, fontSize: 19, color: colors.white },
    name: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
    iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
    dot: { position: 'absolute', top: -3, right: -3, minWidth: 18, height: 18, paddingHorizontal: 4, borderRadius: 9, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.bg },
    dotText: { fontFamily: fonts.bold, fontSize: 10, color: colors.white },
    search: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.pill, paddingHorizontal: 16, minHeight: 48, marginBottom: space(1.5) },
    searchInput: { flex: 1, fontFamily: fonts.medium, fontSize: 14.5, color: colors.ink, paddingVertical: 10 },
    stripWrap: { marginHorizontal: -space(2.5), marginBottom: space(1.5) },
    strip: { gap: space(1), paddingHorizontal: space(2.5) },
    highlight: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radius.pill, maxWidth: 280 },
    highlightText: { fontFamily: fonts.semibold, fontSize: 13, flexShrink: 1 },
    section: { backgroundColor: colors.paper, borderRadius: radius.xl, paddingHorizontal: space(1.25), paddingTop: space(2), paddingBottom: space(1), marginBottom: space(1.5), borderWidth: 1, borderColor: colors.lineSoft },
    sectionHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5), paddingHorizontal: space(0.75) },
    sectionTitle: { flex: 1, fontFamily: fonts.semibold, fontSize: 17, color: colors.ink, paddingHorizontal: space(0.75) },
    seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
    seeAllText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.jade },
    grid: { flexDirection: 'row', flexWrap: 'wrap' },
    tile: { width: '25%', alignItems: 'center', paddingHorizontal: 2, marginBottom: space(1.75) },
    tilePressed: { opacity: 0.7, transform: [{ scale: 0.94 }] },
    tileIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
    tileLabel: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 15, color: colors.inkSoft, textAlign: 'center', marginTop: 7 },
    badge: { position: 'absolute', top: -5, right: -7, minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: colors.error, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.paper },
    badgeText: { fontFamily: fonts.bold, fontSize: 10.5, color: colors.white },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4) },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
    tip: { flexDirection: 'row', alignItems: 'flex-start', gap: space(1.5), paddingVertical: space(1) },
});

