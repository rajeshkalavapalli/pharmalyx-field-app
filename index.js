import { registerRootComponent } from 'expo';

// Keep the message of any error that closes the app, to show it on the next start.
import { installCrashLog } from './src/crashLog';
installCrashLog();

// The background location task must be defined before the app starts (see src/location.js).
import './src/location';
import App from './App';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
