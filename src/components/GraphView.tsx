import React, { useState, useMemo } from 'react';
import { StyleSheet, Text, View, Dimensions, TouchableOpacity, ScrollView } from 'react-native';
import Svg, { Line, Circle, Text as SvgText, G, Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { DrinkLog, DayProgress, UserSettings } from '../types';
import { getHydrationCurveData, calculateGoal } from '../storage';

interface GraphViewProps {
  progress: DayProgress;
  logs: DrinkLog[];
  settings: UserSettings;
}

const { width } = Dimensions.get('window');
const CANVAS_HEIGHT = 220;

export default function GraphView({ progress, logs, settings }: GraphViewProps) {
  const [hoveredHour, setHoveredHour] = useState<number>(new Date().getHours());
  
  // Measure exact canvas size dynamically
  const [dimensions, setDimensions] = useState({ w: width - 32, h: CANVAS_HEIGHT });

  const onLayout = (event: any) => {
    const { width: layoutWidth, height: layoutHeight } = event.nativeEvent.layout;
    setDimensions({ w: layoutWidth, h: layoutHeight });
  };

  const curvePoints = useMemo(() => {
    return getHydrationCurveData(logs, settings);
  }, [logs, settings]);

  const goal = useMemo(() => {
    return calculateGoal(settings);
  }, [settings]);
  
  // Curves layout geometry
  const paddingLeft = 20;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;
  
  const graphW = Math.max(100, dimensions.w - paddingLeft - paddingRight);
  const graphH = Math.max(50, dimensions.h - paddingTop - paddingBottom);
  
  const maxHydration = useMemo(() => {
    return Math.max(goal, ...curvePoints.map(p => p.actual), 1000);
  }, [goal, curvePoints]);

  const maxCaffeine = useMemo(() => {
    return Math.max(...curvePoints.map(p => p.caffeine), 150);
  }, [curvePoints]);

  const caffeinePointsExist = useMemo(() => {
    return curvePoints.some(p => p.caffeine > 0);
  }, [curvePoints]);

  const getX = (h: number) => paddingLeft + (h / 23) * graphW;
  const getYHydration = (v: number) => paddingTop + graphH - (v / maxHydration) * graphH;
  const getYCaffeine = (c: number) => paddingTop + graphH - (c / maxCaffeine) * graphH;

  // Build SVG Path strings
  const targetD = useMemo(() => {
    return curvePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.hour)} ${getYHydration(p.target)}`).join(' ');
  }, [curvePoints, graphW, graphH, maxHydration]);

  const actualD = useMemo(() => {
    return curvePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.hour)} ${getYHydration(p.actual)}`).join(' ');
  }, [curvePoints, graphW, graphH, maxHydration]);

  const caffeineLineD = useMemo(() => {
    return curvePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.hour)} ${getYCaffeine(p.caffeine)}`).join(' ');
  }, [curvePoints, graphW, graphH, maxCaffeine]);

  const caffeineAreaD = useMemo(() => {
    return `${caffeineLineD} L ${getX(23)} ${paddingTop + graphH} L ${getX(0)} ${paddingTop + graphH} Z`;
  }, [caffeineLineD, graphW, graphH]);

  const handleTouchMove = (evt: any) => {
    const pageX = evt.nativeEvent.pageX;
    const offset = pageX - (width - dimensions.w) / 2; // Approximate alignment offset
    const pct = Math.max(0, Math.min(1, offset / dimensions.w));
    const hour = Math.round(pct * 23);
    const clampedHour = Math.max(0, Math.min(23, hour));
    if (clampedHour !== hoveredHour) {
      Haptics.selectionAsync();
      setHoveredHour(clampedHour);
    }
  };

  return (
    <ScrollView 
      style={styles.container} 
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.header}>Visualizer</Text>

      <View style={styles.graphContainer}>
        <View style={styles.canvasHeader}>
          <Text style={styles.graphLabel}>24h Physiological Curve</Text>
        </View>

        <View 
          style={styles.canvasWrapper}
          onLayout={onLayout}
          onTouchStart={handleTouchMove}
          onTouchMove={handleTouchMove}
        >
          <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <LinearGradient id="caffGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor="#ff9f0a" stopOpacity="0.15" />
                <Stop offset="100%" stopColor="#ff9f0a" stopOpacity="0.0" />
              </LinearGradient>
              <LinearGradient id="hydGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0%" stopColor={theme.colors.accent} stopOpacity="0.1" />
                <Stop offset="100%" stopColor={theme.colors.accent} stopOpacity="0.0" />
              </LinearGradient>
            </Defs>

            {/* Grid Lines */}
            <G>
              {[0.25, 0.5, 0.75, 1.0].map((pct, idx) => {
                const y = paddingTop + graphH * (1 - pct);
                return (
                  <Line
                    key={idx}
                    x1={paddingLeft}
                    y1={y}
                    x2={paddingLeft + graphW}
                    y2={y}
                    stroke={theme.colors.border}
                    strokeWidth={1}
                    strokeDasharray="2 6"
                    opacity={0.5}
                  />
                );
              })}
            </G>

            {/* Curves Area fills */}
            {caffeinePointsExist && (
              <Path d={caffeineAreaD} fill="url(#caffGrad)" pointerEvents="none" />
            )}
            
            <Path 
              d={`${actualD} L ${getX(23)} ${paddingTop + graphH} L ${getX(0)} ${paddingTop + graphH} Z`} 
              fill="url(#hydGrad)" 
              pointerEvents="none" 
            />

            {/* Dashed Target Curve */}
            <Path
              d={targetD}
              fill="none"
              stroke={theme.colors.textSubtle}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              opacity={0.7}
              pointerEvents="none"
            />

            {/* Solid Hydration Curve */}
            <Path
              d={actualD}
              fill="none"
              stroke={theme.colors.accent}
              strokeWidth={3}
              pointerEvents="none"
            />

            {/* Caffeine Curve */}
            {caffeinePointsExist && (
              <Path
                d={caffeineLineD}
                fill="none"
                stroke="#ff9f0a"
                strokeWidth={2}
                pointerEvents="none"
              />
            )}

            {/* Hover Indicator Vertical Line */}
            <Line
              x1={getX(hoveredHour)}
              y1={paddingTop - 6}
              x2={getX(hoveredHour)}
              y2={paddingTop + graphH + 6}
              stroke={theme.colors.text}
              strokeWidth={1}
              strokeDasharray="2 4"
              opacity={0.8}
            />

            {/* Hover indicators circles */}
            <Circle
              cx={getX(hoveredHour)}
              cy={getYHydration(curvePoints[hoveredHour].actual)}
              r={6}
              fill={theme.colors.accent}
              stroke={theme.colors.background}
              strokeWidth={2}
            />

            {curvePoints[hoveredHour].caffeine > 0 && (
              <Circle
                cx={getX(hoveredHour)}
                cy={getYCaffeine(curvePoints[hoveredHour].caffeine)}
                r={5}
                fill="#ff9f0a"
                stroke={theme.colors.background}
                strokeWidth={2}
              />
            )}

            {/* X Axis Labels */}
            <G>
              {[0, 6, 12, 18, 23].map((h) => {
                const label = h === 0 ? '12 AM' : h === 12 ? '12 PM' : h > 12 ? `${h - 12} PM` : `${h} AM`;
                return (
                  <SvgText
                    key={h}
                    x={getX(h)}
                    y={paddingTop + graphH + 18}
                    fill={theme.colors.textMuted}
                    fontSize="9"
                    fontFamily={theme.typography.sans}
                    textAnchor="middle"
                  >
                    {label}
                  </SvgText>
                );
              })}
            </G>
          </Svg>
        </View>

        <Text style={styles.interactiveHint}>
          Drag finger horizontally to inspect hours
        </Text>
      </View>

      <Text style={styles.subHeader}>Curves Timeline Inspector</Text>
      {(() => {
        const pt = curvePoints[hoveredHour];
        const diff = pt.actual - pt.target;
        const diffStr = diff >= 0 ? `${Math.round(diff)}ml ahead of target` : `${Math.round(Math.abs(diff))}ml lagging behind`;
        const diffColor = diff >= 0 ? theme.colors.accentGreen : theme.colors.accentRed;

        return (
          <View style={styles.inspectorCard}>
            <View style={styles.inspectorRow}>
              <Text style={styles.inspectorLabel}>Timeline Hour</Text>
              <Text style={styles.inspectorValue}>{pt.timeLabel}</Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.inspectorRow}>
              <Text style={styles.inspectorLabel}>Hydration (Actual vs. Target)</Text>
              <Text style={styles.inspectorValue}>
                {pt.actual}ml / {pt.target}ml
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.inspectorRow}>
              <Text style={styles.inspectorLabel}>Curve Compliance</Text>
              <Text style={[styles.inspectorValue, { color: diffColor }]}>
                {diffStr}
              </Text>
            </View>
            <View style={styles.divider} />
            <View style={styles.inspectorRow}>
              <Text style={styles.inspectorLabel}>Active Caffeine Pool</Text>
              <Text style={[styles.inspectorValue, { color: pt.caffeine > 0 ? '#ff9f0a' : theme.colors.textMuted }]}>
                {pt.caffeine} mg
              </Text>
            </View>
          </View>
        );
      })()}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  contentContainer: {
    padding: theme.spacing.md,
    paddingBottom: 40,
  },
  header: {
    fontFamily: theme.typography.sans,
    fontSize: 22,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.md,
  },
  subHeader: {
    fontFamily: theme.typography.sans,
    fontSize: 17,
    fontWeight: theme.typography.weight.semibold,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.sm,
  },
  graphContainer: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    overflow: 'hidden',
    marginBottom: theme.spacing.lg,
  },
  canvasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.colors.border,
  },
  graphLabel: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    fontWeight: theme.typography.weight.medium,
    color: theme.colors.text,
  },
  canvasWrapper: {
    width: '100%',
    height: CANVAS_HEIGHT,
    overflow: 'hidden',
  },
  interactiveHint: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.textMuted,
    padding: 12,
    textAlign: 'center',
    backgroundColor: theme.colors.surfaceElevated,
  },
  inspectorCard: {
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.md,
    paddingHorizontal: theme.spacing.md,
  },
  inspectorRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: theme.colors.border,
  },
  inspectorLabel: {
    fontFamily: theme.typography.sans,
    color: theme.colors.textMuted,
    fontSize: 15,
  },
  inspectorValue: {
    fontFamily: theme.typography.sans,
    color: theme.colors.text,
    fontSize: 15,
    fontWeight: theme.typography.weight.semibold,
  },
});
