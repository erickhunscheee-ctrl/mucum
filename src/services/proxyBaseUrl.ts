import { Platform } from 'react-native';

const configuredProxyUrl = process.env.EXPO_PUBLIC_PROXY_URL?.trim();
const developmentFallback = Platform.OS === 'web' && !__DEV__
  ? ''
  : 'http://localhost:3001';

export const PROXY_BASE_URL = (configuredProxyUrl || developmentFallback).replace(/\/+$/, '');
