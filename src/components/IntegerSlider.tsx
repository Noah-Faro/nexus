import React, { useRef, useState, useEffect } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated, LayoutChangeEvent } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';

interface IntegerSliderProps {
  min: number;
  max: number;
  value: number;
  onChange: (val: number) => void;
}

export default function IntegerSlider({ min, max, value, onChange }: IntegerSliderProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const trackWidthRef = useRef(0);
  const panX = useRef(new Animated.Value(0)).current;
  const lastReportedValue = useRef(value);
  const isDragging = useRef(false);

  const range = max - min;
  const THUMB_SIZE = 36;

  useEffect(() => {
    lastReportedValue.current = value;
  }, [value]);

  useEffect(() => {
    if (trackWidth > 0 && !isDragging.current) {
      const percentage = (value - min) / range;
      const maxScroll = Math.max(0, trackWidth - THUMB_SIZE);
      panX.setValue(percentage * maxScroll);
    }
  }, [value, trackWidth, min, range, panX]);

  const snapTo = (val: number, maxScroll: number) => {
    const percentage = (val - min) / range;
    const snappedX = percentage * maxScroll;
    Animated.spring(panX, {
      toValue: snappedX,
      useNativeDriver: false,
      bounciness: 4,
      speed: 20
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onStartShouldSetPanResponderCapture: () => true,
      onMoveShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponderCapture: () => true,
      onPanResponderGrant: () => {
        isDragging.current = true;
        (panX as any).setOffset((panX as any)._value);
        panX.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        const maxScroll = Math.max(0, trackWidthRef.current - THUMB_SIZE);
        const currentPos = (panX as any)._offset + gestureState.dx;
        const clampedPos = Math.max(0, Math.min(currentPos, maxScroll));
        
        panX.setValue(clampedPos - (panX as any)._offset);

        const percentage = maxScroll > 0 ? clampedPos / maxScroll : 0;
        const rawValue = min + percentage * range;
        const roundedValue = Math.round(rawValue);

        if (roundedValue !== lastReportedValue.current) {
          lastReportedValue.current = roundedValue;
          Haptics.selectionAsync();
          onChange(roundedValue);
        }
      },
      onPanResponderRelease: () => {
        isDragging.current = false;
        (panX as any).flattenOffset();
        const maxScroll = Math.max(0, trackWidthRef.current - THUMB_SIZE);
        snapTo(lastReportedValue.current, maxScroll);
      },
      onPanResponderTerminate: () => {
        isDragging.current = false;
        (panX as any).flattenOffset();
        const maxScroll = Math.max(0, trackWidthRef.current - THUMB_SIZE);
        snapTo(lastReportedValue.current, maxScroll);
      }
    })
  ).current;

  return (
    <View style={styles.container}>
      <View style={styles.trackContainer}>
        <View 
          style={styles.track}
          onLayout={(e: LayoutChangeEvent) => {
            trackWidthRef.current = e.nativeEvent.layout.width;
            setTrackWidth(e.nativeEvent.layout.width);
          }}
        >
          {trackWidth > 0 && (
            <>
              <Animated.View style={[styles.activeTrack, { width: Animated.add(panX, THUMB_SIZE / 2) }]} />
              <Animated.View 
                style={[styles.thumb, { transform: [{ translateX: panX }] }]} 
                {...panResponder.panHandlers}
              >
                <Text style={styles.thumbText}>{value}</Text>
              </Animated.View>
            </>
          )}
        </View>
      </View>
      <View style={styles.labelsContainer}>
        <Text style={styles.labelText}>{min}</Text>
        <Text style={styles.labelText}>{max}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: theme.spacing.xs,
  },
  trackContainer: {
    height: 44,
    justifyContent: 'center',
    paddingHorizontal: 0,
  },
  track: {
    height: 6,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: 3,
    width: '100%',
    position: 'relative',
    justifyContent: 'center',
  },
  activeTrack: {
    position: 'absolute',
    left: 0,
    height: 6,
    backgroundColor: theme.colors.accentCyan,
    borderRadius: 3,
  },
  thumb: {
    position: 'absolute',
    left: 0,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.colors.text,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  thumbText: {
    fontFamily: theme.typography.semibold,
    color: theme.colors.background,
    fontSize: 14,
  },
  labelsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
    paddingHorizontal: 10,
  },
  labelText: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 12,
  }
});
