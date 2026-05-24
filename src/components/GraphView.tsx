import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, TouchableOpacity, PanResponder, Animated, Easing } from 'react-native';
import Svg, { Line, Circle, Text as SvgText, G } from 'react-native-svg';

const AnimatedG = Animated.createAnimatedComponent(G);
const AnimatedText = Animated.createAnimatedComponent(SvgText);
import * as Haptics from 'expo-haptics';
import { theme } from '../theme';
import { DrinkLog, DayProgress, LiquidType, LIQUID_CONFIGS } from '../types';

interface GraphViewProps {
  progress: DayProgress;
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
const CANVAS_HEIGHT = 260;
const CX = width / 2;
const CY = CANVAS_HEIGHT / 2;

export default function GraphView({ progress }: GraphViewProps) {
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);
  
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

  return (
    <View style={styles.container}>
      <Text style={styles.header}>Visualizer</Text>
      
      <View style={styles.graphContainer}>
        <View style={styles.canvasHeader}>
          <Text style={styles.graphLabel}>Interactive Graph</Text>
          
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
        </View>

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
                    height: 2 * lineLength, // Center is at bottom-middle of the visible top half
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
                      // Visual dotted/solid indicator
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

              // Node size constants
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
        <Text style={styles.interactiveHint}>Pinch to zoom, swipe to pan, tap nodes</Text>
      </View>

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
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
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
