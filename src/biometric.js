import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';

import { api } from './api';

// Fingerprint / face check for joint audits. The phone keeps a random secret that opens only with the owner's
// biometrics (requireAuthentication); when someone adds a new fingerprint, Android throws the secret away, so the
// server learns about it (BIOMETRICS_CHANGED) and the audit can't silently be done by another person's finger.

const SECRET_KEY = 'pharmalyx.auditSecret';
const DEVICE_KEY = 'pharmalyx.deviceId';
const ENROLLED_KEY = 'pharmalyx.auditEnrolled';

const randomHex = (length) => {
    let out = '';
    while (out.length < length) out += Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0') + Date.now().toString(16);
    return out.slice(0, length);
};

const protectedOptions = (prompt) => ({ requireAuthentication: true, authenticationPrompt: prompt });

// Registers a fresh secret with the server (first use, new phone, or after fingerprints changed).
const enroll = async (deviceId, reason) => {
    const secret = randomHex(64);
    await SecureStore.setItemAsync(SECRET_KEY, secret, protectedOptions('Set up the fingerprint check for audits'));
    await api.post('/app/audits/device', { DeviceId: deviceId, Secret: secret, Reason: reason });
    await SecureStore.setItemAsync(ENROLLED_KEY, '1');
    return secret;
};

// Returns { available, deviceId, secret, changed } - available is false on phones without a fingerprint / face lock.
// Throws when the person cancels the prompt.
export const biometricProof = async () => {
    const hardware = await LocalAuthentication.hasHardwareAsync().catch(() => false);
    const enrolled = hardware && (await LocalAuthentication.isEnrolledAsync().catch(() => false));
    if (!enrolled) return { available: false };

    let deviceId = await SecureStore.getItemAsync(DEVICE_KEY);
    if (!deviceId) {
        deviceId = randomHex(24);
        await SecureStore.setItemAsync(DEVICE_KEY, deviceId);
    }

    if (!(await SecureStore.getItemAsync(ENROLLED_KEY))) {
        return { available: true, deviceId, secret: await enroll(deviceId, 'FIRST'), changed: false };
    }

    const secret = await SecureStore.getItemAsync(SECRET_KEY, protectedOptions('Confirm it is you for this audit'));
    if (!secret) {
        // The key was invalidated: fingerprints / face changed on this phone. Re-enrol and tell the server.
        return { available: true, deviceId, secret: await enroll(deviceId, 'BIOMETRICS_CHANGED'), changed: true };
    }
    return { available: true, deviceId, secret, changed: false };
};
