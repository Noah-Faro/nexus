import React, { useEffect, useRef } from 'react';
import { StyleSheet, Animated, Easing, View, Text } from 'react-native';
import { Cloud, RefreshCw } from 'lucide-react-native';
import { theme } from '../theme';

interface SyncIndicatorProps {
  isSyncing: boolean;
}

export default function SyncIndicator({ isSyncing }: SyncIndicatorProps) {
  const spinValue = useRef(new Animated.Value(0)).current;
  const fadeValue = useRef(new Animated.Value(0)).current;

  // Spin Animation
  useEffect(() => {
    let animation: Animated.CompositeAnimation | null = null;
    
    if (isSyncing) {
      spinValue.setValue(0);
      animation = Animated.loop(
        Animated.timing(spinValue, {
          toValue: 1,
          duration: 1200,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      );
      animation.start();
    } else {
      spinValue.setValue(0);
    }

    return () => {
      if (animation) {
        animation.stop();
      }
    };
  }, [isSyncing]);

  // Fade Animation
  useEffect(() => {
    Animated.timing(fadeValue, {
      toValue: isSyncing ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isSyncing]);

  const spin = spinValue.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <Animated.View 
      style={[
        styles.container, 
        { 
          opacity: fadeValue,
          transform: [
            { translateY: fadeValue.interpolate({ inputRange: [0, 1], outputRange: [-20, 0] }) }
          ]
        }
      ]}
      pointerEvents="none"
    >
      <View style={styles.badge}>
        <Cloud size={14} color="#000000" style={styles.cloudIcon} />
        <Animated.View style={{ transform: [{ rotate: spin }] }}>
          <RefreshCw size={12} color="#000000" />
        </Animated.View>
        <Text style={styles.text}>Syncing</Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50, // Floating below iOS notch / status bar area
    right: 16,
    zIndex: 9999,
  },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#34C759', // Beautiful iOS accent green representing sync status
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cloudIcon: {
    marginRight: 6,
  },
  text: {
    fontFamily: theme.typography.semibold || 'System',
    fontSize: 11,
    color: '#000000',
    marginLeft: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
});
