import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, Modal, TouchableOpacity, ScrollView, Switch, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { UserSettings } from '../types';
import SegmentedControl from './SegmentedControl';
import { calculateGoal } from '../storage';
import { exportVaultBackup, pickAndImportBackup } from '../backup';
import { Lock, Download, UploadCloud, Cloud, RefreshCw } from 'lucide-react-native';
import { useGoogleDriveAuth } from '../googleAuth';
import { performDriveSync } from '../sync';
import * as SecureStore from 'expo-secure-store';

interface SettingsModalProps {
  visible: boolean;
  onClose: () => void;
  settings: UserSettings;
  onSave: (settings: UserSettings) => void;
  // Fix B: Called when user enables Auto-Sync (while connected) — triggers immediate full sync
  onAutoSyncEnabled?: () => void;
  // Fix D1: Called after a successful manual import — reloads React state from AsyncStorage
  onImportComplete?: () => void;
}

export default function SettingsModal({ visible, onClose, settings, onSave, onAutoSyncEnabled, onImportComplete }: SettingsModalProps) {
  const [userName, setUserName] = useState(settings.userName || '');
  const [weight, setWeight] = useState(String(settings.weight));
  const [weightUnit, setWeightUnit] = useState<'kg' | 'lbs'>(settings.weightUnit);
  const [activityLevel, setActivityLevel] = useState<'sedentary' | 'moderate' | 'active'>(settings.activityLevel);
  const [useAutoGoal, setUseAutoGoal] = useState(settings.useAutoGoal);
  const [customGoal, setCustomGoal] = useState(String(settings.customGoal || 2500));
  const [wakeTime, setWakeTime] = useState(settings.wakeTime || '07:00');
  const [sleepTime, setSleepTime] = useState(settings.sleepTime || '22:00');
  const [lagNotificationsEnabled, setLagNotificationsEnabled] = useState(settings.lagNotificationsEnabled !== false);
  const [googleDriveAutoSyncEnabled, setGoogleDriveAutoSyncEnabled] = useState(settings.googleDriveAutoSyncEnabled !== false);
  const [wakeError, setWakeError] = useState(false);
  const [sleepError, setSleepError] = useState(false);

  // Backup State
  const [backupPassword, setBackupPassword] = useState('');
  const [backupError, setBackupError] = useState('');
  const [backupSuccess, setBackupSuccess] = useState('');
  const [isProcessingBackup, setIsProcessingBackup] = useState(false);

  // Google Drive Auth
  const { accessToken, request, promptAsync, logout } = useGoogleDriveAuth();
  const [syncStatus, setSyncStatus] = useState('');

  // Track previous visibility to detect open transition
  const prevVisibleRef = React.useRef(false);

  useEffect(() => {
    if (visible && settings) {
      setUserName(settings.userName || '');
      setWeight(String(settings.weight));
      setWeightUnit(settings.weightUnit);
      setActivityLevel(settings.activityLevel);
      setUseAutoGoal(settings.useAutoGoal);
      setCustomGoal(String(settings.customGoal || 2500));
      setWakeTime(settings.wakeTime || '07:00');
      setSleepTime(settings.sleepTime || '22:00');
      setLagNotificationsEnabled(settings.lagNotificationsEnabled !== false);
      setGoogleDriveAutoSyncEnabled(settings.googleDriveAutoSyncEnabled !== false);
      setWakeError(false);
      setSleepError(false);
      
      // Only clear backup status messages when the modal OPENS (false → true),
      // not on every settings prop change while already open
      if (!prevVisibleRef.current) {
        setBackupError('');
        setBackupSuccess('');
        setSyncStatus('');
      }

      // Pre-fill saved backup password
      SecureStore.getItemAsync('nexus_vault_password')
        .then(pwd => {
          if (pwd) setBackupPassword(pwd);
        })
        .catch(console.error);
    }
    prevVisibleRef.current = visible;
  }, [visible, settings]);

  // Fix C: Safety timeout — if isProcessingBackup gets stuck (e.g. share sheet doesn't resolve
  // on some iOS versions), auto-reset after 30 seconds so buttons never stay greyed out forever.
  useEffect(() => {
    if (!isProcessingBackup) return;
    const timer = setTimeout(() => {
      setIsProcessingBackup(false);
    }, 30000);
    return () => clearTimeout(timer);
  }, [isProcessingBackup]);

  // Fix B: Track previous accessToken to detect connect/disconnect transitions.
  // When the user connects Google Drive (null → token), auto-enable auto-sync and save immediately.
  // When the user disconnects (token → null), auto-disable auto-sync and save immediately.
  const prevAccessTokenRef = React.useRef<string | null | undefined>(undefined);
  useEffect(() => {
    const prev = prevAccessTokenRef.current;
    // Skip the very first render (undefined means not yet initialized)
    if (prev === undefined) {
      prevAccessTokenRef.current = accessToken;
      return;
    }
    if (!prev && accessToken) {
      // Just connected to Google Drive — auto-enable auto-sync and save
      setGoogleDriveAutoSyncEnabled(true);
      const updated: UserSettings = {
        ...settings,
        userName: userName.trim(),
        weight: parseFloat(weight) || 70,
        weightUnit,
        activityLevel,
        useAutoGoal,
        customGoal: useAutoGoal ? null : (parseInt(customGoal, 10) || 2500),
        wakeTime: wakeTime.trim() || '07:00',
        sleepTime: sleepTime.trim() || '22:00',
        lagNotificationsEnabled,
        googleDriveAutoSyncEnabled: true,
      };
      onSave(updated);
      // Immediate sync fires via handleAutoSyncEnabled in App.tsx
      onAutoSyncEnabled?.();
    } else if (prev && !accessToken) {
      // Just disconnected from Google Drive — auto-disable auto-sync and save
      setGoogleDriveAutoSyncEnabled(false);
      const updated: UserSettings = {
        ...settings,
        userName: userName.trim(),
        weight: parseFloat(weight) || 70,
        weightUnit,
        activityLevel,
        useAutoGoal,
        customGoal: useAutoGoal ? null : (parseInt(customGoal, 10) || 2500),
        wakeTime: wakeTime.trim() || '07:00',
        sleepTime: sleepTime.trim() || '22:00',
        lagNotificationsEnabled,
        googleDriveAutoSyncEnabled: false,
      };
      onSave(updated);
    }
    prevAccessTokenRef.current = accessToken;
  }, [accessToken]);

  const handleSave = () => {
    const timeRegex = /^(0[0-9]|1[0-9]|2[0-3]|[0-9]):[0-5][0-9]$/;
    const isWakeValid = timeRegex.test(wakeTime.trim());
    const isSleepValid = timeRegex.test(sleepTime.trim());

    setWakeError(!isWakeValid);
    setSleepError(!isSleepValid);

    if (!isWakeValid || !isSleepValid) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      return; // Block save if invalid
    }

    const updatedSettings: UserSettings = {
      ...settings,
      userName: userName.trim(),
      weight: parseFloat(weight) || 70,
      weightUnit,
      activityLevel,
      useAutoGoal,
      customGoal: useAutoGoal ? null : (parseInt(customGoal, 10) || 2500),
      wakeTime: wakeTime.trim(),
      sleepTime: sleepTime.trim(),
      lagNotificationsEnabled,
      googleDriveAutoSyncEnabled,
    };
    onSave(updatedSettings);
    onClose();
  };

  const tempSettings: UserSettings = {
    ...settings,
    userName: userName.trim(),
    weight: parseFloat(weight) || 70,
    weightUnit,
    activityLevel,
    useAutoGoal,
    customGoal: useAutoGoal ? null : (parseInt(customGoal, 10) || 2500),
    wakeTime: wakeTime.trim() || '07:00',
    sleepTime: sleepTime.trim() || '22:00',
    lagNotificationsEnabled,
  };
  const computedGoal = calculateGoal(tempSettings);

  const handleExport = async () => {
    if (!backupPassword || backupPassword.length < 4) {
      setBackupError('Password must be at least 4 characters');
      return;
    }
    setBackupError('');
    setBackupSuccess('');
    setIsProcessingBackup(true);
    try {
      await exportVaultBackup(backupPassword);
      // Fix C: Do NOT clear the password — keep it filled for repeated export/import without re-typing.
      // The 30s timeout safety net in the useEffect above handles any case where the share sheet
      // fails to resolve and setIsProcessingBackup(false) in finally doesn't fire.
      setBackupSuccess('Export successful!');
    } catch (err: any) {
      setBackupError(err.message || 'Export failed');
    } finally {
      setIsProcessingBackup(false);
    }
  };

  const handleImport = async () => {
    if (!backupPassword || backupPassword.length < 4) {
      setBackupError('Password required to import');
      return;
    }
    setBackupError('');
    setBackupSuccess('');
    setIsProcessingBackup(true);
    try {
      const imported = await pickAndImportBackup(backupPassword);
      if (imported) {
        // Fix D1: Don't tell user to restart — reload state immediately via callback.
        // onImportComplete reloads settings+logs in App.tsx and triggers an auto-push
        // to ensure Drive is updated with the merged import before next startup.
        setBackupSuccess('Import successful! Data merged.');
        onImportComplete?.();
      } else {
        setBackupError('Import cancelled: No file selected.');
      }
    } catch (err: any) {
      setBackupError(err.message || 'Import failed');
    } finally {
      setIsProcessingBackup(false);
    }
  };

  const handleDriveSync = async () => {
    if (!accessToken) return;
    if (!backupPassword || backupPassword.length < 4) {
      setBackupError('Password required for Google Drive Sync');
      return;
    }
    
    setIsProcessingBackup(true);
    setBackupError('');
    setBackupSuccess('');
    
    try {
      await performDriveSync(accessToken, backupPassword, (msg) => {
        setSyncStatus(msg);
      });
      
      // Save password securely in device keychain for seamless startup auto-syncs
      await SecureStore.setItemAsync('nexus_vault_password', backupPassword).catch(console.error);
      setBackupSuccess('Cloud sync completed successfully!');
      setSyncStatus('');
    } catch (err: any) {
      setBackupError(err.message || 'Sync failed');
      setSyncStatus('');
    } finally {
      setIsProcessingBackup(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.overlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.headerTitle}>Settings</Text>
            <TouchableOpacity onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onClose();
            }} style={styles.closeButton}>
              <View style={styles.closeIconBg}>
                <X size={20} color={theme.colors.text} />
              </View>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Profile Details</Text>
              </View>
              
              <View style={styles.row}>
                <Text style={styles.label}>Name</Text>
                <TextInput
                  style={styles.nameInput}
                  value={userName}
                  onChangeText={setUserName}
                  placeholder="Commander"
                  placeholderTextColor={theme.colors.textSubtle}
                  returnKeyType="done"
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.label}>Weight</Text>
                <View style={styles.weightInputContainer}>
                  <TextInput
                    style={styles.input}
                    keyboardType="numeric"
                    value={weight}
                    onChangeText={setWeight}
                    placeholderTextColor={theme.colors.textSubtle}
                    returnKeyType="done"
                  />
                  <View style={{ width: 100 }}>
                    <SegmentedControl
                      values={['kg', 'lbs'] as const}
                      selectedValue={weightUnit}
                      onChange={setWeightUnit}
                    />
                  </View>
                </View>
              </View>

              <View style={styles.divider} />

              <View style={styles.rowVertical}>
                <Text style={styles.label}>Activity Level</Text>
                <SegmentedControl
                  values={['sedentary', 'moderate', 'active'] as const}
                  selectedValue={activityLevel}
                  onChange={setActivityLevel}
                  labels={['Sedentary', 'Moderate', 'Active']}
                />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Goals</Text>
              </View>
              
              <View style={styles.row}>
                <View style={styles.textStack}>
                  <Text style={styles.label}>Auto-Calculate Target</Text>
                  <Text style={styles.subtext}>Based on weight and activity</Text>
                </View>
                <Switch
                  value={useAutoGoal}
                  onValueChange={(val) => {
                    setUseAutoGoal(val);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  trackColor={{ false: theme.colors.surface, true: '#34C759' }}
                  ios_backgroundColor={theme.colors.surface}
                />
              </View>

              <View style={styles.divider} />

              <View style={styles.row}>
                <Text style={styles.label}>Daily Target</Text>
                {useAutoGoal ? (
                  <Text style={styles.calculatedGoal}>{computedGoal} ml</Text>
                ) : (
                  <TextInput
                    style={[styles.input, styles.targetInput]}
                    keyboardType="numeric"
                    value={customGoal}
                    onChangeText={setCustomGoal}
                    placeholder="2500"
                    placeholderTextColor={theme.colors.textSubtle}
                    returnKeyType="done"
                  />
                )}
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Schedule & Reminders</Text>
              </View>
              
              <View style={styles.row}>
                <View style={styles.textStack}>
                  <Text style={styles.label}>Wake Time</Text>
                  <Text style={styles.subtext}>Curve alignment start (e.g. 07:00)</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.targetInput, wakeError && styles.inputError]}
                  value={wakeTime}
                  onChangeText={(text) => {
                    setWakeTime(text);
                    if (wakeError) setWakeError(false);
                  }}
                  placeholder="07:00"
                  placeholderTextColor={theme.colors.textSubtle}
                  returnKeyType="done"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
              {wakeError && (
                <Text style={styles.errorText}>Please enter a valid 24h format (e.g., 07:30)</Text>
              )}

              <View style={styles.divider} />

              <View style={styles.row}>
                <View style={styles.textStack}>
                  <Text style={styles.label}>Sleep Time</Text>
                  <Text style={styles.subtext}>Active duration target (e.g. 22:00)</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.targetInput, sleepError && styles.inputError]}
                  value={sleepTime}
                  onChangeText={(text) => {
                    setSleepTime(text);
                    if (sleepError) setSleepError(false);
                  }}
                  placeholder="22:00"
                  placeholderTextColor={theme.colors.textSubtle}
                  returnKeyType="done"
                  autoCorrect={false}
                  autoCapitalize="none"
                />
              </View>
              {sleepError && (
                <Text style={styles.errorText}>Please enter a valid 24h format (e.g., 23:15)</Text>
              )}

              <View style={styles.row}>
                <View style={styles.textStack}>
                   <Text style={styles.label}>Lag Notifications</Text>
                   <Text style={styles.subtext}>Receive system notifications when falling behind your hydration schedule</Text>
                </View>
                <Switch
                  value={lagNotificationsEnabled}
                  onValueChange={(val) => {
                    setLagNotificationsEnabled(val);
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  }}
                  trackColor={{ false: theme.colors.surface, true: '#34C759' }}
                  ios_backgroundColor={theme.colors.surface}
                />
              </View>
            </View>

            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>Data Vault (Local-First)</Text>
              </View>
              
              <View style={[styles.rowVertical, { paddingBottom: 8 }]}>
                <Text style={styles.subtext}>
                  Export or import your entire NEXUS state as an AES-256-GCM encrypted .nexus bundle. 
                  Provide a password to secure your export or decrypt an import.
                </Text>
                
                <View style={styles.passwordContainer}>
                  <Lock size={16} color={theme.colors.textSubtle} style={{ marginRight: 8 }} />
                  <TextInput
                    style={styles.passwordInput}
                    value={backupPassword}
                    onChangeText={(t) => { setBackupPassword(t); setBackupError(''); setBackupSuccess(''); }}
                    placeholder="Encryption Password"
                    placeholderTextColor={theme.colors.textSubtle}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
                <Text style={styles.passwordHelper}>
                  This password encrypts your cloud backup. Use the same password on all devices.
                </Text>

                {!!backupError && <Text style={styles.errorText}>{backupError}</Text>}
                {!!backupSuccess && <Text style={[styles.errorText, { color: theme.colors.accentGreen }]}>{backupSuccess}</Text>}

                <View style={styles.backupButtonsRow}>
                  <TouchableOpacity 
                    style={[styles.backupBtn, isProcessingBackup && { opacity: 0.5 }]} 
                    onPress={handleExport}
                    disabled={isProcessingBackup}
                  >
                    <UploadCloud size={18} color={theme.colors.background} />
                    <Text style={styles.backupBtnText}>Export</Text>
                  </TouchableOpacity>
                  
                  <TouchableOpacity 
                    style={[styles.backupBtn, styles.backupBtnSecondary, isProcessingBackup && { opacity: 0.5 }]} 
                    onPress={handleImport}
                    disabled={isProcessingBackup}
                  >
                    <Download size={18} color={theme.colors.text} />
                    <Text style={[styles.backupBtnText, { color: theme.colors.text }]}>Import</Text>
                  </TouchableOpacity>
                </View>
                
                {/* Cloud Sync UI */}
                <View style={[styles.divider, { marginVertical: 16, marginLeft: 0 }]} />
                <View style={styles.cloudSyncContainer}>
                  <Text style={styles.label}>Google Drive Sync</Text>
                  <Text style={styles.subtext}>
                    Securely sync your encrypted vault to a hidden Google Drive folder.
                  </Text>
                  
                  <View style={[styles.row, { paddingHorizontal: 0, paddingVertical: 12, marginTop: 4 }]}>
                    <View style={styles.textStack}>
                      {/* Fix B: Renamed from "Auto-Sync on Startup" — the toggle controls both
                          startup sync AND background auto-push after every mutation. */}
                      <Text style={[styles.label, { fontSize: 16, opacity: !accessToken ? 0.4 : 1 }]}>Auto-Sync</Text>
                      <Text style={[styles.subtext, { opacity: !accessToken ? 0.4 : 1 }]}>
                        Automatically sync your vault with Google Drive on launch and after every change
                      </Text>
                    </View>
                    <Switch
                      value={googleDriveAutoSyncEnabled}
                      onValueChange={(val) => {
                        if (!accessToken) return; // Should not be reachable, but guard anyway
                        setGoogleDriveAutoSyncEnabled(val);
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                        // Fix B: Save immediately — don't wait for the "Save Changes" button.
                        // The toggle must persist right away since it controls sync behavior.
                        const updated: UserSettings = {
                          ...settings,
                          userName: userName.trim(),
                          weight: parseFloat(weight) || 70,
                          weightUnit,
                          activityLevel,
                          useAutoGoal,
                          customGoal: useAutoGoal ? null : (parseInt(customGoal, 10) || 2500),
                          wakeTime: wakeTime.trim() || '07:00',
                          sleepTime: sleepTime.trim() || '22:00',
                          lagNotificationsEnabled,
                          googleDriveAutoSyncEnabled: val,
                        };
                        onSave(updated);
                        // If enabling, trigger an immediate full sync
                        if (val) {
                          onAutoSyncEnabled?.();
                        }
                      }}
                      trackColor={{ false: theme.colors.surface, true: '#34C759' }}
                      ios_backgroundColor={theme.colors.surface}
                      // Fix B: Disable the switch when not connected to Google Drive.
                      // It's meaningless to enable auto-sync without a Drive connection.
                      disabled={!accessToken}
                    />
                  </View>
                  
                  {!accessToken ? (
                    <TouchableOpacity 
                      style={[styles.backupBtn, { marginTop: 12 }]} 
                      onPress={() => {
                        if (!request) {
                          alert('Auth request is not ready yet. Please try again.');
                          return;
                        }
                        promptAsync();
                      }}
                    >
                      <Cloud size={18} color={theme.colors.background} />
                      <Text style={styles.backupBtnText}>Connect Google Drive</Text>
                    </TouchableOpacity>
                  ) : (
                    <View style={{ marginTop: 12, gap: 8 }}>
                      <View style={{ flexDirection: 'row', gap: 12 }}>
                        <TouchableOpacity 
                          style={[styles.backupBtn, isProcessingBackup && { opacity: 0.5 }]} 
                          onPress={handleDriveSync}
                          disabled={isProcessingBackup}
                        >
                          <RefreshCw size={18} color={theme.colors.background} />
                          <Text style={styles.backupBtnText}>Sync Now</Text>
                        </TouchableOpacity>

                        <TouchableOpacity 
                          style={[styles.backupBtn, styles.backupBtnSecondary, { flex: 0.5 }]} 
                          onPress={async () => {
                            // Fix B: After logout, the accessToken transition useEffect will
                            // automatically set googleDriveAutoSyncEnabled = false and save.
                            await logout();
                          }}
                          disabled={isProcessingBackup}
                        >
                          <Text style={[styles.backupBtnText, { color: theme.colors.text }]}>Disconnect</Text>
                        </TouchableOpacity>
                      </View>
                      {!!syncStatus && <Text style={[styles.subtext, { textAlign: 'center', marginTop: 4 }]}>{syncStatus}</Text>}
                    </View>
                  )}
                </View>
              </View>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave}>
              <Text style={styles.saveBtnText}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '90%',
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
    position: 'relative',
  },
  headerTitle: {
    fontFamily: theme.typography.bold,
    fontSize: 18,
    color: theme.colors.text,
  },
  closeButton: {
    position: 'absolute',
    right: 16,
    top: 14,
  },
  closeIconBg: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: 15,
    padding: 4,
  },
  scrollBody: {
    padding: theme.spacing.lg,
  },
  card: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    marginBottom: theme.spacing.xl,
    overflow: 'hidden',
  },
  cardHeader: {
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.sm,
  },
  cardTitle: {
    fontFamily: theme.typography.semibold,
    fontSize: 13,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
  },
  rowVertical: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    gap: 12,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
    marginLeft: theme.spacing.md,
  },
  label: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    color: theme.colors.text,
  },
  textStack: {
    flex: 1,
    paddingRight: 16,
  },
  subtext: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.textSubtle,
    marginTop: 2,
  },
  weightInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  nameInput: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 160,
    textAlign: 'right',
  },
  input: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    color: theme.colors.text,
    backgroundColor: theme.colors.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 80,
    textAlign: 'center',
  },
  targetInput: {
    minWidth: 100,
  },
  calculatedGoal: {
    fontFamily: theme.typography.semibold,
    fontSize: 17,
    color: theme.colors.textMuted,
  },
  unitToggle: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    padding: 2,
  },
  unitBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  unitBtnActive: {
    backgroundColor: theme.colors.surfaceElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  unitBtnText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    fontWeight: theme.typography.weight.medium,
    color: theme.colors.textMuted,
  },
  unitBtnTextActive: {
    color: theme.colors.text,
    fontWeight: theme.typography.weight.bold,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    padding: 2,
  },
  segmentBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
    borderRadius: 6,
  },
  segmentBtnActive: {
    backgroundColor: theme.colors.surfaceElevated,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  segmentBtnText: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
    fontWeight: theme.typography.weight.medium,
  },
  segmentBtnTextActive: {
    color: theme.colors.text,
    fontWeight: theme.typography.weight.semibold,
  },
  footer: {
    padding: theme.spacing.lg,
    paddingBottom: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
  },
  saveBtn: {
    backgroundColor: theme.colors.text,
    paddingVertical: 16,
    borderRadius: theme.borderRadius.md,
    alignItems: 'center',
  },
  saveBtnText: {
    fontFamily: theme.typography.semibold,
    fontSize: 17,
    color: '#000000',
  },
  inputError: {
    borderColor: theme.colors.accentRed,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.accentRed,
    paddingHorizontal: theme.spacing.md,
    paddingBottom: 8,
    marginTop: -4,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.background,
    borderRadius: 8,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  passwordInput: {
    flex: 1,
    fontFamily: theme.typography.sans,
    fontSize: 15,
    color: theme.colors.text,
  },
  backupButtonsRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  backupBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: theme.colors.text,
    paddingVertical: 12,
    borderRadius: theme.borderRadius.md,
  },
  backupBtnSecondary: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  backupBtnText: {
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: '#000',
  },
  cloudSyncContainer: {
    marginTop: 8,
  },
  passwordHelper: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textSubtle,
    marginTop: 6,
    paddingHorizontal: 4,
    lineHeight: 16,
  },
});
