import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';

import { colors, fonts, radius, shadow, space } from './theme';

// Short confirmation after a create / edit / submit: toast('Order booked'), toast('Failed', 'error').
let show = null;
export const toast = (message, tone = 'success') => show?.({ message, tone, id: Date.now() });

const ICON = { success: 'check-circle', error: 'alert-octagon', info: 'info', warning: 'alert-triangle' };
const COLOR = { success: colors.success, error: colors.error, info: colors.info, warning: colors.warning };

// Mounted once in App, above the navigation.
export function ToastHost() {
    const insets = useSafeAreaInsets();
    const [current, setCurrent] = useState(null);
    const [fade] = useState(() => new Animated.Value(0));

    useEffect(() => {
        show = setCurrent;
        return () => {
            show = null;
        };
    }, []);

    useEffect(() => {
        if (!current) return undefined;
        Animated.timing(fade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
        const timer = setTimeout(() => Animated.timing(fade, { toValue: 0, duration: 220, useNativeDriver: true }).start(() => setCurrent(null)), current.tone === 'error' ? 4500 : 2800);
        return () => clearTimeout(timer);
    }, [current, fade]);

    if (!current) return null;
    return (
        <View pointerEvents="none" style={[styles.wrap, { top: insets.top + space(1) }]}>
            <Animated.View style={[styles.toast, shadow.card, { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
                <Feather name={ICON[current.tone] || 'info'} size={18} color={COLOR[current.tone] || colors.info} />
                <Text style={styles.text}>{current.message}</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { position: 'absolute', left: space(2), right: space(2), alignItems: 'center', zIndex: 100 },
    toast: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.ink, borderRadius: radius.md, paddingHorizontal: space(2), paddingVertical: space(1.5), maxWidth: 520 },
    text: { flexShrink: 1, fontFamily: fonts.semibold, fontSize: 14, color: colors.white },
});
