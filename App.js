import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Feather } from '@expo/vector-icons';
import { useFonts, PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold } from '@expo-google-fonts/plus-jakarta-sans';
import { Fraunces_600SemiBold } from '@expo-google-fonts/fraunces';

import { loadSession, onSessionChange } from './src/api';
import { AttentionProvider, useAttention } from './src/attention';
import { stopTrail } from './src/location';
import { PermissionsProvider, usePermissions } from './src/permissions';
import { colors, fonts, gradients, shadow } from './src/theme';
import { ToastHost } from './src/toast';
import SignIn from './src/screens/SignIn';
import ChangePassword from './src/screens/ChangePassword';
import Me from './src/screens/Me';
import { STACK_SCREENS, TAB_COMPONENTS } from './src/screens/registry';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();
const Placeholder = () => null;

// The round brand button in the middle of the tab bar: check in at a clinic.
function CheckInButton({ onPress }) {
    return (
        <View style={styles.centerSlot}>
            <Pressable onPress={onPress} style={({ pressed }) => [styles.centerPress, pressed && { transform: [{ scale: 0.94 }] }]} accessibilityRole="button" accessibilityLabel="Check in at a clinic">
                <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.centerButton}>
                    <Feather name="map-pin" size={24} color={colors.white} />
                </LinearGradient>
            </Pressable>
            <Text style={styles.centerLabel}>Check in</Text>
        </View>
    );
}

// Bottom tabs: Home, Doctors, [Check in], Alerts, Me. Doctors and Check in show only if the role allows them.
function Tabs() {
    const permissions = usePermissions();
    const attention = useAttention();
    const tabs = [
        { name: 'Home', component: TAB_COMPONENTS.Home, icon: 'home' },
        { name: 'Doctors', component: TAB_COMPONENTS.Doctors, icon: 'users', permission: ['doctors.view', 'masters.view'] },
        { name: 'CheckInTab', center: true, permission: ['visits.create'] },
        { name: 'Alerts', component: TAB_COMPONENTS.Alerts, icon: 'bell', badge: attention.unseen },
        { name: 'Me', component: Me, icon: 'user' },
    ].filter((tab) => !tab.permission || permissions.any(tab.permission));

    return (
        <Tab.Navigator
            screenOptions={{
                headerShown: false,
                tabBarActiveTintColor: colors.jade,
                tabBarInactiveTintColor: colors.inkMuted,
                tabBarLabelStyle: { fontFamily: fonts.semibold, fontSize: 11 },
                tabBarStyle: { backgroundColor: colors.paper, borderTopColor: colors.line, paddingTop: 6 },
                tabBarBadgeStyle: { backgroundColor: colors.error, fontFamily: fonts.bold, fontSize: 10 },
            }}
        >
            {tabs.map((tab) =>
                tab.center ? (
                    <Tab.Screen
                        key={tab.name}
                        name={tab.name}
                        component={Placeholder}
                        options={{ tabBarLabel: () => null, tabBarButton: (props) => <CheckInButton onPress={props.onPress} /> }}
                        listeners={({ navigation }) => ({
                            tabPress: (event) => {
                                event.preventDefault();
                                navigation.navigate('CheckIn');
                            },
                        })}
                    />
                ) : (
                    <Tab.Screen
                        key={tab.name}
                        name={tab.name}
                        component={tab.component}
                        options={{ tabBarIcon: ({ color, size }) => <Feather name={tab.icon} size={size - 2} color={color} />, tabBarBadge: tab.badge ? (tab.badge > 9 ? '9+' : tab.badge) : undefined }}
                    />
                )
            )}
        </Tab.Navigator>
    );
}

const navTheme = { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: colors.bg, primary: colors.jade, card: colors.paper, text: colors.ink, border: colors.line } };

// Pharmalyx mobile app (every role). Signed out -> sign in; temporary password -> choose your own; otherwise the tabs.
export default function App() {
    const [fontsLoaded] = useFonts({ PlusJakartaSans_400Regular, PlusJakartaSans_500Medium, PlusJakartaSans_600SemiBold, PlusJakartaSans_700Bold, PlusJakartaSans_800ExtraBold, Fraunces_600SemiBold });
    const [session, setSession] = useState(undefined); // undefined = still loading

    useEffect(() => {
        loadSession().then(setSession);
        return onSessionChange((next) => {
            setSession(next);
            if (!next) stopTrail(); // signed out: stop recording location
        });
    }, []);

    if (!fontsLoaded || session === undefined) {
        return (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.bg }}>
                <ActivityIndicator color={colors.jade} />
            </View>
        );
    }

    // Signed out / first password change: plain screens, outside the navigation stack (on Android the
    // native screen container can take focus away from text fields while the keyboard opens).
    if (!session || session.mustChangePassword) {
        return (
            <SafeAreaProvider>
                <StatusBar style="light" />
                {!session ? <SignIn /> : <ChangePassword />}
                <ToastHost />
            </SafeAreaProvider>
        );
    }

    return (
        <SafeAreaProvider>
            {/* keyed by user + company so permissions reload after switching account */}
            <PermissionsProvider key={`${session.user?.UserId}-${session.user?.organisation?.OrganisationId || ''}`}>
                <AttentionProvider>
                <NavigationContainer theme={navTheme}>
                    <StatusBar style="dark" />
                    <Stack.Navigator screenOptions={{ headerShown: false, animation: 'slide_from_right' }}>
                        <Stack.Screen name="Tabs" component={Tabs} />
                        {Object.entries(STACK_SCREENS).map(([name, component]) => (
                            <Stack.Screen key={name} name={name} component={component} />
                        ))}
                    </Stack.Navigator>
                </NavigationContainer>
                </AttentionProvider>
            </PermissionsProvider>
            <ToastHost />
        </SafeAreaProvider>
    );
}

const styles = StyleSheet.create({
    centerSlot: { flex: 1, alignItems: 'center', justifyContent: 'flex-start' },
    centerPress: { marginTop: -22, borderRadius: 32, ...shadow.glow },
    centerButton: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.paper },
    centerLabel: { fontFamily: fonts.semibold, fontSize: 11, color: colors.jadeDark, marginTop: 2 },
});
