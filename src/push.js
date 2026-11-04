import { useEffect } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { createNavigationContainerRef } from '@react-navigation/native';

import { api } from './api';

// Phone notifications (approvals, leave, joint work, TA / DA, DCR). The server sends them through
// the Expo push service; tapping one opens the screen named in its data ({ screen, params }).
// Without notification permission or push set-up, the app works exactly as before.

export const navigationRef = createNavigationContainerRef();

// Shown as a banner even while the app is open.
Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldPlaySound: true, shouldSetBadge: false, shouldShowBanner: true, shouldShowList: true }),
});

let sentToken = null; // the token registered for the signed-in person

// Channel first (Android 13+ asks for permission only once a channel exists), then permission, then token.
export async function registerForPush() {
    try {
        if (Platform.OS === 'android') {
            await Notifications.setNotificationChannelAsync('default', {
                name: 'Pharmalyx',
                // Re-exported from NotificationChannelManager.types (the lint rule can't follow it).
                // eslint-disable-next-line import/namespace
                importance: Notifications.AndroidImportance.HIGH,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#0F766E',
            });
        }
        let { status } = await Notifications.getPermissionsAsync();
        if (status !== 'granted') status = (await Notifications.requestPermissionsAsync()).status;
        if (status !== 'granted') return null;

        const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
        const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
        await api.post('/app/push/token', { Token: token, Platform: Platform.OS });
        sentToken = token;
        return token;
    } catch {
        return null; // offline, or push not set up for this build yet: try again next start
    }
}

// Before signing out, so this phone stops getting the person's notifications.
export async function unregisterPush() {
    if (!sentToken) return;
    try {
        await api.delete('/app/push/token', { data: { Token: sentToken } });
    } catch {
        // signing out anyway; the phone is reassigned when someone signs in on it
    }
    sentToken = null;
}

const openFrom = (response) => {
    const data = response?.notification?.request?.content?.data || {};
    if (!data.screen || !navigationRef.isReady()) return false;
    navigationRef.navigate(data.screen, data.params || undefined);
    return true;
};

// Registers this phone for the signed-in person and opens the screen of a tapped notification
// (also when the tap started the app).
export function usePush(enabled) {
    useEffect(() => {
        if (!enabled) return undefined;
        registerForPush();

        const subscription = Notifications.addNotificationResponseReceivedListener(openFrom);
        // Cold start: the tap that opened the app, once navigation is ready.
        let tries = 0;
        const timer = setInterval(() => {
            tries += 1;
            if (!navigationRef.isReady() && tries < 20) return;
            clearInterval(timer);
            const last = Notifications.getLastNotificationResponse();
            if (last && openFrom(last)) Notifications.clearLastNotificationResponse();
        }, 250);

        return () => {
            subscription.remove();
            clearInterval(timer);
        };
    }, [enabled]);
}
