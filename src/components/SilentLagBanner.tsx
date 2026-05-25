import React, { useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Animated, TouchableOpacity, Dimensions } from 'react-native';
import { TrendingDown, X } from 'lucide-react-native';
import { theme } from '../theme';

const { width } = Dimensions.get('window');

interface SilentLagBannerProps {
  visible: boolean;
  onClose: () => void;
  lagMinutes: number;
  deficitMl: number;
}

export default function SilentLagBanner({ visible, onClose, lagMinutes, deficitMl }: SilentLagBannerProps) {
  const slideAnim = useRef(new Animated.Value(-140)).current;

  useEffect(() => {
    if (visible) {
      // Slide Down
      Animated.spring(slideAnim, {
        toValue: 50, // Absolute top offset below safe area
        useNativeDriver: true,
        bounciness: 6,
      }).start();

      // Auto dismiss after 8 seconds
      const timer = setTimeout(() => {
        handleDismiss();
      }, 8000);

      return () => clearTimeout(timer);
    } else {
      slideAnim.setValue(-140);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(slideAnim, {
      toValue: -140,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  if (!visible) return null;

  // Format lag time beautifully (e.g. "45m" or "2h 15m")
  const formatLagTime = (mins: number) => {
    const rounded = Math.round(mins);
    if (rounded < 60) return `${rounded}m`;
    const hrs = Math.floor(rounded / 60);
    const remainingMins = rounded % 60;
    return remainingMins > 0 ? `${hrs}h ${remainingMins}m` : `${hrs}h`;
  };

  return (
    <Animated.View style={[styles.container, { transform: [{ translateY: slideAnim }] }]}>
      <View style={styles.pill}>
        <View style={styles.iconContainer}>
          <TrendingDown size={16} color={theme.colors.accentRed} />
        </View>
        <View style={styles.textContainer}>
          <Text style={styles.title}>Hydration Curve Deficit</Text>
          <Text style={styles.message}>
            You are <Text style={styles.highlight}>{formatLagTime(lagMinutes)}</Text> behind target. Drink <Text style={styles.highlight}>{Math.round(deficitMl)}ml</Text> to catch up.
          </Text>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={handleDismiss} activeOpacity={0.7}>
          <X size={14} color={theme.colors.textMuted} />
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1c1c1e',
    borderWidth: 1,
    borderColor: 'rgba(255, 69, 58, 0.25)',
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: '100%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 6,
    elevation: 8,
  },
  iconContainer: {
    backgroundColor: 'rgba(255, 69, 58, 0.1)',
    padding: 8,
    borderRadius: 16,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
    paddingRight: 4,
  },
  title: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    fontWeight: 'bold',
    color: theme.colors.accentRed,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  message: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.text,
    lineHeight: 17,
  },
  highlight: {
    fontWeight: 'bold',
    color: '#ffffff',
  },
  closeBtn: {
    padding: 6,
    borderRadius: 12,
    backgroundColor: '#2c2c2e',
    marginLeft: 8,
  },
});
