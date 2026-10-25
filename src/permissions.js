import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api } from './api';

// The signed-in person's permission codes (same codes and same endpoint as the web sidebar).
const Ctx = createContext({ codes: null, has: () => false, any: () => false, reload: () => {} });

export function PermissionsProvider({ children }) {
    const [codes, setCodes] = useState(null); // Set, or null while loading

    const reload = useCallback(async () => {
        // Retry a few times: right after sign-in the API or network can be slow.
        for (let attempt = 0; attempt < 3; attempt += 1) {
            try {
                const response = await api.get('/app/me/permissions');
                setCodes(new Set(response.data?.permissions || []));
                return;
            } catch {
                await new Promise((resolve) => setTimeout(resolve, 1500 * (attempt + 1)));
            }
        }
        setCodes(new Set());
    }, []);

    useEffect(() => {
        // Loads once on sign-in; the state is set after the server replies, not synchronously.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        reload();
    }, [reload]);

    const value = useMemo(
        () => ({
            codes,
            has: (code) => Boolean(codes?.has(code)),
            any: (list) => Boolean(codes && list.some((code) => codes.has(code))),
            reload,
        }),
        [codes, reload]
    );

    return createElement(Ctx.Provider, { value }, children);
}

export const usePermissions = () => useContext(Ctx);
