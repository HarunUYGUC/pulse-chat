import 'react-native-gesture-handler';
import React from 'react';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StyleSheet, LogBox } from 'react-native';
import { RootNavigator } from './src/navigation/RootNavigator';
import { colors } from './src/theme/colors';

// Ignore normal mobile background / reconnect websocket logs
LogBox.ignoreLogs([
  'WebSocket closed with status code: 1006',
  'Software caused connection abort',
]);

export default function App() {
  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="light" />
      <RootNavigator />
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
});
