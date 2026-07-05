import React, { useState, useEffect, useRef, useMemo } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ScrollView, Animated, PanResponder, KeyboardAvoidingView, Platform, Keyboard, TextInput } from 'react-native';
import { Droplet, Dumbbell, DollarSign, BookOpen, Settings, ArrowUp } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { UserSettings } from '../types';

interface NexusVaultProps {
  settings: UserSettings;
  onOpenSettings: () => void;
  onSelectApp: (app: 'hydration' | 'training', initialCommand?: string) => void;
  onShowLockedAlert: (moduleName: string) => void;
  onUpdateSettings: (settings: UserSettings) => void;
  activeDaysCount: number;
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
    color: '#a1a1a6', // Titanium silver accent
    bg: 'rgba(142, 142, 147, 0.1)',
    locked: false,
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

export default function NexusVault({ settings, onOpenSettings, onSelectApp, onShowLockedAlert, onUpdateSettings, activeDaysCount }: NexusVaultProps) {
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

  // Cleanup timer on unmount to prevent leaks
  useEffect(() => {
    return () => {
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
      }
    };
  }, []);

  // Sync orderRef when order state changes
  useEffect(() => {
    orderRef.current = order;
  }, [order]);

  useEffect(() => {
    orderRef.current.forEach((id, index) => {
      positionAnim[id].setValue(index * CARD_SIZE);
    });
  }, []);

  const panResponders = useMemo(() => {
    const responders: Record<string, any> = {};
    ['hydration', 'training', 'capital', 'knowledge'].forEach(id => {
      let startY = 0;
      responders[id] = PanResponder.create({
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
              onSelectAppRef.current(id as 'hydration' | 'training');
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
    return responders;
  }, []);

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
              <Text style={styles.diagValue}>Device Storage</Text>
            </View>
            <View style={[styles.diagRow, { borderBottomWidth: 0 }]}>
              <Text style={styles.diagLabel}>History</Text>
              <Text style={styles.diagValue}>{activeDaysCount} Days</Text>
            </View>
          </View>
        </ScrollView>
      </View>
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
    fontFamily: 'Outfit_700Bold',
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
    fontFamily: theme.typography.semibold,
    fontSize: 18,
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
    fontFamily: theme.typography.semibold,
    fontSize: 15,
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
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.text,
  },
});
