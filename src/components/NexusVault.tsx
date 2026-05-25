import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Animated, PanResponder, KeyboardAvoidingView, Platform, Keyboard, TextInput } from 'react-native';
import { Droplet, Dumbbell, DollarSign, BookOpen, Settings, ArrowUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { UserSettings } from '../types';

interface NexusVaultProps {
  settings: UserSettings;
  onOpenSettings: () => void;
  onSelectApp: (app: 'hydration') => void;
  onShowLockedAlert: (moduleName: string) => void;
  onUpdateSettings: (settings: UserSettings) => void;
  activeDaysCount: number;
  onLogDrinkDirect?: (amount: number, type: string, isDecafOverride?: boolean) => void;
}

const MODULE_CONFIG: Record<string, any> = {
  hydration: {
    id: 'hydration',
    title: 'Hydration',
    desc: 'Track daily water intake and compliance.',
    icon: Droplet,
    color: theme.colors.accent,
    bg: 'rgba(10, 132, 255, 0.15)',
    locked: false,
  },
  training: {
    id: 'training',
    title: 'Training',
    desc: 'Log workouts, sets, and progress.',
    icon: Dumbbell,
    color: theme.colors.textMuted,
    bg: 'rgba(142, 142, 147, 0.1)',
    locked: true,
  },
  capital: {
    id: 'capital',
    title: 'Capital',
    desc: 'Manage assets and monitor cash flow.',
    icon: DollarSign,
    color: theme.colors.textMuted,
    bg: 'rgba(142, 142, 147, 0.1)',
    locked: true,
  },
  knowledge: {
    id: 'knowledge',
    title: 'Knowledge',
    desc: 'Store and connect your ideas.',
    icon: BookOpen,
    color: theme.colors.textMuted,
    bg: 'rgba(142, 142, 147, 0.1)',
    locked: true,
  }
};

const CARD_HEIGHT = 92;
const CARD_MARGIN = 16;
const CARD_SIZE = CARD_HEIGHT + CARD_MARGIN;

export default function NexusVault({ settings, onOpenSettings, onSelectApp, onShowLockedAlert, onUpdateSettings, activeDaysCount, onLogDrinkDirect }: NexusVaultProps) {
  const [greeting, setGreeting] = useState('');

  const [order, setOrder] = useState<string[]>(settings.moduleOrder || ['hydration', 'training', 'capital', 'knowledge']);
  const orderRef = useRef(order);
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [pressingId, setPressingId] = useState<string | null>(null);

  const longPressTimer = useRef<NodeJS.Timeout | null>(null);
  const isDraggingRef = useRef(false);
  const settingsRef = useRef(settings);
  const onUpdateSettingsRef = useRef(onUpdateSettings);
  const onSelectAppRef = useRef(onSelectApp);
  const onShowLockedAlertRef = useRef(onShowLockedAlert);

  const [inputVal, setInputVal] = useState('');
  const [showHelp, setShowHelp] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [viewMenu, setViewMenu] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleCloseHelp = () => {
    setShowHelp(false);
    setViewMenu(false);
  };

  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(null), 4000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  const triggerError = (msg: string) => {
    setErrorMsg(msg);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  };

  const handleSubmit = () => {
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    if (trimmed.toLowerCase() === '/help') {
      setInputVal('');
      setShowHelp(true);
      inputRef.current?.blur();
      Keyboard.dismiss();
      return;
    }

    if (!trimmed.startsWith('/')) {
      triggerError('Invalid format. Commands must start with /');
      return;
    }

    const parts = trimmed.split(/\s+/);
    const command = parts[0].toLowerCase();

    if (command !== '/wt') {
      triggerError(`Unknown command: "${command}". Type /help`);
      return;
    }

    if (parts.length < 3) {
      triggerError('Usage: /wt [decaf] <beverage> <volume>');
      return;
    }

    // Advanced space-padded parsing: take last token as volume, and intermediate as beverage
    const volumeStr = parts[parts.length - 1];
    const amount = parseInt(volumeStr, 10);

    if (isNaN(amount) || amount <= 0) {
      triggerError('Volume must be a positive number (ml) at the end of the command.');
      return;
    }

    let beverageInput = parts.slice(1, parts.length - 1).join(' ').toLowerCase().trim();

    // Check explicit decaf prefix or suffix overrides
    let isDecafOverride: boolean | undefined = undefined;
    if (beverageInput.startsWith('decaf ')) {
      isDecafOverride = true;
      beverageInput = beverageInput.substring(6).trim();
    } else if (beverageInput.endsWith(' decaf')) {
      isDecafOverride = true;
      beverageInput = beverageInput.substring(0, beverageInput.length - 6).trim();
    }

    // Space and hyphen normalization helper
    const normalizeName = (str: string) => str.toLowerCase().replace(/[-\s]+/g, ' ').trim();
    const normalizedSearch = normalizeName(beverageInput);

    const standardTypes = ['water', 'coffee', 'tea', 'soda', 'juice', 'sports-drink', 'beer', 'wine'];
    const customTypes = settings?.customLiquids ? Object.keys(settings.customLiquids) : [];
    const validTypes = [...standardTypes, ...customTypes];

    const matchedType = validTypes.find(t => {
      const normalizedKey = normalizeName(t);
      if (normalizedKey === normalizedSearch) return true;
      
      const label = settings?.customLiquids?.[t]?.label || '';
      return normalizeName(label) === normalizedSearch;
    });

    if (!matchedType) {
      triggerError(`Beverage "${beverageInput}" not found. Type /help for menu.`);
      return;
    }

    if (onLogDrinkDirect) {
      setInputVal('');
      inputRef.current?.blur();
      Keyboard.dismiss();
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      
      // Delay to let keyboard dismiss fully and avoid focus competition layout freezes
      setTimeout(() => {
        onLogDrinkDirect(amount, matchedType, isDecafOverride);
      }, 150);
    }
  };

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    onUpdateSettingsRef.current = onUpdateSettings;
  }, [onUpdateSettings]);

  useEffect(() => {
    onSelectAppRef.current = onSelectApp;
  }, [onSelectApp]);

  useEffect(() => {
    onShowLockedAlertRef.current = onShowLockedAlert;
  }, [onShowLockedAlert]);

  const panY = useRef(new Animated.Value(0)).current;
  const positionAnim = useRef<Record<string, Animated.Value>>({
    hydration: new Animated.Value(0),
    training: new Animated.Value(0),
    capital: new Animated.Value(0),
    knowledge: new Animated.Value(0),
  }).current;

  useEffect(() => {
    orderRef.current.forEach((id, index) => {
      positionAnim[id].setValue(index * CARD_SIZE);
    });
  }, []);

  const panResponders = useRef<Record<string, any>>({}).current;

  if (Object.keys(panResponders).length === 0) {
    ['hydration', 'training', 'capital', 'knowledge'].forEach(id => {
      let startY = 0;
      panResponders[id] = PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => !isDraggingRef.current,
        onPanResponderGrant: () => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          isDraggingRef.current = false;
          setPressingId(id);

          const currentIndex = orderRef.current.indexOf(id);
          startY = currentIndex * CARD_SIZE;

          longPressTimer.current = setTimeout(() => {
            isDraggingRef.current = true;
            setPressingId(null);
            setDraggingId(id);
            panY.setValue(startY);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }, 350);
        },
        onPanResponderMove: (_, gestureState) => {
          if (!isDraggingRef.current) {
            // Cancel hold if finger is dragged away too far
            if (Math.abs(gestureState.dy) > 8 || Math.abs(gestureState.dx) > 8) {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
              setPressingId(null);
            }
            return;
          }

          const newY = startY + gestureState.dy;
          panY.setValue(newY);

          // collision detection
          const hoverIndex = Math.max(0, Math.min(3, Math.round(newY / CARD_SIZE)));
          const currentIndex = orderRef.current.indexOf(id);

          if (hoverIndex !== currentIndex) {
            Haptics.selectionAsync();
            const newOrder = [...orderRef.current];
            newOrder.splice(currentIndex, 1);
            newOrder.splice(hoverIndex, 0, id);
            orderRef.current = newOrder;

            // animate others
            newOrder.forEach((itemId, idx) => {
              if (itemId !== id) {
                Animated.spring(positionAnim[itemId], {
                  toValue: idx * CARD_SIZE,
                  useNativeDriver: true,
                  bounciness: 0,
                }).start();
              }
            });
          }
        },
        onPanResponderRelease: () => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          setPressingId(null);

          if (!isDraggingRef.current) {
            // Tap!
            const config = MODULE_CONFIG[id];
            if (!config.locked) {
              onSelectAppRef.current('hydration');
            } else {
              onShowLockedAlertRef.current(config.title);
            }
            return;
          }

          const finalIndex = orderRef.current.indexOf(id);
          Animated.spring(panY, {
            toValue: finalIndex * CARD_SIZE,
            useNativeDriver: true,
            bounciness: 0,
          }).start(() => {
             positionAnim[id].setValue(finalIndex * CARD_SIZE);
             isDraggingRef.current = false;
             setDraggingId(null);
             setOrder([...orderRef.current]);
             onUpdateSettingsRef.current({ ...settingsRef.current, moduleOrder: orderRef.current });
          });
        },
        onPanResponderTerminate: () => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
          setPressingId(null);

          if (isDraggingRef.current) {
            const finalIndex = orderRef.current.indexOf(id);
            Animated.spring(panY, {
              toValue: finalIndex * CARD_SIZE,
              useNativeDriver: true,
              bounciness: 0,
            }).start(() => {
               positionAnim[id].setValue(finalIndex * CARD_SIZE);
               isDraggingRef.current = false;
               setDraggingId(null);
               setOrder([...orderRef.current]);
               onUpdateSettingsRef.current({ ...settingsRef.current, moduleOrder: orderRef.current });
            });
          } else {
            isDraggingRef.current = false;
            setDraggingId(null);
          }
        }
      });
    });
  }

  useEffect(() => {
    const name = settings.userName ? settings.userName : '';
    const hour = new Date().getHours();
    
    let timeGreeting = '';
    if (hour >= 0 && hour < 4) timeGreeting = 'Good night';
    else if (hour < 12) timeGreeting = 'Good morning';
    else if (hour < 18) timeGreeting = 'Good afternoon';
    else timeGreeting = 'Good evening';

    const generalGreetings = name 
      ? [
          `${timeGreeting}, ${name}.`,
          `Welcome back, ${name}.`,
          `Good to see you, ${name}.`,
          `Hey there, ${name}.`,
          `Ready to conquer the day, ${name}?`,
          `Awaiting orders, Commander ${name}.`,
          `System online, ${name}.`
        ]
      : [
          `${timeGreeting}.`,
          'Welcome back.',
          'Good to see you.',
          'System online.',
          'Awaiting orders.',
          'Ready to conquer the day?'
        ];

    const randomGreeting = generalGreetings[Math.floor(Math.random() * generalGreetings.length)];
    setGreeting(randomGreeting);
  }, [settings.userName]);

  return (
    <KeyboardAvoidingView 
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'} 
      keyboardVerticalOffset={Platform.OS === 'ios' ? 60 : 0}
      style={{ flex: 1 }}
    >
      <View style={{ flex: 1 }}>
        <ScrollView 
          style={styles.container} 
          contentContainerStyle={styles.content}
          scrollEnabled={draggingId === null}
          keyboardDismissMode="on-drag"
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.headerTop}>
              <Text style={styles.title}>N E X U S</Text>
              <TouchableOpacity onPress={onOpenSettings} style={styles.settingsBtn}>
                <Settings size={22} color={theme.colors.textMuted} />
              </TouchableOpacity>
            </View>
            <Text style={styles.subtitle}>{greeting}</Text>
          </View>

          <View style={[styles.grid, { height: 4 * CARD_SIZE }]}>
            {order.map((id) => {
              const config = MODULE_CONFIG[id];
              const isDragging = draggingId === id;
              const isPressing = pressingId === id;
              const IconComponent = config.icon;

              let scale = 1.0;
              if (isDragging) scale = 1.04;
              else if (isPressing) scale = 0.97;

              let opacity = 1.0;
              if (config.locked) opacity = 0.5;
              else if (isDragging) opacity = 1.0;
              else if (draggingId !== null) opacity = 0.6;
              else if (isPressing) opacity = 0.85;

              return (
                <Animated.View
                  key={id}
                  style={[
                    styles.cardWrapper,
                    {
                      transform: [
                        { translateY: isDragging ? panY : positionAnim[id] },
                        { scale: scale }
                      ],
                      zIndex: isDragging ? 100 : 1,
                      opacity: opacity,
                    }
                  ]}
                  {...panResponders[id].panHandlers}
                >
                  <View 
                    style={[
                      styles.card, 
                      config.locked && styles.lockedCard,
                      isDragging && styles.draggedCard
                    ]}
                  >
                    <View style={[styles.iconBox, { backgroundColor: config.bg }]}>
                      <IconComponent size={28} color={config.color} />
                    </View>
                    <View style={styles.cardContent}>
                      <Text style={styles.cardTitle}>{config.title}</Text>
                      <Text style={styles.cardDesc}>{config.desc}</Text>
                    </View>
                  </View>
                </Animated.View>
              );
            })}
          </View>

          <View style={styles.diagnosticsBlock}>
            <Text style={styles.diagTitle}>System Status</Text>
            <View style={styles.diagRow}>
              <Text style={styles.diagLabel}>Version</Text>
              <Text style={styles.diagValue}>1.0.0</Text>
            </View>
            <View style={styles.diagRow}>
              <Text style={styles.diagLabel}>Storage</Text>
              <Text style={styles.diagValue}>Encrypted Local</Text>
            </View>
            <View style={[styles.diagRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.diagLabel}>History</Text>
              <Text style={styles.diagValue}>{activeDaysCount} Days</Text>
            </View>
          </View>
        </ScrollView>

        {/* Console command palette */}
        <View style={styles.consoleContainer}>
          {errorMsg ? (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={styles.consoleInputContainer}>
            <TextInput
              ref={inputRef}
              style={styles.consoleTextInput}
              value={inputVal}
              onChangeText={setInputVal}
              placeholder="/help"
              placeholderTextColor={theme.colors.textMuted}
              keyboardType="default"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <TouchableOpacity 
              style={[styles.consoleSubmitBtn, !!inputVal.trim() && { backgroundColor: theme.colors.accent }]} 
              onPress={handleSubmit}
              activeOpacity={0.7}
            >
              <ArrowUp size={18} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {/* Sleek help overlay */}
      {showHelp && (
        <View style={styles.helpOverlay}>
          <TouchableOpacity 
            activeOpacity={1} 
            style={styles.helpOverlayBackdrop} 
            onPress={handleCloseHelp} 
          />
          <View style={styles.helpBox}>
            <View style={styles.helpHeader}>
              <Text style={styles.helpTitle}>{viewMenu ? 'Supported Drinks' : 'Vault Console'}</Text>
              <TouchableOpacity onPress={handleCloseHelp} style={styles.helpCloseBtn}>
                <Text style={styles.helpCloseText}>✕</Text>
              </TouchableOpacity>
            </View>
            
            {viewMenu ? (
              <ScrollView style={styles.helpScroll} showsVerticalScrollIndicator={true}>
                <Text style={styles.helpIntro}>
                  Use any of these names (case-insensitive) in your <Text style={styles.codeText}>/wt</Text> commands:
                </Text>
                
                <View style={styles.menuSection}>
                  <Text style={styles.menuSecTitle}>Standard Beverages</Text>
                  <View style={styles.menuGrid}>
                    <View style={styles.menuItem}><Text style={styles.menuItemKey}>water</Text><Text style={styles.menuItemLabel}>Water</Text></View>
                    <View style={styles.menuItem}><Text style={styles.menuItemKey}>coffee</Text><Text style={styles.menuItemLabel}>Coffee</Text></View>
                    <View style={styles.menuItem}><Text style={styles.menuItemKey}>tea</Text><Text style={styles.menuItemLabel}>Tea</Text></View>
                    <View style={styles.menuItem}><Text style={styles.menuItemKey}>soda</Text><Text style={styles.menuItemLabel}>Soda</Text></View>
                    <View style={styles.menuItem}><Text style={styles.menuItemKey}>juice</Text><Text style={styles.menuItemLabel}>Juice</Text></View>
                    <View style={styles.menuItem}><Text style={styles.menuItemKey}>sports drink</Text><Text style={styles.menuItemLabel}>Isotonic</Text></View>
                    <View style={styles.menuItem}><Text style={styles.menuItemKey}>beer</Text><Text style={styles.menuItemLabel}>Beer</Text></View>
                    <View style={styles.menuItem}><Text style={styles.menuItemKey}>wine</Text><Text style={styles.menuItemLabel}>Wine</Text></View>
                  </View>
                </View>

                {settings.customLiquids && Object.keys(settings.customLiquids).length > 0 ? (
                  <View style={styles.menuSection}>
                    <Text style={styles.menuSecTitle}>Your Synthesized Formulas</Text>
                    <View style={styles.menuGrid}>
                      {Object.keys(settings.customLiquids).map(key => {
                        const config = settings.customLiquids![key];
                        return (
                          <View key={key} style={styles.menuItem}>
                            <Text style={styles.menuItemKey}>{key}</Text>
                            <Text style={styles.menuItemLabel} numberOfLines={1}>{config.label}</Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                ) : null}
                <TouchableOpacity 
                  style={[styles.menuToggleBtn, { marginTop: 16, alignSelf: 'center', marginBottom: 24 }]} 
                  onPress={() => setViewMenu(false)}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuToggleBtnText}>Back to Commands</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              <ScrollView style={styles.helpScroll} showsVerticalScrollIndicator={false}>
                <Text style={styles.helpIntro}>
                  Manage your modules and log metrics directly using command-line syntax.
                </Text>
                
                <View style={styles.commandRow}>
                  <Text style={styles.commandSyntax}>/wt [decaf] &lt;beverage&gt; &lt;volume&gt;</Text>
                  <Text style={styles.commandDesc}>
                    Logs fluid in the tracker. Supports spaces in names and explicit decaf overrides.
                  </Text>
                  <Text style={styles.commandExample}>
                    Examples:{"\n"}
                    • <Text style={styles.codeText}>/wt water 250</Text>{"\n"}
                    • <Text style={styles.codeText}>/wt decaf coffee 150</Text>{"\n"}
                    • <Text style={styles.codeText}>/wt sports drink 500</Text>
                  </Text>
                  <TouchableOpacity 
                    style={[styles.menuToggleBtn, { marginTop: 12, alignSelf: 'flex-start' }]} 
                    onPress={() => setViewMenu(true)}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.menuToggleBtnText}>View Supported Drinks</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.commandRow}>
                  <Text style={styles.commandSyntax}>/help</Text>
                  <Text style={styles.commandDesc}>
                    Displays this console reference guide.
                  </Text>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  content: {
    padding: theme.spacing.lg,
    paddingTop: 50,
    paddingBottom: theme.spacing.lg,
  },
  header: {
    marginBottom: 40,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 42,
    color: theme.colors.text,
    letterSpacing: 8, 
    marginLeft: 4, // offset for the letter spacing
  },
  settingsBtn: {
    padding: 8,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.round,
  },
  subtitle: {
    fontFamily: theme.typography.sans,
    fontSize: 16,
    color: theme.colors.textMuted,
    lineHeight: 22,
  },
  grid: {
    position: 'relative',
    marginBottom: 40,
  },
  cardWrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: CARD_HEIGHT,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    padding: 16,
    height: CARD_HEIGHT,
  },
  lockedCard: {
    opacity: 0.5,
  },
  draggedCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    backgroundColor: theme.colors.surfaceElevated,
  },
  iconBox: {
    width: 60,
    height: 60,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  cardContent: {
    flex: 1,
  },
  cardTitle: {
    fontFamily: theme.typography.sans,
    fontSize: 18,
    fontWeight: theme.typography.weight.semibold,
    color: theme.colors.text,
    marginBottom: 4,
  },
  cardDesc: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
  },
  diagnosticsBlock: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: 20,
  },
  diagTitle: {
    fontFamily: theme.typography.sans,
    fontSize: 15,
    fontWeight: theme.typography.weight.semibold,
    color: theme.colors.text,
    marginBottom: 16,
  },
  diagRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  diagLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 15,
    color: theme.colors.textMuted,
  },
  diagValue: {
    fontFamily: theme.typography.sans,
    fontSize: 15,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.medium,
  },
  consoleContainer: {
    marginHorizontal: 12,
    marginBottom: Platform.OS === 'ios' ? 12 : 8,
    backgroundColor: 'rgba(28, 28, 30, 0.96)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: theme.colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 6,
    padding: 4,
  },
  consoleInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingHorizontal: 16,
    height: 48,
  },
  consoleTextInput: {
    flex: 1,
    color: theme.colors.text,
    fontFamily: theme.typography.sans,
    fontSize: 15,
    height: '100%',
  },
  consoleSubmitBtn: {
    backgroundColor: theme.colors.surface,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorBanner: {
    backgroundColor: 'rgba(255, 69, 58, 0.15)',
    borderColor: '#ff453a',
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 8,
  },
  errorText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: '#ff453a',
    textAlign: 'center',
    fontWeight: theme.typography.weight.medium,
  },
  helpOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 200,
  },
  helpOverlayBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
  },
  helpBox: {
    width: '85%',
    height: '75%',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    padding: theme.spacing.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 15,
    elevation: 10,
  },
  helpHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: theme.spacing.md,
  },
  helpTitle: {
    fontFamily: theme.typography.sans,
    fontSize: 18,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
  },
  helpCloseBtn: {
    padding: 4,
  },
  helpCloseText: {
    color: theme.colors.textMuted,
    fontSize: 16,
  },
  helpScroll: {
    flexGrow: 0,
  },
  helpIntro: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    color: theme.colors.textMuted,
    lineHeight: 20,
    marginBottom: theme.spacing.lg,
  },
  commandRow: {
    marginBottom: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.05)',
  },
  commandSyntax: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 15,
    color: theme.colors.accent,
    marginBottom: 4,
  },
  commandDesc: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 18,
    marginBottom: 4,
  },
  commandExample: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  codeText: {
    color: '#ff9f0a',
    fontFamily: theme.typography.sans,
  },
  menuSection: {
    marginBottom: 16,
  },
  menuSecTitle: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  menuGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  menuItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    width: '47%',
    justifyContent: 'center',
  },
  menuItemKey: {
    fontFamily: 'Outfit_600SemiBold',
    fontSize: 14,
    color: theme.colors.accent,
    marginBottom: 2,
  },
  menuItemLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
  },
  menuFooterBtnRow: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    paddingTop: 12,
    marginTop: 8,
    alignItems: 'center',
  },
  menuToggleBtn: {
    backgroundColor: theme.colors.surface,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  menuToggleBtnText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
  },
});
