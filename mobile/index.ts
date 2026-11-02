import { registerRootComponent } from 'expo';

import { Platform } from 'react-native';
import { registerWidgetTaskHandler } from 'react-native-android-widget';

import App from './App';
import { tareaWidget } from './widget/tarea';

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);

// Android redibuja el widget por su cuenta (al agregarlo, al reiniciar el teléfono): usa lo último que mandó la app.
if (Platform.OS === 'android' && tareaWidget) registerWidgetTaskHandler(tareaWidget);
