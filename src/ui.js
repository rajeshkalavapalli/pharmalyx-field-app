import { forwardRef, useEffect, useState } from 'react';
import { useNetInfo } from '@react-native-community/netinfo';
import { ActivityIndicator, Animated, FlatList, KeyboardAvoidingView, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { colors, fonts, gradients, radius, shadow, space, text, tones } from './theme';

// Page with the brand background; scrolls, supports pull-to-refresh, and lifts above the keyboard
// (padding on Android too: the app draws edge-to-edge, so the window doesn't shrink for the keyboard).
export function Screen({ children, refreshControl, padded = true, footer }) {
    return (
        <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
            <OfflineBanner />
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <ScrollView contentContainerStyle={padded && styles.page} refreshControl={refreshControl} keyboardShouldPersistTaps="handled" keyboardDismissMode="none">
                    {children}
                </ScrollView>
                {footer ? <View style={styles.footer}>{footer}</View> : null}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

// Thin bar shown on every screen while the phone has no internet.
export function OfflineBanner() {
    const net = useNetInfo();
    if (net.isConnected !== false) return null;
    return (
        <View style={styles.offline} accessibilityLiveRegion="polite">
            <Feather name="wifi-off" size={14} color={colors.white} />
            <Text style={styles.offlineText}>{"You're offline. Changes can't be sent until you reconnect."}</Text>
        </View>
    );
}

// Grey placeholder that pulses while content loads.
export function Skeleton({ width = '100%', height = 14, radius: r = 6, style }) {
    const [pulse] = useState(() => new Animated.Value(0.5));
    useEffect(() => {
        const loop = Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 650, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0.5, duration: 650, useNativeDriver: true }),
            ])
        );
        loop.start();
        return () => loop.stop();
    }, [pulse]);
    return <Animated.View style={[{ width, height, borderRadius: r, backgroundColor: colors.lineSoft, opacity: pulse }, style]} />;
}

// A few card-shaped skeletons for a loading list.
export function SkeletonList({ rows = 4, style }) {
    return (
        <View style={[{ gap: space(1.25) }, style]}>
            {Array.from({ length: rows }, (_, i) => (
                <View key={i} style={[styles.card, styles.skeletonRow]}>
                    <Skeleton width={42} height={42} radius={21} />
                    <View style={{ flex: 1, gap: 8 }}>
                        <Skeleton width="65%" height={14} />
                        <Skeleton width="40%" height={11} />
                    </View>
                </View>
            ))}
        </View>
    );
}

// A load that failed: what happened and a retry.
export function ErrorState({ message, onRetry }) {
    return (
        <View style={styles.empty}>
            <Feather name="cloud-off" size={26} color={colors.errorDark} />
            <Text style={[text.subtitle, { marginTop: space(1), textAlign: 'center' }]}>{message || 'Something went wrong.'}</Text>
            {onRetry ? <Button title="Try again" icon="refresh-cw" variant="outline" small onPress={onRetry} style={{ marginTop: space(1.5) }} /> : null}
        </View>
    );
}

// Shows skeletons while loading, an error with retry if nothing loaded, otherwise the content.
// state comes from useLoad(). children may be a function of data.
export function Loadable({ state, rows = 4, children }) {
    if (state.error && !state.data) return <ErrorState message={state.error} onRetry={state.reload} />;
    if (!state.data) return <SkeletonList rows={rows} />;
    return (
        <>
            {state.error ? <Text style={[text.small, { color: colors.errorDark, marginBottom: space(1) }]}>{state.error} Showing the last loaded data.</Text> : null}
            {typeof children === 'function' ? children(state.data) : children}
        </>
    );
}

const shiftMonthKey = (key, by) => {
    const [y, m] = key.split('-').map(Number);
    const d = new Date(y, m - 1 + by, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const currentMonthKey = () => shiftMonthKey(`${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`, 0);

// "‹  October 2026  ›" (no going past the current month unless allowFuture).
export function MonthSwitcher({ value, onChange, allowFuture }) {
    const atNow = !allowFuture && value >= currentMonthKey();
    return (
        <View style={styles.monthSwitch}>
            <Pressable onPress={() => onChange(shiftMonthKey(value, -1))} hitSlop={8} style={styles.monthArrow} accessibilityLabel="Previous month">
                <Feather name="chevron-left" size={18} color={colors.jadeDark} />
            </Pressable>
            <Text style={[text.subtitle, { flex: 1, textAlign: 'center' }]}>{new Date(`${value}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}</Text>
            <Pressable onPress={() => !atNow && onChange(shiftMonthKey(value, 1))} disabled={atNow} hitSlop={8} style={[styles.monthArrow, atNow && { opacity: 0.35 }]} accessibilityLabel="Next month">
                <Feather name="chevron-right" size={18} color={colors.jadeDark} />
            </Pressable>
        </View>
    );
}

// Label / value rows inside a card.
export function KeyValue({ rows }) {
    return (
        <View>
            {rows.filter(Boolean).map(([label, value], i) => (
                <View key={label} style={[styles.kvRow, i > 0 && { borderTopWidth: 1, borderTopColor: colors.lineSoft }]}>
                    <Text style={[text.small, { flex: 1 }]}>{label}</Text>
                    <Text style={[text.subtitle, { fontSize: 14, flexShrink: 1, textAlign: 'right' }]}>{value ?? '—'}</Text>
                </View>
            ))}
        </View>
    );
}

// Two-column grid of StatTiles: items = [{ icon, label, value, caption, tone }]
export function StatGrid({ items }) {
    const list = items.filter(Boolean);
    const rows = [];
    for (let i = 0; i < list.length; i += 2) rows.push(list.slice(i, i + 2));
    return (
        <View style={{ gap: space(1.5), marginBottom: space(1.5) }}>
            {rows.map((pair, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: space(1.5) }}>
                    {pair.map((item) => (
                        <StatTile key={item.label} {...item} />
                    ))}
                    {pair.length === 1 ? <View style={{ flex: 1 }} /> : null}
                </View>
            ))}
        </View>
    );
}

// Simple vertical bar chart: data = [{ label, value, secondary? }]. Shows an empty message when all are 0.
export function MiniBars({ data, height = 110, emptyText = 'Nothing recorded in this period yet.' }) {
    const max = Math.max(1, ...data.map((d) => Math.max(d.value || 0, d.secondary || 0)));
    if (!data.some((d) => d.value || d.secondary)) return <Text style={[text.small, { paddingVertical: space(3), textAlign: 'center' }]}>{emptyText}</Text>;
    return (
        <View>
            <View style={[styles.bars, { height }]}>
                {data.map((d, i) => (
                    <View key={i} style={styles.barSlot}>
                        {d.secondary != null ? <View style={[styles.barGhost, { height: `${(d.secondary / max) * 100}%` }]} /> : null}
                        <LinearGradient colors={gradients.brand} style={[styles.bar, { height: `${Math.max(2, ((d.value || 0) / max) * 100)}%` }]} />
                    </View>
                ))}
            </View>
            <View style={styles.barLabels}>
                {data.map((d, i) => (
                    <Text key={i} style={styles.barLabel} numberOfLines={1}>
                        {d.label}
                    </Text>
                ))}
            </View>
        </View>
    );
}

// Tappable row used in menus and lists: icon, title, caption, right-side content, chevron.
export function ListRow({ icon, title, caption, right, onPress, tone = 'primary', chevron = true }) {
    const t = tones[tone] || tones.primary;
    return (
        <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.listRow, pressed && { backgroundColor: colors.jadeWash }]} accessibilityRole={onPress ? 'button' : undefined}>
            {icon ? (
                <View style={[styles.listIcon, { backgroundColor: t.bg }]}>
                    <Feather name={icon} size={17} color={t.fg} />
                </View>
            ) : null}
            <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={text.subtitle} numberOfLines={1}>
                    {title}
                </Text>
                {caption ? (
                    <Text style={text.small} numberOfLines={2}>
                        {caption}
                    </Text>
                ) : null}
            </View>
            {right}
            {onPress && chevron ? <Feather name="chevron-right" size={18} color={colors.inkFaint} /> : null}
        </Pressable>
    );
}

// Horizontal progress bar, value 0..1.
export function ProgressBar({ value, tone = 'brand', height = 8 }) {
    const pct = Math.max(0, Math.min(1, Number(value) || 0));
    return (
        <View style={[styles.track, { height, borderRadius: height / 2 }]}>
            <LinearGradient colors={gradients[tone] || gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${pct * 100}%`, height, borderRadius: height / 2 }} />
        </View>
    );
}

// Inline message under a form field.
export function FieldError({ children }) {
    if (!children) return null;
    return (
        <View style={styles.fieldError}>
            <Feather name="alert-circle" size={13} color={colors.errorDark} />
            <Text style={[text.small, { color: colors.errorDark, flex: 1 }]}>{children}</Text>
        </View>
    );
}

export function Card({ children, style }) {
    return <View style={[styles.card, style]}>{children}</View>;
}

// variant: primary (brand gradient) | outline | ghost | danger
export function Button({ title, onPress, variant = 'primary', icon, busy, disabled, small, style }) {
    const off = disabled || busy;
    const content = (
        <View style={[styles.buttonInner, small && styles.buttonSmall]}>
            {busy ? (
                <ActivityIndicator color={variant === 'primary' ? colors.white : colors.jade} />
            ) : (
                <>
                    {icon && <Feather name={icon} size={small ? 15 : 17} color={variant === 'primary' ? colors.white : variant === 'danger' ? colors.errorDark : colors.jadeDark} />}
                    <Text style={[styles.buttonText, small && styles.buttonTextSmall, variant !== 'primary' && { color: variant === 'danger' ? colors.errorDark : colors.jadeDark }]}>{title}</Text>
                </>
            )}
        </View>
    );

    return (
        <Pressable onPress={onPress} disabled={off} style={({ pressed }) => [{ opacity: off ? 0.55 : pressed ? 0.85 : 1 }, style]} accessibilityRole="button" accessibilityLabel={title}>
            {variant === 'primary' ? (
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.button, shadow.glow]}>
                    {content}
                </LinearGradient>
            ) : (
                <View style={[styles.button, variant === 'outline' && styles.outline, variant === 'danger' && styles.danger]}>{content}</View>
            )}
        </Pressable>
    );
}

// Text input with a label above; `secure` adds a show / hide eye.
// Nothing changes on focus: re-rendering while the keyboard opens can move focus between inputs on Android.
export const Field = forwardRef(function Field(
    { label, value, onChangeText, secure, icon, multiline, placeholder, autoFocus, keyboardType, autoCapitalize = 'none', returnKeyType, onSubmitEditing, textContentType, autoComplete, onFocus, onBlur, error, hint },
    ref
) {
    const [hidden, setHidden] = useState(Boolean(secure));
    return (
        <View style={{ marginBottom: space(2) }}>
            <Text style={styles.label}>{label}</Text>
            <View style={[styles.field, error && { borderColor: colors.error }, multiline && { alignItems: 'flex-start' }]}>
                {icon && <Feather name={icon} size={17} color={colors.inkMuted} style={{ marginRight: 10, marginTop: multiline ? 12 : 0 }} />}
                <TextInput
                    ref={ref}
                    style={[styles.input, multiline && { minHeight: 84, textAlignVertical: 'top', paddingTop: 12 }]}
                    value={value}
                    onChangeText={onChangeText}
                    secureTextEntry={hidden}
                    placeholder={placeholder}
                    placeholderTextColor={colors.inkFaint}
                    autoFocus={autoFocus}
                    autoCapitalize={autoCapitalize}
                    autoCorrect={false}
                    keyboardType={keyboardType}
                    multiline={multiline}
                    returnKeyType={returnKeyType}
                    onSubmitEditing={onSubmitEditing}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    blurOnSubmit={!onSubmitEditing || returnKeyType === 'go' || returnKeyType === 'done'}
                    textContentType={textContentType}
                    autoComplete={autoComplete || 'off'}
                    // Android autofill / password managers can pull focus back and forth between the
                    // username and password fields while the keyboard opens: keep them out of it.
                    importantForAutofill="no"
                    disableFullscreenUI
                />
                {secure && (
                    <Pressable onPress={() => setHidden((h) => !h)} hitSlop={10} accessibilityLabel={hidden ? 'Show password' : 'Hide password'}>
                        <Feather name={hidden ? 'eye' : 'eye-off'} size={18} color={colors.inkMuted} />
                    </Pressable>
                )}
            </View>
            {error ? (
                <Text style={[text.small, { color: colors.errorDark, marginTop: 6 }]}>{error}</Text>
            ) : hint ? (
                <Text style={[text.small, { marginTop: 6 }]}>{hint}</Text>
            ) : null}
        </View>
    );
});

export function Tag({ label, tone = 'neutral', icon }) {
    const t = tones[tone] || tones.neutral;
    return (
        <View style={[styles.tag, { backgroundColor: t.bg }]}>
            {icon && <Feather name={icon} size={11} color={t.fg} />}
            <Text style={[styles.tagText, { color: t.fg }]}>{label}</Text>
        </View>
    );
}

// Small KPI tile with a gradient icon.
export function StatTile({ icon, label, value, caption, tone = 'brand' }) {
    return (
        <View style={[styles.card, styles.stat]}>
            <LinearGradient colors={gradients[tone] || gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.statIcon}>
                <Feather name={icon} size={17} color={colors.white} />
            </LinearGradient>
            <Text style={text.small}>{label}</Text>
            <Text style={text.metric}>{value}</Text>
            {caption ? <Text style={[text.small, { marginTop: 2 }]}>{caption}</Text> : null}
        </View>
    );
}

// Notice box. tone: info | success | warning | error
export function Notice({ tone = 'info', title, children, icon }) {
    const t = tones[tone];
    const iconName = icon || { info: 'info', success: 'check-circle', warning: 'alert-triangle', error: 'alert-octagon' }[tone];
    return (
        <View style={[styles.notice, { backgroundColor: t.bg, borderColor: t.fg + '33' }]}>
            <Feather name={iconName} size={17} color={t.fg} style={{ marginTop: 1 }} />
            <View style={{ flex: 1 }}>
                {title ? <Text style={[text.subtitle, { color: t.fg, fontSize: 14 }]}>{title}</Text> : null}
                {typeof children === 'string' ? <Text style={[text.body, { color: t.fg }]}>{children}</Text> : children}
            </View>
        </View>
    );
}

// Dropdown for phones: a tappable field that opens a searchable list.
// options: [{ value, label, detail? }]
export function Select({ label, value, options, onChange, placeholder = 'Choose', disabled, icon, searchable = options?.length > 8, empty = 'Nothing to choose from yet.' }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const chosen = (options || []).find((option) => option.value === value);
    const q = query.trim().toLowerCase();
    const shown = (options || []).filter((option) => !q || `${option.label} ${option.detail || ''}`.toLowerCase().includes(q));

    const close = () => {
        setOpen(false);
        setQuery('');
    };

    return (
        <View style={{ marginBottom: space(2) }}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <Pressable onPress={() => setOpen(true)} disabled={disabled} style={[styles.field, disabled && { opacity: 0.55 }]} accessibilityRole="button" accessibilityLabel={label}>
                {icon && <Feather name={icon} size={17} color={colors.inkMuted} style={{ marginRight: 10 }} />}
                <Text style={[styles.input, { paddingVertical: 14 }, !chosen && { color: colors.inkFaint }]} numberOfLines={1}>
                    {chosen ? chosen.label : placeholder}
                </Text>
                <Feather name="chevron-down" size={18} color={colors.inkMuted} />
            </Pressable>

            <Modal visible={open} animationType="slide" transparent onRequestClose={close}>
                <Pressable style={styles.backdrop} onPress={close} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHead}>
                        <Text style={[text.title, { flex: 1 }]}>{label || placeholder}</Text>
                        <Pressable onPress={close} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    {searchable && (
                        <View style={[styles.field, { marginBottom: space(1) }]}>
                            <Feather name="search" size={16} color={colors.inkMuted} style={{ marginRight: 10 }} />
                            <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={colors.inkFaint} autoCorrect={false} autoCapitalize="none" />
                        </View>
                    )}
                    <FlatList
                        data={shown}
                        keyExtractor={(item) => String(item.value)}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={<Text style={[text.small, { padding: space(2) }]}>{q ? 'No match.' : empty}</Text>}
                        renderItem={({ item }) => (
                            <Pressable
                                onPress={() => {
                                    onChange(item.value);
                                    close();
                                }}
                                style={({ pressed }) => [styles.option, (pressed || item.value === value) && { backgroundColor: colors.jadeWash }]}
                            >
                                <View style={{ flex: 1 }}>
                                    <Text style={text.subtitle}>{item.label}</Text>
                                    {item.detail ? <Text style={text.small}>{item.detail}</Text> : null}
                                </View>
                                {item.value === value && <Feather name="check" size={18} color={colors.jade} />}
                            </Pressable>
                        )}
                    />
                </View>
            </Modal>
        </View>
    );
}

// Several choices from a searchable list. value: array of option values.
export function MultiSelect({ label, value = [], options, onChange, placeholder = 'Choose', max, empty = 'Nothing to choose from yet.' }) {
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const q = query.trim().toLowerCase();
    const shown = (options || []).filter((o) => !q || `${o.label} ${o.detail || ''}`.toLowerCase().includes(q));
    const names = (options || []).filter((o) => value.includes(o.value)).map((o) => o.label);
    const toggle = (v) => onChange(value.includes(v) ? value.filter((x) => x !== v) : max && value.length >= max ? value : [...value, v]);

    return (
        <View style={{ marginBottom: space(2) }}>
            {label ? <Text style={styles.label}>{label}</Text> : null}
            <Pressable onPress={() => setOpen(true)} style={styles.field} accessibilityRole="button" accessibilityLabel={label}>
                <Text style={[styles.input, { paddingVertical: 14 }, !names.length && { color: colors.inkFaint }]} numberOfLines={1}>
                    {names.length ? names.join(', ') : placeholder}
                </Text>
                <Feather name="chevron-down" size={18} color={colors.inkMuted} />
            </Pressable>
            <Modal visible={open} animationType="slide" transparent onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHead}>
                        <Text style={[text.title, { flex: 1 }]}>{label || placeholder}</Text>
                        <Text style={[text.small, { marginRight: space(1.5) }]}>{max ? `${value.length}/${max}` : `${value.length} chosen`}</Text>
                        <Pressable onPress={() => setOpen(false)} hitSlop={10} accessibilityLabel="Done">
                            <Feather name="check" size={20} color={colors.jade} />
                        </Pressable>
                    </View>
                    {(options || []).length > 8 && (
                        <View style={[styles.field, { marginBottom: space(1) }]}>
                            <Feather name="search" size={16} color={colors.inkMuted} style={{ marginRight: 10 }} />
                            <TextInput style={styles.input} value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={colors.inkFaint} autoCorrect={false} autoCapitalize="none" />
                        </View>
                    )}
                    <FlatList
                        data={shown}
                        keyExtractor={(item) => String(item.value)}
                        keyboardShouldPersistTaps="handled"
                        ListEmptyComponent={<Text style={[text.small, { padding: space(2) }]}>{q ? 'No match.' : empty}</Text>}
                        renderItem={({ item }) => {
                            const on = value.includes(item.value);
                            return (
                                <Pressable onPress={() => toggle(item.value)} style={({ pressed }) => [styles.option, (pressed || on) && { backgroundColor: colors.jadeWash }]} accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                                    <Feather name={on ? 'check-square' : 'square'} size={18} color={on ? colors.jade : colors.inkMuted} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={text.subtitle}>{item.label}</Text>
                                        {item.detail ? <Text style={text.small}>{item.detail}</Text> : null}
                                    </View>
                                </Pressable>
                            );
                        }}
                    />
                </View>
            </Modal>
        </View>
    );
}

// Row of choice chips (one selected).
export function Chips({ options, value, onChange }) {
    return (
        <View style={styles.chips}>
            {options.map((option) => {
                const on = option.value === value;
                return (
                    <Pressable key={option.value} onPress={() => onChange(option.value)} style={[styles.chip, on && styles.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
                        <Text style={[styles.chipText, on && { color: colors.white }]}>{option.label}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

// Bottom sheet asking for a short written reason. onSubmit(text) may be async.
export function ReasonDialog({ visible, title, caption, label = 'Reason', minLength = 10, submitLabel = 'Send', onSubmit, onClose, children }) {
    const [value, setValue] = useState('');
    const [busy, setBusy] = useState(false);
    const short = value.trim().length < minLength;

    const send = async () => {
        setBusy(true);
        try {
            await onSubmit(value.trim());
            setValue('');
        } finally {
            setBusy(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={busy ? undefined : onClose}>
            <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
                <Pressable style={styles.backdrop} onPress={busy ? undefined : onClose} />
                <View style={styles.sheet}>
                    <View style={styles.sheetHead}>
                        <Text style={[text.title, { flex: 1 }]}>{title}</Text>
                        <Pressable onPress={onClose} disabled={busy} hitSlop={10} accessibilityLabel="Close">
                            <Feather name="x" size={20} color={colors.inkMuted} />
                        </Pressable>
                    </View>
                    {caption ? <Text style={[text.small, { marginBottom: space(1.5) }]}>{caption}</Text> : null}
                    {children}
                    <Field label={label} value={value} onChangeText={(v) => setValue(v.slice(0, 500))} multiline autoCapitalize="sentences" />
                    {short && minLength > 0 ? <Text style={[text.small, { marginTop: -space(1), marginBottom: space(1.5) }]}>At least {minLength} characters.</Text> : null}
                    <Button title={submitLabel} icon="send" onPress={send} busy={busy} disabled={short} />
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// Centered empty / loading state.
export function Empty({ icon = 'inbox', title, caption, loading }) {
    return (
        <View style={styles.empty}>
            {loading ? <ActivityIndicator color={colors.jade} /> : <Feather name={icon} size={26} color={colors.inkFaint} />}
            {title ? <Text style={[text.subtitle, { marginTop: space(1), textAlign: 'center' }]}>{title}</Text> : null}
            {caption ? <Text style={[text.small, { marginTop: 4, textAlign: 'center' }]}>{caption}</Text> : null}
        </View>
    );
}

// Screen title with an optional back arrow and a right-side action.
export function Header({ overline, title, onBack, right }) {
    return (
        <View style={styles.header}>
            {onBack && (
                <Pressable onPress={onBack} hitSlop={10} style={styles.iconButton} accessibilityLabel="Back">
                    <Feather name="arrow-left" size={18} color={colors.inkSoft} />
                </Pressable>
            )}
            <View style={{ flex: 1 }}>
                {overline ? <Text style={text.overline}>{overline}</Text> : null}
                <Text style={[text.display, { marginTop: overline ? 4 : 0 }]}>{title}</Text>
            </View>
            {right}
        </View>
    );
}

export function SectionTitle({ title, caption }) {
    return (
        <View style={{ marginTop: space(3), marginBottom: space(1.5) }}>
            <Text style={text.title}>{title}</Text>
            {caption ? <Text style={[text.small, { marginTop: 2 }]}>{caption}</Text> : null}
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    page: { padding: space(2.5), paddingBottom: space(6) },
    card: { backgroundColor: colors.paper, borderRadius: radius.xl, borderWidth: 1, borderColor: colors.lineSoft, padding: space(2), ...shadow.card },
    button: { borderRadius: radius.md, minHeight: 50, justifyContent: 'center' },
    buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: space(2.5) },
    buttonSmall: { paddingHorizontal: space(1.5) },
    buttonText: { fontFamily: fonts.semibold, fontSize: 15, color: colors.white },
    buttonTextSmall: { fontSize: 13 },
    outline: { borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paper, minHeight: 44 },
    danger: { borderWidth: 1, borderColor: colors.error + '55', backgroundColor: colors.paper, minHeight: 44 },
    label: { fontFamily: fonts.semibold, fontSize: 12.5, color: colors.inkSoft, marginBottom: 6 },
    field: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingHorizontal: 14, minHeight: 50 },
    input: { flex: 1, fontFamily: fonts.medium, fontSize: 15, color: colors.ink, paddingVertical: 10 },
    tag: { flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 9, paddingVertical: 3, borderRadius: radius.pill },
    tagText: { fontFamily: fonts.bold, fontSize: 11 },
    stat: { flex: 1, minWidth: 140, padding: space(1.75) },
    statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', marginBottom: space(1) },
    notice: { flexDirection: 'row', gap: 10, padding: space(1.5), borderRadius: radius.md, borderWidth: 1, marginBottom: space(1.5) },
    monthSwitch: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.paper, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 4, marginBottom: space(2) },
    monthArrow: { width: 38, height: 38, borderRadius: radius.sm, backgroundColor: colors.jadeMist, alignItems: 'center', justifyContent: 'center' },
    kvRow: { flexDirection: 'row', alignItems: 'center', gap: space(1), paddingVertical: space(1.1) },
    bars: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
    barSlot: { flex: 1, height: '100%', justifyContent: 'flex-end' },
    bar: { width: '100%', borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    barGhost: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: colors.jadeMist, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
    barLabels: { flexDirection: 'row', gap: 4, marginTop: 6 },
    barLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 9, color: colors.inkMuted, textAlign: 'center' },
    listRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), paddingVertical: space(1.4), paddingHorizontal: space(1.5) },
    listIcon: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
    footer: { paddingHorizontal: space(2.5), paddingTop: space(1.5), paddingBottom: space(2), backgroundColor: colors.paper, borderTopWidth: 1, borderTopColor: colors.line },
    offline: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.inkSoft, paddingVertical: 6, paddingHorizontal: space(2) },
    offlineText: { fontFamily: fonts.semibold, fontSize: 12, color: colors.white },
    skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: space(1.5), padding: space(1.5) },
    track: { width: '100%', backgroundColor: colors.lineSoft, overflow: 'hidden' },
    fieldError: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: -space(1.25), marginBottom: space(1.5) },
    backdrop: { flex: 1, backgroundColor: 'rgba(10,22,40,0.45)' },
    sheet: { maxHeight: '75%', backgroundColor: colors.paper, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: space(2), paddingBottom: space(4) },
    sheetHead: { flexDirection: 'row', alignItems: 'center', marginBottom: space(1.5) },
    option: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: space(1.5), paddingHorizontal: space(1.5), borderRadius: radius.md },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: space(2) },
    chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.lineStrong, backgroundColor: colors.paper },
    chipOn: { backgroundColor: colors.jade, borderColor: colors.jade },
    chipText: { fontFamily: fonts.semibold, fontSize: 13, color: colors.inkSoft },
    empty: { alignItems: 'center', paddingVertical: space(5), paddingHorizontal: space(2) },
    header: { flexDirection: 'row', alignItems: 'flex-start', gap: space(1.5), marginBottom: space(2.5) },
    iconButton: { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
});
