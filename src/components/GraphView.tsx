import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, TouchableOpacity, PanResponder, Animated, Easing, ScrollView } from 'react-native';
import Svg, { Line, Circle, Text as SvgText, G, Path, Defs, LinearGradient, Stop } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedText = Animated.createAnimatedComponent(SvgText);
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { DrinkLog, DayProgress, UserSettings, LiquidType, LIQUID_CONFIGS, LiquidConfig } from '../types';
import { getHydrationCurveData, calculateActiveCaffeine, calculateGoal } from '../storage';

interface GraphViewProps {
  progress: DayProgress;
  logs: DrinkLog[];
  settings: UserSettings;
}

interface NodeItem {
  id: string;
  label: string;
  subLabel: string;
  tag: string;
  amount: number;
  multiplier: number;
  color: string;
  type: 'drink' | 'day';
  baseAngle: number;
  radius: number;
}

const { width } = Dimensions.get('window');
const CANVAS_HEIGHT = 220;
const CX = width / 2;
const CY = CANVAS_HEIGHT / 2;

export default function GraphView({ progress, logs, settings }: GraphViewProps) {
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);
  const [activeTab, setActiveTab] = useState<'orbits' | 'curves'>('orbits');
  const [hoveredHour, setHoveredHour] = useState<number>(new Date().getHours());
  
  const zoom = useRef(new Animated.Value(1.0)).current;
  const offsetX = useRef(new Animated.Value(0)).current;
  const offsetY = useRef(new Animated.Value(0)).current;
  const orbitAngle = useRef(new Animated.Value(0)).current;

  const currentZoom = useRef(1.0);
  const currentOffsetX = useRef(0);
  const currentOffsetY = useRef(0);

  // Measure exact canvas size dynamically
  const [dimensions, setDimensions] = useState({ w: width - 32, h: CANVAS_HEIGHT });
  const CX = dimensions.w / 2;
  const CY = dimensions.h / 2;

  const onLayout = (event: any) => {
    const { width: layoutWidth, height: layoutHeight } = event.nativeEvent.layout;
    setDimensions({ w: layoutWidth, h: layoutHeight });
  };

  useEffect(() => {
    // Premium 60fps Native Loop
    Animated.loop(
      Animated.timing(orbitAngle, {
        toValue: 1,
        duration: 35000,
        easing: Easing.linear,
        useNativeDriver: true, // Use native driver for 60fps
      })
    ).start();

    zoom.addListener(({ value }) => { currentZoom.current = value; });
    offsetX.addListener(({ value }) => { currentOffsetX.current = value; });
    offsetY.addListener(({ value }) => { currentOffsetY.current = value; });
    return () => {
      zoom.removeAllListeners();
      offsetX.removeAllListeners();
      offsetY.removeAllListeners();
    };
  }, []);

  const initialDist = useRef<number | null>(null);
  const baseZoom = useRef(1.0);
  const panStart = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        return (touches && touches.length === 2) || Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: (evt, gestureState) => {
        panStart.current = { 
          x: currentOffsetX.current - gestureState.dx, 
          y: currentOffsetY.current - gestureState.dy 
        };
        initialDist.current = null;
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length === 2) {
          const dx = touches[0].pageX - touches[1].pageX;
          const dy = touches[0].pageY - touches[1].pageY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (!initialDist.current) {
            initialDist.current = dist;
            baseZoom.current = currentZoom.current;
            panStart.current = { 
              x: currentOffsetX.current - gestureState.dx, 
              y: currentOffsetY.current - gestureState.dy 
            };
          } else {
            const ratio = dist / initialDist.current;
            const newZoom = Math.min(2.5, Math.max(0.4, baseZoom.current * ratio));
            zoom.setValue(newZoom);
          }
        } else if (touches && touches.length === 1) {
          if (initialDist.current) {
            initialDist.current = null;
            panStart.current = { 
              x: currentOffsetX.current - gestureState.dx, 
              y: currentOffsetY.current - gestureState.dy 
            };
          }
          const newX = panStart.current.x + gestureState.dx;
          const newY = panStart.current.y + gestureState.dy;
          offsetX.setValue(newX);
          offsetY.setValue(newY);
        }
      },
      onPanResponderRelease: () => {
        initialDist.current = null;
      }
    })
  ).current;

  const drinkLogs = progress.logs;
  const nodes: NodeItem[] = [
    {
      id: 'center-today',
      label: 'Today',
      subLabel: `${progress.totalEffective}ml / ${progress.goal}ml`,
      tag: '#today',
      amount: progress.totalEffective,
      multiplier: 1.0,
      color: theme.colors.text,
      type: 'day',
      baseAngle: 0,
      radius: 0
    }
  ];

  drinkLogs.forEach((log, index) => {
    const baseAngle = (2 * Math.PI * index) / drinkLogs.length;
    const config = Object.values(LIQUID_CONFIGS).find(c => c.tag === log.tag);
    const color = config ? config.color : theme.colors.accent;

    nodes.push({
      id: log.id,
      label: `${log.amount}ml`,
      subLabel: log.type,
      tag: log.tag,
      amount: log.amount,
      multiplier: config ? config.multiplier : 1.0,
      color,
      type: 'drink',
      baseAngle,
      radius: 95 
    });
  });

  const getBaseNodeRadius = (amount: number) => {
    return Math.min(14, Math.max(6, 4 + (amount / 80)));
  };

  const handleZoomIn = () => {
    Haptics.selectionAsync();
    Animated.timing(zoom, { toValue: Math.min(2.5, currentZoom.current + 0.15), duration: 150, useNativeDriver: true }).start();
  };

  const handleZoomOut = () => {
    Haptics.selectionAsync();
    Animated.timing(zoom, { toValue: Math.max(0.4, currentZoom.current - 0.15), duration: 150, useNativeDriver: true }).start();
  };

  const handleZoomReset = () => {
    Haptics.selectionAsync();
    Animated.spring(zoom, { toValue: 1.0, useNativeDriver: true }).start();
    Animated.spring(offsetX, { toValue: 0, useNativeDriver: true }).start();
    Animated.spring(offsetY, { toValue: 0, useNativeDriver: true }).start();
  };

  const centerNode = nodes[0];

  const curvePoints = getHydrationCurveData(logs, settings);
  const goal = calculateGoal(settings);
  
  // Curves layout geometry
  const paddingLeft = 20;
  const paddingRight = 20;
  const paddingTop = 25;
  const paddingBottom = 30;
  
  const graphW = Math.max(100, dimensions.w - paddingLeft - paddingRight);
  const graphH = Math.max(50, dimensions.h - paddingTop - paddingBottom);
  
  const maxHydration = Math.max(goal, ...curvePoints.map(p => p.actual), 1000);
  const maxCaffeine = Math.max(...curvePoints.map(p => p.caffeine), 150);
  const caffeinePointsExist = curvePoints.some(p => p.caffeine > 0);

  const getX = (h: number) => paddingLeft + (h / 23) * graphW;
  const getYHydration = (v: number) => paddingTop + graphH - (v / maxHydration) * graphH;
  const getYCaffeine = (c: number) => paddingTop + graphH - (c / maxCaffeine) * graphH;

  // Build SVG Path strings
  const targetD = curvePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.hour)} ${getYHydration(p.target)}`).join(' ');
  const actualD = curvePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.hour)} ${getYHydration(p.actual)}`).join(' ');
  const caffeineLineD = curvePoints.map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${getX(p.hour)} ${getYCaffeine(p.caffeine)}`).join(' ');
  const caffeineAreaD = `${caffeineLineD} L ${getX(23)} ${paddingTop + graphH} L ${getX(0)} ${paddingTop + graphH} Z`;

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
      
      {/* iOS Segment Control tabs */}
      <View style={styles.tabContainer}>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'orbits' && styles.tabBtnActive]} 
          onPress={() => { Haptics.selectionAsync(); setActiveTab('orbits'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'orbits' && styles.tabBtnTextActive]}>Orbits</Text>
        </TouchableOpacity>
        <TouchableOpacity 
          style={[styles.tabBtn, activeTab === 'curves' && styles.tabBtnActive]} 
          onPress={() => { Haptics.selectionAsync(); setActiveTab('curves'); }}
          activeOpacity={0.8}
        >
          <Text style={[styles.tabBtnText, activeTab === 'curves' && styles.tabBtnTextActive]}>Curves</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.graphContainer}>
        <View style={styles.canvasHeader}>
          <Text style={styles.graphLabel}>
            {activeTab === 'orbits' ? 'Interactive Graph' : '24h Physiological Curve'}
          </Text>
          
          {activeTab === 'orbits' && (
            <View style={styles.zoomContainer}>
              <TouchableOpacity 
                style={styles.zoomBtn} 
                onPress={handleZoomOut}
                activeOpacity={0.7}
              >
                <Text style={styles.zoomBtnText}>-</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.zoomResetBtn} 
                onPress={handleZoomReset}
                activeOpacity={0.7}
              >
                <Text style={styles.zoomResetText}>Reset</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.zoomBtn} 
                onPress={handleZoomIn}
                activeOpacity={0.7}
              >
                <Text style={styles.zoomBtnText}>+</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>

        {activeTab === 'orbits' ? (
          <View 
            style={styles.canvasWrapper} 
            {...panResponder.panHandlers}
            onLayout={onLayout}
          >
            <Animated.View style={[StyleSheet.absoluteFill, {
              transform: [
                { translateX: offsetX },
                { translateY: offsetY },
                { scale: zoom }
              ]
            }]}>
              
              {/* Concentric stationary dotted background circles */}
              <Svg width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <G x={CX} y={CY}>
                  {[1, 3].map((circleVal) => (
                    <Circle
                      key={circleVal}
                      r={circleVal * 55}
                      fill="none"
                      stroke={theme.colors.borderMuted}
                      strokeWidth={1}
                      strokeDasharray="2 8"
                    />
                  ))}
                </G>
              </Svg>

              {/* Orbiting Connecting Lines */}
              {nodes.slice(1).map((node, index) => {
                const isSelected = selectedNode?.id === node.id;
                const lineLength = node.radius;
                const baseAngle = node.baseAngle;

                // Orbiting interpolation for this line
                const spin_i = orbitAngle.interpolate({
                  inputRange: [0, 1],
                  outputRange: [`${baseAngle}rad`, `${baseAngle + 2 * Math.PI}rad`]
                });

                return (
                  <Animated.View
                    key={`line-wrapper-${node.id}`}
                    style={{
                      position: 'absolute',
                      left: CX - 0.75,
                      top: CY - lineLength,
                      width: 1.5,
                      height: 2 * lineLength,
                      transform: [{ rotate: spin_i }]
                    }}
                    pointerEvents="none"
                  >
                    <View
                      style={{
                        height: lineLength,
                        width: 1.5,
                        backgroundColor: isSelected ? node.color : theme.colors.border,
                        opacity: isSelected ? 1.0 : (node.tag === '#water' ? 0.6 : 0.25),
                        borderStyle: node.tag === '#water' ? 'solid' : 'dashed',
                        borderWidth: node.tag === '#water' ? 0 : 0.75,
                        borderColor: isSelected ? node.color : theme.colors.border,
                      }}
                    />
                  </Animated.View>
                );
              })}

              {/* Orbiting Nodes */}
              {nodes.slice(1).map((node) => {
                const isSelected = selectedNode?.id === node.id;
                const baseRad = getBaseNodeRadius(node.amount);
                const nodeRad = baseRad * (isSelected ? 1.4 : 1.0);
                const baseAngle = node.baseAngle;

                // Orbiting interpolation for this node
                const spin_i = orbitAngle.interpolate({
                  inputRange: [0, 1],
                  outputRange: [`${baseAngle}rad`, `${baseAngle + 2 * Math.PI}rad`]
                });

                // Reverse rotation to keep node content upright
                const reverseSpin_i = orbitAngle.interpolate({
                  inputRange: [0, 1],
                  outputRange: [`-${baseAngle}rad`, `-${baseAngle + 2 * Math.PI}rad`]
                });

                const NODE_BOX_SIZE = 80;

                return (
                  <Animated.View
                    key={`node-${node.id}`}
                    style={{
                      position: 'absolute',
                      left: CX - NODE_BOX_SIZE / 2,
                      top: CY - NODE_BOX_SIZE / 2,
                      width: NODE_BOX_SIZE,
                      height: NODE_BOX_SIZE,
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: [
                        { rotate: spin_i },
                        { translateY: -node.radius },
                        { rotate: reverseSpin_i }
                      ],
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => setSelectedNode(isSelected ? null : node)}
                      style={{
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 60,
                        height: 60,
                      }}
                    >
                      {/* Selected glow ring */}
                      {isSelected && (
                        <View
                          style={{
                            position: 'absolute',
                            width: nodeRad * 3.5,
                            height: nodeRad * 3.5,
                            borderRadius: 99,
                            backgroundColor: node.color,
                            opacity: 0.15,
                          }}
                        />
                      )}

                      {/* Node circle */}
                      <View
                        style={{
                          width: nodeRad * 2,
                          height: nodeRad * 2,
                          borderRadius: 99,
                          backgroundColor: node.color,
                          borderWidth: 2,
                          borderColor: theme.colors.background,
                        }}
                      />

                      {/* Label */}
                      <View
                        style={{
                          position: 'absolute',
                          top: -12,
                          alignItems: 'center',
                          width: 100,
                        }}
                      >
                        <Text
                          style={{
                            fontFamily: theme.typography.sans,
                            fontSize: 10,
                            fontWeight: isSelected ? 'bold' : '500',
                            color: isSelected ? theme.colors.text : theme.colors.textMuted,
                            textAlign: 'center',
                          }}
                        >
                          {node.label}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}

              {/* Center Node (stationary) */}
              <View
                style={{
                  position: 'absolute',
                  left: CX - 40,
                  top: CY - 40,
                  width: 80,
                  height: 80,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => setSelectedNode(selectedNode?.id === centerNode.id ? null : centerNode)}
                  style={{
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {selectedNode?.id === centerNode.id && (
                    <View
                      style={{
                        position: 'absolute',
                        width: 48,
                        height: 48,
                        borderRadius: 99,
                        backgroundColor: theme.colors.text,
                        opacity: 0.1,
                      }}
                    />
                  )}
                  <View
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 99,
                      backgroundColor: theme.colors.surfaceElevated,
                      borderWidth: 2,
                      borderColor: theme.colors.text,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  />
                  <Text
                    style={{
                      position: 'absolute',
                      top: -18,
                      fontFamily: theme.typography.sans,
                      fontSize: 12,
                      fontWeight: 'bold',
                      color: theme.colors.text,
                      textAlign: 'center',
                    }}
                  >
                    Today
                  </Text>
                </TouchableOpacity>
              </View>

            </Animated.View>
          </View>
        ) : (
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
        )}

        <Text style={styles.interactiveHint}>
          {activeTab === 'orbits' ? 'Pinch to zoom, swipe to pan, tap nodes' : 'Drag finger horizontally to inspect hours'}
        </Text>
      </View>

      {activeTab === 'orbits' ? (
        <>
          <Text style={styles.subHeader}>Node Inspector</Text>
          {selectedNode ? (
            <View style={styles.inspectorCard}>
              <View style={styles.inspectorRow}>
                <Text style={styles.inspectorLabel}>Type</Text>
                <Text style={[styles.inspectorValue, { color: selectedNode.color }]}>{selectedNode.type === 'day' ? 'Root Node' : selectedNode.subLabel.charAt(0).toUpperCase() + selectedNode.subLabel.slice(1)}</Text>
              </View>
              <View style={styles.divider} />
              <View style={styles.inspectorRow}>
                <Text style={styles.inspectorLabel}>Volume</Text>
                <Text style={styles.inspectorValue}>{selectedNode.label}</Text>
              </View>
              <View style={styles.divider} />
              {selectedNode.type === 'drink' ? (
                <View style={styles.inspectorRow}>
                  <Text style={styles.inspectorLabel}>Hydration Factor</Text>
                  <Text style={styles.inspectorValue}>
                    {Number(selectedNode.multiplier.toFixed(2))}x ({Number((selectedNode.amount * selectedNode.multiplier).toFixed(1))}ml net)
                  </Text>
                </View>
              ) : (
                <View style={styles.inspectorRow}>
                  <Text style={styles.inspectorLabel}>Progress</Text>
                  <Text style={styles.inspectorValue}>{selectedNode.subLabel}</Text>
                </View>
              )}
            </View>
          ) : (
            <View style={styles.inspectorPlaceholder}>
              <Text style={styles.placeholderText}>Select a node to view details</Text>
            </View>
          )}
        </>
      ) : (
        <>
          <Text style={styles.subHeader}>Curves Timeline Inspector</Text>
          {(() => {
            const pt = curvePoints[hoveredHour];
            const diff = pt.actual - pt.target;
            const diffStr = diff >= 0 ? `+${diff}ml ahead of target` : `${Math.abs(diff)}ml lagging behind`;
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
        </>
      )}
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
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.sm,
    padding: 2,
    marginBottom: theme.spacing.md,
  },
  tabBtn: {
    flex: 1,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.borderRadius.sm - 2,
  },
  tabBtnActive: {
    backgroundColor: theme.colors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  tabBtnText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.medium,
  },
  tabBtnTextActive: {
    color: '#000000',
    fontWeight: theme.typography.weight.semibold,
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
  svgCanvas: {
    backgroundColor: 'transparent',
  },
  zoomContainer: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surface,
    borderRadius: 8,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
  },
  zoomBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    fontWeight: theme.typography.weight.medium,
    color: theme.colors.text,
  },
  zoomResetBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomResetText: {
    fontFamily: theme.typography.sans,
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.medium,
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
  inspectorPlaceholder: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
    padding: theme.spacing.xl,
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: theme.typography.sans,
    fontSize: 15,
    color: theme.colors.textMuted,
  },
});
