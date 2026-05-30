import * as WebBrowser from 'expo-web-browser';
import * as AuthSession from 'expo-auth-session';
import * as SecureStore from 'expo-secure-store';
import { useState, useEffect } from 'react';
import { Platform } from 'react-native';

WebBrowser.maybeCompleteAuthSession();

// Replace with your Web Client ID (for web/Expo Go) and iOS Client ID (for standalone)
const GOOGLE_WEB_CLIENT_ID = '487589350519-esmckfuchimjnlf96nm3j7d5j19adbl1.apps.googleusercontent.com';
const GOOGLE_IOS_CLIENT_ID = '487589350519-njhmlbtte7vq4oc1edofetjs5539i57j.apps.googleusercontent.com';

const TOKEN_STORAGE_KEY = 'nexus_google_drive_token';
const REFRESH_TOKEN_STORAGE_KEY = 'nexus_google_drive_refresh_token';

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

const redirectUri = Platform.OS === 'ios'
  ? `com.googleusercontent.apps.${GOOGLE_IOS_CLIENT_ID.split('.')[0]}:/`
  : AuthSession.makeRedirectUri({ scheme: 'nexus' });

const clientId = Platform.OS === 'ios' ? GOOGLE_IOS_CLIENT_ID : GOOGLE_WEB_CLIENT_ID;

/**
 * Robust helper function to refresh the Google Drive access token using the stored refresh token.
 */
export const refreshAccessToken = async (): Promise<string | null> => {
  try {
    const refreshToken = await SecureStore.getItemAsync(REFRESH_TOKEN_STORAGE_KEY).catch(() => null);
    if (!refreshToken) {
      console.log('No refresh token found in SecureStore');
      return null;
    }

    console.log('Refreshing Google access token...');
    const body = `client_id=${encodeURIComponent(clientId)}` +
                 `&grant_type=refresh_token` +
                 `&refresh_token=${encodeURIComponent(refreshToken)}`;

    const res = await fetch(discovery.tokenEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body,
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('Failed to refresh access token:', errorText);
      
      // If the refresh token is invalid or revoked (HTTP 400 with invalid_grant), clear credentials
      if (res.status === 400) {
        console.log('Refresh token is invalid or revoked. Clearing stored credentials.');
        await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY).catch(console.error);
        await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY).catch(console.error);
        await SecureStore.deleteItemAsync('nexus_vault_password').catch(console.error);
      }
      return null;
    }

    const data = await res.json();
    const newAccessToken = data.access_token;
    if (newAccessToken) {
      await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, newAccessToken);
      if (data.refresh_token) {
        await SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, data.refresh_token);
      }
      console.log('Access token successfully refreshed');
      return newAccessToken;
    }
    return null;
  } catch (err) {
    console.error('Error in refreshAccessToken:', err);
    return null;
  }
};

export const useGoogleDriveAuth = () => {
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const [request, response, promptAsync] = AuthSession.useAuthRequest({
    clientId,
    scopes: ['https://www.googleapis.com/auth/drive.appdata'],
    redirectUri,
    responseType: AuthSession.ResponseType.Code,
    usePKCE: true,
    extraParams: {
      access_type: 'offline',
      prompt: 'consent',
    }
  }, discovery);

  useEffect(() => {
    const initToken = async () => {
      // First, attempt to silently refresh the token using the refresh token
      const freshToken = await refreshAccessToken();
      if (freshToken) {
        setAccessToken(freshToken);
      } else {
        // Fallback to existing access token if no refresh token was present or refresh failed
        const existingToken = await SecureStore.getItemAsync(TOKEN_STORAGE_KEY).catch(() => null);
        if (existingToken) {
          setAccessToken(existingToken);
        }
      }
    };
    initToken();
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
        const refresh = tokenResult.refreshToken;
        
        setAccessToken(token);
        SecureStore.setItemAsync(TOKEN_STORAGE_KEY, token).catch(console.error);
        if (refresh) {
          SecureStore.setItemAsync(REFRESH_TOKEN_STORAGE_KEY, refresh).catch(console.error);
        }
      })
      .catch(err => {
        console.error('Token exchange failed:', err);
      });
    }
  }, [response, request]);

  const refresh = async (): Promise<string | null> => {
    const freshToken = await refreshAccessToken();
    if (freshToken) {
      setAccessToken(freshToken);
    } else {
      setAccessToken(null);
    }
    return freshToken;
  };

  const logout = async () => {
    setAccessToken(null);
    await SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY).catch(console.error);
    await SecureStore.deleteItemAsync(REFRESH_TOKEN_STORAGE_KEY).catch(console.error);
    await SecureStore.deleteItemAsync('nexus_vault_password').catch(console.error);
  };

  return { accessToken, request, promptAsync, logout, refresh };
};
