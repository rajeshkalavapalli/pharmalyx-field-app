import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

import { api, currentSession, monthKey, rupees } from './api';
import { APPROVAL_PERMISSIONS } from './menu';
import { usePermissions } from './permissions';

// What needs attention right now, from the same APIs the screens use. Drives the tile badges,
// the Home highlight strip and the Alerts tab. Each source loads only if the role allows it.

const Ctx = createContext({ ready: false, badges: {}, highlights: [], alerts: [], unseen: 0, reload: () => {}, markSeen: () => {} });

const seenFile = () => `${FileSystem.documentDirectory}seen-alerts-${String(currentSession()?.user?.UserId || 'me').toLowerCase()}.json`;
const readSeen = async () => {
    try {
        return new Set(JSON.parse(await FileSystem.readAsStringAsync(seenFile())));
    } catch {
        return new Set();
    }
};
const writeSeen = (keys) => FileSystem.writeAsStringAsync(seenFile(), JSON.stringify([...keys].slice(-300))).catch(() => {});

const nextMonth = () => {
    const d = new Date();
    return monthKey(new Date(d.getFullYear(), d.getMonth() + 1, 1));
};
const monthName = (key) => new Date(`${key}-01T00:00:00`).toLocaleDateString('en-IN', { month: 'long' });
const quiet = (promise) => promise.then((r) => r.data).catch(() => null);

export function AttentionProvider({ children }) {
    const permissions = usePermissions();
    const [data, setData] = useState({});
    const [ready, setReady] = useState(false);
    const [seen, setSeen] = useState(new Set());

    const reload = useCallback(async () => {
        if (!permissions.codes) return;
        const can = (list) => permissions.any(list);
        const next = nextMonth();
        const [today, approvals, verification, requests, statement, plan, alerts] = await Promise.all([
            can(['visits.create']) ? quiet(api.get('/app/work/today')) : null,
            can(APPROVAL_PERMISSIONS) ? quiet(api.get('/app/approvals')) : null,
            can(['doctorrequests.create', 'doctorrequests.approve']) ? quiet(api.get('/app/doctor-verification')) : null,
            can(['doctorrequests.create', 'doctorrequests.approve']) ? quiet(api.get('/app/doctor-requests', { params: { status: 'PENDING' } })) : null,
            can(['expenses.view']) ? quiet(api.get('/app/expenses/statement', { params: { month: monthKey() } })) : null,
            can(['tourplan.view']) && new Date().getDate() >= 20 ? quiet(api.get('/app/tourplan', { params: { planMonth: `${next}-01` } })) : null,
            can(['alerts.view']) ? quiet(api.get('/app/insights/alerts')) : null,
        ]);
        setData({ today, approvals, verification, requests, statement, plan, alerts, next });
        setSeen(await readSeen());
        setReady(true);
    }, [permissions]);

    useEffect(() => {
        // Loads after the permissions arrive, then every 5 minutes; state is set after the replies.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        reload();
        const timer = setInterval(reload, 5 * 60 * 1000);
        return () => clearInterval(timer);
    }, [reload]);

    const derived = useMemo(() => {
        const { today, approvals, verification, requests, statement, plan, alerts, next } = data;
        const badges = {};
        const highlights = [];
        const items = [];

        if (today?.workDay) {
            const needs = today.rules?.daMinValidVisits ?? 6;
            const counted = today.validToday ?? 0;
            highlights.push({ key: 'da', icon: 'check-circle', tone: counted >= needs ? 'success' : 'primary', text: counted >= needs ? 'DA earned today' : `${counted} of ${needs} visits for DA`, screen: 'Today' });
        } else if (today && today.consent?.accepted) {
            highlights.push({ key: 'start', icon: 'play', tone: 'warning', text: 'Start your day', screen: 'Today' });
            items.push({ key: `start-${today.date}`, group: 'Your day', icon: 'play', tone: 'warning', title: 'Start your day', caption: 'It checks you in and starts the location trail for TA.', screen: 'Today' });
        }

        if (approvals?.total) {
            badges.Approvals = approvals.total;
            highlights.push({ key: 'approvals', icon: 'inbox', tone: approvals.overdue ? 'warning' : 'info', text: `${approvals.total} approval${approvals.total === 1 ? '' : 's'} pending`, screen: 'Approvals' });
            approvals.items.slice(0, 30).forEach((a) =>
                items.push({ key: `appr-${a.key}`, group: 'Waiting for you', icon: 'inbox', tone: a.overdue ? 'warning' : 'info', title: `${a.typeLabel}: ${a.userName}`, caption: a.period, screen: 'Approvals' })
            );
        }

        const myPending = (requests?.requests || []).filter((r) => r.canReview || r.isMine).length;
        if (myPending) badges.DoctorRequests = myPending;
        const s = verification?.summary;
        if (s) {
            const n = (s.toReview || 0) + (s.overdue || 0);
            if (n) badges.Verification = n;
            if (s.overdue) {
                highlights.push({ key: 'verify', icon: 'shield', tone: 'error', text: `${s.overdue} doctor${s.overdue === 1 ? '' : 's'} to verify (overdue)`, screen: 'DoctorRequests', params: { tab: 'verification' } });
                items.push({ key: `verify-${s.overdue}-${s.provisional}`, group: 'Doctors', icon: 'shield', tone: 'error', title: `${s.overdue} doctor verification${s.overdue === 1 ? '' : 's'} overdue`, caption: `${s.provisional} new doctors are not verified yet.`, screen: 'DoctorRequests', params: { tab: 'verification' } });
            }
        }

        const held = (statement?.rows || []).filter((r) => r.canSendReason);
        if (held.length) {
            badges.Allowance = held.length;
            highlights.push({ key: 'holds', icon: 'clock', tone: 'warning', text: `${held.length} TA/DA day${held.length === 1 ? '' : 's'} need your reason`, screen: 'Allowance' });
            held.forEach((r) => items.push({ key: `hold-${r.date}`, group: 'Your day', icon: 'clock', tone: 'warning', title: `TA/DA on hold for ${r.date}`, caption: `${rupees(r.total)} · send your reason so your manager can review it.`, screen: 'Allowance' }));
        }

        if (plan && !['APPROVED', 'SUBMITTED'].includes(plan.plan?.Status)) {
            const end = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            badges.TourPlan = 1;
            highlights.push({ key: 'tourplan', icon: 'calendar', tone: 'info', text: `${monthName(next)} tour plan due ${end}`, screen: 'TourPlan', params: { month: next } });
            items.push({ key: `tourplan-${next}`, group: 'Planning', icon: 'calendar', tone: 'info', title: `Plan ${monthName(next)} before ${end}`, caption: 'Your tour plan for next month is not ready yet.', screen: 'TourPlan', params: { month: next } });
        }

        (alerts?.alerts || [])
            .filter((a) => a.status === 'OPEN')
            .slice(0, 30)
            .forEach((a) => items.push({ key: `risk-${a.key}`, group: 'Risk alerts', icon: 'alert-triangle', tone: a.severity === 'HIGH' ? 'error' : 'warning', title: a.subject ? `${a.title}: ${a.subject}` : a.title, caption: a.detail, screen: 'Insights', params: { section: 'alerts' } }));

        return { badges, highlights, items };
    }, [data]);

    // The latest alert keys, for marking everything read from a screen's cleanup.
    const itemsRef = useRef([]);
    useEffect(() => {
        itemsRef.current = derived.items;
    }, [derived]);
    const markSeen = useCallback(() => {
        setSeen((prev) => {
            const all = new Set([...prev, ...itemsRef.current.map((i) => i.key)]);
            writeSeen(all);
            return all;
        });
    }, []);

    const value = useMemo(
        () => ({
            ready,
            badges: derived.badges,
            highlights: derived.highlights,
            alerts: derived.items.map((i) => ({ ...i, unread: !seen.has(i.key) })),
            unseen: derived.items.filter((i) => !seen.has(i.key)).length,
            reload,
            markSeen,
        }),
        [derived, ready, seen, reload, markSeen]
    );

    return createElement(Ctx.Provider, { value }, children);
}

export const useAttention = () => useContext(Ctx);
