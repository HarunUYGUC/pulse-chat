import { Platform } from 'react-native';
import Constants from 'expo-constants';

// Determine the host dynamically:
// 1. If user set EXPO_PUBLIC_API_URL in .env, respect it first.
// 2. In Expo Go / development, Constants.expoConfig.hostUri gives the computer's LAN IP (e.g. 192.168.1.35:8081).
// 3. Android Emulator fallback uses 10.0.2.2.
// 4. Default fallback uses localhost:5000.
function resolveBackendHost(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    const ip = hostUri.split(':')[0];
    if (ip) {
      return `http://${ip}:5000`;
    }
  }

  return Platform.select({
    android: 'http://10.0.2.2:5000',
    default: 'http://localhost:5000',
  }) || 'http://localhost:5000';
}

export const API_BASE_URL = resolveBackendHost();
export const API_URL = `${API_BASE_URL}/api`;
export const HUB_URL = `${API_BASE_URL}/hubs/chat`;

