import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Animated } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Dumbbell, Droplet, Play, Check } from 'lucide-react-native';
import { theme } from '../theme';
import { WorkoutSession } from '../trainingTypes';

interface ActiveWorkoutBannerProps {
  session: WorkoutSession;
  onResume: () => void;
  onQuickWater: () => Promise<void> | void;
}

function formatTimer(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export default function ActiveWorkoutBanner({
  session,
  onResume,
  onQuickWater,
}: ActiveWorkoutBannerProps) {
  const [elapsed, setElapsed] = useState(() =>
    Math.max(0, Math.floor((Date.now() - session.startTime) / 1000))
  );
  const [waterLogged, setWaterLogged] = useState(false);
  const [isLoggingWater, setIsLoggingWater] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.35,
          duration: 900,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 900,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [pulseAnim]);

  useEffect(() => {
    const update = () => {
      setElapsed(Math.max(0, Math.floor((Date.now() - session.startTime) / 1000)));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [session.startTime]);

  const handleWaterPress = async () => {
    if (isLoggingWater) return;
    setIsLoggingWater(true);
    try {
      await onQuickWater();
      setWaterLogged(true);
      setTimeout(() => {
        setWaterLogged(false);
      }, 1800);
    } catch (err) {
      console.error('Failed to quick log water from banner', err);
    } finally {
      setIsLoggingWater(false);
    }
  };

  const handleResumePress = () => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onResume();
  };

  return (
    <View style={styles.bannerContainer}>
      <TouchableOpacity
        style={styles.bannerLeft}
        onPress={handleResumePress}
        activeOpacity={0.8}
        accessibilityRole="button"
        accessibilityLabel={`Active workout ${session.templateName}. Tap to resume.`}
      >
        <View style={styles.iconContainer}>
          <Dumbbell size={16} color={theme.colors.accent} />
          <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
        </View>

        <View style={styles.textColumn}>
          <Text style={styles.workoutName} numberOfLines={1}>
            {session.templateName || 'Active Workout'}
          </Text>
          <View style={styles.timerRow}>
            <Text style={styles.liveTag}>LIVE</Text>
            <Text style={styles.timerText}>{formatTimer(elapsed)}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <View style={styles.actionsRow}>
        <TouchableOpacity
          style={[styles.waterBtn, waterLogged && styles.waterBtnSuccess]}
          onPress={handleWaterPress}
          disabled={isLoggingWater}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Quick log 250 milliliters water"
        >
          {waterLogged ? (
            <>
              <Check size={12} color={theme.colors.accentGreen} style={{ marginRight: 4 }} />
              <Text style={styles.waterSuccessText}>+250ml</Text>
            </>
          ) : (
            <>
              <Droplet
                size={13}
                color={theme.colors.accentCyan}
                fill={theme.colors.accentCyan}
                style={{ marginRight: 4 }}
              />
              <Text style={styles.waterBtnText}>+250ml</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.resumeBtn}
          onPress={handleResumePress}
          activeOpacity={0.7}
          accessibilityRole="button"
          accessibilityLabel="Resume workout"
        >
          <Play size={11} color="#000000" fill="#000000" style={{ marginRight: 4 }} />
          <Text style={styles.resumeBtnText}>Resume</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bannerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.surfaceCard,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(10, 132, 255, 0.25)',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 9,
  },
  bannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(10, 132, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
    position: 'relative',
  },
  pulseDot: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: theme.colors.accentGreen,
  },
  textColumn: {
    flex: 1,
  },
  workoutName: {
    fontFamily: theme.typography.bold,
    fontSize: 13,
    color: theme.colors.text,
  },
  timerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 1,
  },
  liveTag: {
    fontFamily: theme.typography.semibold,
    fontSize: 9,
    letterSpacing: 0.5,
    color: theme.colors.accentGreen,
    marginRight: 4,
  },
  timerText: {
    fontFamily: theme.typography.semibold,
    fontSize: 11,
    color: theme.colors.textMuted,
  },
  actionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  waterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(100, 210, 255, 0.12)',
    borderColor: 'rgba(100, 210, 255, 0.35)',
    borderWidth: 1,
    borderRadius: theme.borderRadius.round,
    paddingVertical: 5,
    paddingHorizontal: 9,
  },
  waterBtnSuccess: {
    backgroundColor: 'rgba(50, 215, 75, 0.15)',
    borderColor: 'rgba(50, 215, 75, 0.4)',
  },
  waterBtnText: {
    fontFamily: theme.typography.semibold,
    fontSize: 11,
    color: theme.colors.accentCyan,
  },
  waterSuccessText: {
    fontFamily: theme.typography.semibold,
    fontSize: 11,
    color: theme.colors.accentGreen,
  },
  resumeBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.text,
    borderRadius: theme.borderRadius.round,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  resumeBtnText: {
    fontFamily: theme.typography.semibold,
    fontSize: 11,
    color: theme.colors.background,
  },
});
