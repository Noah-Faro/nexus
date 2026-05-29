import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { useState, useEffect } from 'react';

WebBrowser.maybeCompleteAuthSession();

// User should replace this with their actual client ID from Google Cloud Console
const GOOGLE_CLIENT_ID = '487589350519-esmckfuchimjnlf96nm3j7d5j19adbl1.apps.googleusercontent.com';
const TOKEN_STORAGE_KEY = 'nexus_google_drive_token';

export const useGoogleDriveAuth = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [request, response, promptAsync] = AuthSession.useAuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
    redirectUri: 'https://auth.expo.io/@anonymous/nexus',
    responseType: AuthSession.ResponseType.Token,
    usePKCE: false,
  }, {
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  });

  useEffect(() => {
    // Check for stored token on mount
    SecureStore.getItemAsync(TOKEN_STORAGE_KEY).then(token => {
      if (token) setAccessToken(token);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (response?.type === 'success') {
      const { access_token } = response.params;
      setAccessToken(access_token);
      SecureStore.setItemAsync(TOKEN_STORAGE_KEY, access_token).catch(console.error);
    }
  }, [response]);

  const logout = async () => {
    setAccessToken(null);
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY).catch(console.error);
    await SecureStore.deleteItemAsync('nexus_vault_password').catch(console.error);
  };

  return { accessToken, request, promptAsync, logout };
};
