import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';

// The Pharmalyx API address comes from .env (EXPO_PUBLIC_API_URL), e.g. http://192.168.1.20:5000 on the
// office Wi-Fi while testing, or https://api.yourcompany.com in production.
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const KEYS = { token: 'plx_token', expires: 'plx_expires', user: 'plx_user', mustChange: 'plx_must_change' };

// ---------------------------------------------------------------------
// Session (kept in the phone's secure storage)
// ---------------------------------------------------------------------

let cached = null; // { token, expiresAt, user, mustChangePassword }
const listeners = new Set();

export const onSessionChange = (fn) => {
    listeners.add(fn);
    return () => listeners.delete(fn);
};
const notify = () => listeners.forEach((fn) => fn(cached));

export const loadSession = async () => {
    const [token, expiresAt, user, mustChange] = await Promise.all(Object.values(KEYS).map((key) => SecureStore.getItemAsync(key)));
    const expired = !token || (expiresAt && Date.parse(expiresAt) <= Date.now());
    cached = expired ? null : { token, expiresAt, user: user ? JSON.parse(user) : null, mustChangePassword: mustChange === '1' };
    return cached;
};

export const saveSession = async ({ token, expiresAt, user, mustChangePassword }) => {
    const next = { token, expiresAt, user: user || cached?.user || null, mustChangePassword: Boolean(mustChangePassword) };
    await Promise.all([
        SecureStore.setItemAsync(KEYS.token, next.token),
        SecureStore.setItemAsync(KEYS.expires, String(next.expiresAt || '')),
        SecureStore.setItemAsync(KEYS.user, JSON.stringify(next.user)),
        SecureStore.setItemAsync(KEYS.mustChange, next.mustChangePassword ? '1' : '0'),
    ]);
    cached = next;
    notify();
};

export const clearSession = async () => {
    await Promise.all(Object.values(KEYS).map((key) => SecureStore.deleteItemAsync(key)));
    cached = null;
    notify();
};

export const currentSession = () => cached;

// ---------------------------------------------------------------------
// HTTP client
// ---------------------------------------------------------------------

export const api = axios.create({ baseURL: API_URL, timeout: 30000 });

api.interceptors.request.use((config) => {
    if (cached?.token) config.headers.Authorization = `Bearer ${cached.token}`;
    return config;
});

api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const status = error.response?.status;
        const isLogin = String(error.config?.url || '').includes('/login');
        if (status === 401 && !isLogin) await clearSession();
        if (status === 403 && error.response?.data?.code === 'PASSWORD_CHANGE_REQUIRED' && cached) {
            cached = { ...cached, mustChangePassword: true };
            notify();
        }
        return Promise.reject(error);
    }
);

// A readable message for any failed request.
export const errorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
    if (error?.response?.data?.message) return error.response.data.message;
    if (error?.code === 'ECONNABORTED') return 'The server took too long to answer. Please try again.';
    if (!error?.response) return "Can't reach the server. Check your internet connection.";
    return fallback;
};

const data = (promise) => promise.then((response) => response.data);

// ---------------------------------------------------------------------
// Endpoints used by the field app (the same API the web app uses)
// ---------------------------------------------------------------------

export const signIn = (login, password) => data(api.post('/app/login', { login, password }));
export const chooseCompany = (ticket, organisationId) => data(api.post('/app/login/choose', { ticket, organisationId }));
export const changePassword = (currentPassword, newPassword) => data(api.post('/app/change-password', { currentPassword, newPassword }));

export const getConsent = () => data(api.get('/app/work/consent'));
export const acceptConsent = () => data(api.post('/app/work/consent', { Accept: true }));
export const startDay = (location) => data(api.post('/app/work/day/start', { Location: location }));
export const getToday = () => data(api.get('/app/work/today'));
export const checkIn = (doctorId, location) => data(api.post('/app/work/check-in', { DoctorId: doctorId, Location: location }));
export const sendPings = (points, source) => data(api.post('/app/work/pings', { Points: points, Source: source }));
export const saveVisit = (payload) => data(api.post('/app/visits', payload));

// Photos go up as the raw image body (same as the web app); the server answers with a photoId.
// Uses Expo's binary upload: reading a file:// photo through fetch() is not reliable on Android.
export const uploadImage = async (path, uri, mimeType, extraHeaders = {}) => {
    const result = await FileSystem.uploadAsync(`${API_URL}${path}`, uri, {
        httpMethod: 'POST',
        uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
        headers: { ...extraHeaders, 'Content-Type': mimeType || 'image/jpeg', ...(cached?.token ? { Authorization: `Bearer ${cached.token}` } : {}) },
    });
    let body = null;
    try {
        body = JSON.parse(result.body);
    } catch {
        body = null;
    }
    if (result.status >= 200 && result.status < 300) return body;
    if (result.status === 401) await clearSession();
    // Same shape as an axios error, so errorMessage() shows the server's message.
    const error = new Error(body?.message || 'Upload failed');
    error.response = { status: result.status, data: body || {} };
    throw error;
};

// Doctors
export const getMyDoctors = () => data(api.get('/app/my-doctors'));
export const getDoctorOptions = () => data(api.get('/app/doctor-requests/options'));
export const checkDoctorDuplicates = (payload) => data(api.post('/app/doctor-requests/check', payload));
export const uploadSignboard = (uri, mimeType) => uploadImage('/app/doctor-requests/photo', uri, mimeType);
export const requestNewDoctor = (payload) => data(api.post('/app/doctor-requests', payload));
export const getDoctorRequests = (status) => data(api.get('/app/doctor-requests', { params: { status: status || undefined } }));
export const getDoctorRequest = (requestId) => data(api.get(`/app/doctor-requests/${requestId}`));
export const requestDoctorChange = (doctorId, payload) => data(api.post(`/app/doctor-requests/doctors/${doctorId}/change`, payload));
export const resubmitDoctorRequest = (requestId, payload) => data(api.post(`/app/doctor-requests/${requestId}/resubmit`, payload));
export const cancelDoctorRequest = (requestId) => data(api.post(`/app/doctor-requests/${requestId}/cancel`));
export const decideDoctorRequest = (requestId, approve, remarks, isDuplicate = false) => data(api.post(`/app/doctor-requests/${requestId}/${approve ? 'approve' : 'reject'}`, { Remarks: remarks || null, IsDuplicate: isDuplicate }));
export const getMyTeam = () => data(api.get('/app/my-doctors/team'));
export const getDoctorsOf = (userId) => data(api.get('/app/my-doctors', { params: { userId } }));
export const getDuplicateFlags = (status) => data(api.get('/app/doctor-duplicates', { params: { status } }));
export const resolveDuplicateFlag = (flagId, status, note) => data(api.post(`/app/doctor-duplicates/${flagId}/resolve`, { Status: status, Note: note }));

// Doctor verification (provisional doctors: proof within the deadline)
export const getVerificationOverview = (status) => data(api.get('/app/doctor-verification', { params: { status: status || undefined } }));
export const getVerification = (verificationId) => data(api.get(`/app/doctor-verification/${verificationId}`));
export const submitVerification = (doctorId, payload) => data(api.post(`/app/doctor-verification/doctors/${doctorId}`, payload));
export const confirmJointVisit = (doctorId, remarks) => data(api.post(`/app/doctor-verification/doctors/${doctorId}/joint-visit`, { Remarks: remarks || null }));
export const extendVerification = (doctorId, days, reason) => data(api.post(`/app/doctor-verification/doctors/${doctorId}/extend`, { Days: days, Reason: reason }));
export const decideVerification = (verificationId, accept, remarks) => data(api.post(`/app/doctor-verification/${verificationId}/${accept ? 'accept' : 'reject'}`, { Remarks: remarks || null }));

// A photo the API serves behind sign-in (doctor evidence, order slips): an <Image> source with the token.
export const authImage = (path) => ({ uri: `${API_URL}${path}`, headers: cached?.token ? { Authorization: `Bearer ${cached.token}` } : {} });

// Orders (POB)
export const getOrders = (month) => data(api.get('/app/orders', { params: { month, scope: 'self' } }));
export const getOrderOptions = () => data(api.get('/app/orders/options'));
export const uploadSlip = (uri, mimeType) => uploadImage('/app/orders/slip', uri, mimeType);
export const createOrder = (payload) => data(api.post('/app/orders', payload));
export const updateOrderStatus = (orderId, status, remarks) => data(api.post(`/app/orders/${orderId}/status`, { Status: status, Remarks: remarks || null }));

// TA / DA
export const getStatement = (month) => data(api.get('/app/expenses/statement', { params: { month } }));
export const sendDayReason = (reviewId, reason) => data(api.post(`/app/expenses/day-reviews/${reviewId}/reason`, { Reason: reason }));
export const acceptAllowancePolicy = () => data(api.post('/app/expenses/policy/accept'));

// Attendance and leave
export const getAttendanceToday = () => data(api.get('/app/attendance/today'));
export const attendanceCheckOut = (location) => data(api.post('/app/attendance/check-out', location));
export const getAttendanceMonth = (month) => data(api.get('/app/attendance/month', { params: { month } }));
export const getLeave = (year) => data(api.get('/app/leave', { params: { year } }));
export const applyLeave = (payload) => data(api.post('/app/leave', payload));
export const cancelLeave = (leaveId) => data(api.post(`/app/leave/${leaveId}/cancel`));

// Dates as the API expects them (local time, YYYY-MM-DD / YYYY-MM).
const pad = (n) => String(n).padStart(2, '0');
export const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKey = (d = new Date()) => dateKey(d).slice(0, 7);
export const rupees = (value) => `₹${Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
