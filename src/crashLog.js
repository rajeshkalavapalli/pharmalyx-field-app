import { Component } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { colors, fonts, radius, space } from './theme';

// When the app closes because of a JavaScript error, the message is kept on the phone and shown on the
// next start, so a tester can screenshot it (we have no crash service yet). Native crashes are not caught here.

const KEY = 'pharmalyx.lastCrash';

const describe = (error, where) => `${where}: ${error?.message || String(error)}\n\n${String(error?.stack || '').split('\n').slice(0, 6).join('\n')}`;

const save = (error, where) => {
    try {
        SecureStore.setItem(KEY, describe(error, where).slice(0, 1500));
    } catch {
        // nothing more we can do
    }
};

// Installed once at start-up (index.js), before the first screen.
export const installCrashLog = () => {
    const utils = global.ErrorUtils;
    if (!utils?.setGlobalHandler) return;
    const previous = utils.getGlobalHandler?.();
    utils.setGlobalHandler((error, isFatal) => {
        if (isFatal) save(error, 'App closed');
        if (previous) previous(error, isFatal);
    });
};

// Shows (once) what made the app close last time.
export const showLastCrash = () => {
    let last = null;
    try {
        last = SecureStore.getItem(KEY);
        if (last) SecureStore.deleteItemAsync(KEY).catch(() => {});
    } catch {
        last = null;
    }
    if (last) Alert.alert('The app closed last time', `Please send a screenshot of this to support.\n\n${last}`);
};

// A screen that breaks shows its error with a way back, instead of closing the whole app.
export class CrashScreen extends Component {
    constructor(props) {
        super(props);
        this.state = { error: null };
    }

    static getDerivedStateFromError(error) {
        return { error };
    }

    componentDidCatch(error) {
        save(error, 'Screen error');
    }

    render() {
        if (!this.state.error) return this.props.children;
        return (
            <View style={{ flex: 1, backgroundColor: colors.bg, padding: space(3), paddingTop: space(8) }}>
                <Text style={{ fontFamily: fonts.bold, fontSize: 20, color: colors.ink }}>Something went wrong</Text>
                <Text style={{ fontFamily: fonts.regular, color: colors.inkSoft, marginTop: space(1) }}>Please send a screenshot of this to support.</Text>
                <ScrollView style={{ marginTop: space(2), maxHeight: 320, backgroundColor: colors.paper, borderRadius: radius.md, padding: space(2) }}>
                    <Text selectable style={{ fontFamily: fonts.regular, fontSize: 12, color: colors.ink }}>
                        {describe(this.state.error, 'Screen error')}
                    </Text>
                </ScrollView>
                <Pressable onPress={() => this.setState({ error: null })} style={{ marginTop: space(3), backgroundColor: colors.jade, borderRadius: radius.md, padding: space(1.75), alignItems: 'center' }}>
                    <Text style={{ fontFamily: fonts.bold, color: colors.paper }}>Try again</Text>
                </Pressable>
            </View>
        );
    }
}
