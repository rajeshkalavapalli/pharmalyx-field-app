import { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { errorMessage } from './api';
import { colors } from './theme';

// Loads data when the screen comes into view (and again on pull-to-refresh).
// fetcher: async () => data. deps: values that should trigger a fresh load (e.g. the month).
// Returns { data, error, reload, setData, refreshControl }.
export default function useLoad(fetcher, deps = [], fallback = "Couldn't load this screen.") {
    // Data is kept with the deps it was loaded for, so switching month never shows the old month.
    const [box, setBox] = useState({ key: null, data: null });
    const [error, setError] = useState('');
    const [refreshing, setRefreshing] = useState(false);
    const latest = useRef(0);
    const source = useRef({ fetcher, fallback });
    useEffect(() => {
        source.current = { fetcher, fallback };
    });
    const key = JSON.stringify(deps);
    const data = box.key === key ? box.data : null;
    const setData = useCallback((next) => setBox((b) => ({ key, data: typeof next === 'function' ? next(b.key === key ? b.data : null) : next })), [key]);

    const reload = useCallback(async () => {
        const ticket = ++latest.current;
        try {
            const result = await source.current.fetcher();
            if (ticket !== latest.current) return;
            setBox({ key, data: result });
            setError('');
        } catch (err) {
            if (ticket === latest.current) setError(errorMessage(err, source.current.fallback));
        } finally {
            if (ticket === latest.current) setRefreshing(false);
        }
    }, [key]);

    useFocusEffect(
        useCallback(() => {
            reload();
        }, [reload])
    );

    const onRefresh = () => {
        setRefreshing(true);
        reload();
    };
    const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.jade} colors={[colors.jade]} />;

    return { data, error, reload, setData, refreshControl };
}
