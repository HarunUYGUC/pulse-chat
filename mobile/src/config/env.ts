import { Platform } from 'react-native';

// Fallback host if EXPO_PUBLIC_API_URL is not set:
// - Android Emulator uses 10.0.2.2 to reach computer localhost:5000
// - iOS Simulator uses localhost:5000
// - Physical device should specify EXPO_PUBLIC_API_URL=http://<PC_LAN_IP>:5000
const defaultHost = Platform.select({
  android: 'http://10.0.2.2:5000',
  default: 'http://localhost:5000',
});

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || defaultHost;
export const API_URL = `${API_BASE_URL}/api`;
export const HUB_URL = `${API_BASE_URL}/hubs/chat`;
