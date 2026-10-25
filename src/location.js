import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

import { loadSession, currentSession, sendPings } from './api';

// Location for the field app:
//   getFix()     one GPS reading for a check-in or the day start (with the phone's fake-GPS flag)
//   startTrail() the work-hour location trail that TA is worked out from. In a full app build it keeps
//                running in the background; in Expo Go (testing) it records while the app is open.
// The server only keeps points after the one-time consent, inside work hours, once the day has started.

export const TRAIL_TASK = 'pharmalyx-location-trail';
const SOURCE = Platform.OS === 'ios' ? 'IOS' : 'ANDROID';
const FIX_TIMEOUT_MS = 20000;

const toPoint = (position) => ({
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: position.coords.accuracy,
    isMock: position.mocked === true,
    capturedAt: new Date(position.timestamp).toISOString(),
});

// One GPS reading in the shape the API expects: { status: CAPTURED | DENIED | UNAVAILABLE, ... }.
export const getFix = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return { status: 'DENIED' };
    if (!(await Location.hasServicesEnabledAsync())) return { status: 'UNAVAILABLE' };

    try {
        const position = await Promise.race([
            Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
            new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), FIX_TIMEOUT_MS)),
        ]);
        return { status: 'CAPTURED', ...toPoint(position) };
    } catch {
        const last = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: 100 }).catch(() => null);
        return last ? { status: 'CAPTURED', ...toPoint(last) } : { status: 'UNAVAILABLE' };
    }
};

// ---------------------------------------------------------------------
// Trail
// ---------------------------------------------------------------------

let queue = [];

const flush = async () => {
    if (!queue.length) return;
    if (!currentSession()) await loadSession();
    if (!currentSession()) return; // signed out: nothing is sent
    const batch = queue.splice(0, 50);
    try {
        await sendPings(batch, SOURCE);
    } catch (error) {
        // No network: keep the points (with their time) and send them later.
        if (!error?.response) queue = [...batch, ...queue].slice(-500);
    }
};

// Background updates (full app build). Must be defined at start-up, outside any screen.
TaskManager.defineTask(TRAIL_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    queue.push(...data.locations.map(toPoint));
    await flush();
});

let timer = null;

// Starts the trail. Returns 'background', 'foreground' or 'off' (no permission).
export const startTrail = async (intervalMinutes = 10) => {
    const fg = await Location.requestForegroundPermissionsAsync();
    if (fg.status !== 'granted') return 'off';

    try {
        const bg = await Location.requestBackgroundPermissionsAsync();
        if (bg.status === 'granted' && (await Location.isBackgroundLocationAvailableAsync())) {
            if (!(await Location.hasStartedLocationUpdatesAsync(TRAIL_TASK))) {
                await Location.startLocationUpdatesAsync(TRAIL_TASK, {
                    accuracy: Location.Accuracy.Balanced,
                    timeInterval: intervalMinutes * 60000,
                    distanceInterval: 150,
                    deferredUpdatesInterval: intervalMinutes * 60000,
                    showsBackgroundLocationIndicator: true,
                    pausesUpdatesAutomatically: false,
                    foregroundService: {
                        notificationTitle: 'Pharmalyx: work day in progress',
                        notificationBody: 'Your location is recorded during work hours for TA.',
                        notificationColor: '#0F766E',
                    },
                });
            }
            return 'background';
        }
    } catch {
        // Expo Go and some phones do not allow background location: fall back to while-open recording.
    }

    if (!timer) {
        const tick = async () => {
            const fix = await getFix();
            if (fix.status === 'CAPTURED') {
                const { status, ...point } = fix;
                queue.push(point);
                await flush();
            }
        };
        tick();
        timer = setInterval(tick, intervalMinutes * 60000);
    }
    return 'foreground';
};

export const stopTrail = async () => {
    if (timer) clearInterval(timer);
    timer = null;
    if (await Location.hasStartedLocationUpdatesAsync(TRAIL_TASK).catch(() => false)) await Location.stopLocationUpdatesAsync(TRAIL_TASK).catch(() => {});
};
