import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

// Replace with your Web Client ID (for web/Expo Go) and iOS Client ID (for standalone)
const GOOGLE_WEB_CLIENT_ID = '487589350519-esmckfuchimjnlf96nm3j7d5j19adbl1.apps.googleusercontent.com';
// TODO: Replace with your actual iOS Client ID from Google Cloud Console
const GOOGLE_IOS_CLIENT_ID = '487589350519-njhmlbtte7vq4oc1edofetjs5539i57j.apps.googleusercontent.com';

const TOKEN_STORAGE_KEY = 'nexus_google_drive_token';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export const useGoogleDriveAuth = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: Platform.OS === 'ios'
      ? `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.split('.')[0]}`
      : 'nexus',
    path: 'oauth2redirect',
  });

  const clientId = Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_WEB_CLIENT_ID;

  const [request, response, promptAsync] = AuthSession.useAuthRequest({
    clientId,
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
  }, discovery);

  useEffect(() => {
    // Check for stored token on mount
    SecureStore.getItemAsync(TOKEN_STORAGE_KEY).then(token => {
      if (token) setAccessToken(token);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (response?.type === 'success' && request?.codeVerifier) {
      const { code } = response.params;
      
      AuthSession.exchangeCodeAsync({
        clientId,
        code,
        redirectUri,
        extraParams: {
          code_verifier: request.codeVerifier,
        }
      }, discovery)
      .then(tokenResult => {
        const token = tokenResult.accessToken;
        setAccessToken(token);
        SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token).catch(console.error);
      })
      .catch(err => {
        console.error('Token exchange failed:', err);
      });
    }
  }, [response, request]);

  const logout = async () => {
    setAccessToken(null);
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY).catch(console.error);
    await SecureStore.deleteItemAsync('nexus_vault_password').catch(console.error);
  };

  return { accessToken, request, promptAsync, logout };
};
