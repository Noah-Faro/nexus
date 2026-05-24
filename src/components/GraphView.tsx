import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, Dimensions, TouchableOpacity, PanResponder } from 'react-native';
import Svg, { Line, Circle, Text as SvgText, G } from 'react-native-svg';
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
const CANVAS_HEIGHT = 320;
const CX = width / 2;
const CY = CANVAS_HEIGHT / 2;

export default function GraphView({ progress }: GraphViewProps) {
  const [selectedNode, setSelectedNode] = useState<NodeItem | null>(null);
  const [time, setTime] = useState(0);
  const [zoom, setZoom] = useState(1.0); // Dynamic zoom scaling: ranges 0.4x to 2.5x
  const [offsetX, setOffsetX] = useState(0); // Viewport pan offset X (panning)
  const [offsetY, setOffsetY] = useState(0); // Viewport pan offset Y (panning)

  // Use refs to avoid stale closures in PanResponder
  const zoomRef = useRef(zoom);
  const offsetXRef = useRef(offsetX);
  const offsetYRef = useRef(offsetY);

  useEffect(() => {
    zoomRef.current = zoom;
    offsetXRef.current = offsetX;
    offsetYRef.current = offsetY;
  }, [zoom, offsetX, offsetY]);
  
  const animationFrameId = useRef<number | null>(null);

  const initialDist = useRef<number | null>(null);
  const baseZoom = useRef(1.0);
  const panStart = useRef({ x: 0, y: 0 });

  // Gesture responder for 2-finger pinch-to-zoom AND single-finger panning
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        // Only take over the gesture if moving, allowing node taps to work
        return (touches && touches.length === 2) || Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5;
      },
      onPanResponderGrant: (evt, gestureState) => {
        // Record initial offsets before starting drag-pan
        // We subtract gestureState.dx/dy because the gesture might have already started moving
        panStart.current = { 
          x: offsetXRef.current - gestureState.dx, 
          y: offsetYRef.current - gestureState.dy 
        };
        initialDist.current = null;
      },
      onPanResponderMove: (evt, gestureState) => {
        const touches = evt.nativeEvent.touches;
        if (touches && touches.length === 2) {
          // Two-finger pinch to zoom
          const dx = touches[0].locationX - touches[1].locationX;
          const dy = touches[0].locationY - touches[1].locationY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          
          if (!initialDist.current) {
            // First time seeing 2 fingers during this gesture
            initialDist.current = dist;
            baseZoom.current = zoomRef.current;
            panStart.current = { 
              x: offsetXRef.current - gestureState.dx, 
              y: offsetYRef.current - gestureState.dy 
            };
          } else {
            const ratio = dist / initialDist.current;
            const newZoom = Math.min(2.5, Math.max(0.4, baseZoom.current * ratio));
            setZoom(newZoom);
          }
        } else if (touches && touches.length === 1) {
          if (initialDist.current) {
            // Transitioned from 2 fingers back to 1 finger
            initialDist.current = null;
            panStart.current = { 
              x: offsetXRef.current - gestureState.dx, 
              y: offsetYRef.current - gestureState.dy 
            };
          }
          // Single-finger swiping: pan the viewport like Google Maps!
          const newX = panStart.current.x + gestureState.dx;
          const newY = panStart.current.y + gestureState.dy;
          setOffsetX(newX);
          setOffsetY(newY);
        }
      },
      onPanResponderRelease: () => {
        initialDist.current = null;
      }
    })
  ).current;

  // Floating animation loop
  useEffect(() => {
    const updateTime = () => {
      setTime((prev) => (prev + 1) % 10000);
      animationFrameId.current = requestAnimationFrame(updateTime);
    };
    animationFrameId.current = requestAnimationFrame(updateTime);
    
    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, []);

  // Map progress logs to drink nodes
  const drinkLogs = progress.logs;
  const nodes: NodeItem[] = [
    {
      id: 'center-today',
      label: progress.date,
      subLabel: `${progress.totalEffective}ml / ${progress.goal}ml`,
      tag: '#today',
      amount: progress.totalEffective,
      multiplier: 1.0,
      color: theme.colors.accent,
      type: 'day',
      baseAngle: 0,
      radius: 0
    }
  ];

  drinkLogs.forEach((log, index) => {
    // Distribute angles evenly around the center node
    const baseAngle = (2 * Math.PI * index) / drinkLogs.length;
    
    // Resolve dynamic color from configurations
    const config = Object.values(LIQUID_CONFIGS).find(c => c.tag === log.tag);
    const color = config ? config.color : theme.colors.accent;

    nodes.push({
      id: log.id,
      label: `${log.amount}ml`,
      subLabel: log.type.toUpperCase(),
      tag: log.tag,
      amount: log.amount,
      multiplier: Math.round((log.effectiveAmount / log.amount) * 1000) / 1000,
      color,
      type: 'drink',
      baseAngle,
      radius: 95 // distance from center node
    });
  });

  // Calculate base node radius based on container volume (e.g. 150ml vs 1000ml)
  const getBaseNodeRadius = (amount: number) => {
    return Math.min(12, Math.max(4, 3 + (amount / 100)));
  };

  // Calculate animated coordinates (Applies both Zoom and Pan Offsets)
  const getCoordinates = (node: NodeItem) => {
    if (node.type === 'day') {
      // Gentle center node floating
      const x = CX + 3 * Math.sin(time * 0.02) + offsetX;
      const y = CY + 3 * Math.cos(time * 0.02) + offsetY;
      return { x, y };
    }

    // Drink nodes float in orbit
    // Sinusoidal orbit oscillation + random offset waves + dynamic zoom factor + drag offsets
    const orbitAngle = node.baseAngle + 0.05 * Math.sin(time * 0.01 + node.baseAngle);
    const floatRadius = (node.radius * zoom) + 6 * Math.cos(time * 0.03 + node.id.charCodeAt(0));
    
    const x = CX + floatRadius * Math.cos(orbitAngle) + 4 * Math.sin(time * 0.04 + node.baseAngle) + offsetX;
    const y = CY + floatRadius * Math.sin(orbitAngle) + 4 * Math.cos(time * 0.045 + node.baseAngle) + offsetY;
    
    return { x, y };
  };

  const handleZoomIn = () => {
    Haptics.selectionAsync();
    setZoom(z => Math.min(2.5, z + 0.15));
  };

  const handleZoomOut = () => {
    Haptics.selectionAsync();
    setZoom(z => Math.max(0.4, z - 0.15));
  };

  const handleZoomReset = () => {
    Haptics.selectionAsync();
    setZoom(1.0);
    setOffsetX(0); // Resets view position back to default center
    setOffsetY(0);
  };

  const centerNode = nodes[0];
  const centerCoords = getCoordinates(centerNode);

  return (
    <View style={styles.container}>
      <Text style={styles.markdownHeader}># graph-view.md</Text>
      
      {/* Svg Interactive Graph Screen */}
      <View style={styles.graphContainer}>
        <View style={styles.canvasHeader}>
          <Text style={styles.graphLabel}>Graph view of water-logs</Text>
          
          {/* Obsidian-Style Zoom Settings Overlay */}
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
              <Text style={styles.zoomResetText}>reset</Text>
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

        {/* Pan Handlers wrapper to capture 2-finger pinch gesture AND single-finger pan dragging */}
        <View style={styles.canvasWrapper} {...panResponder.panHandlers}>
          <Svg width="100%" height={CANVAS_HEIGHT} style={styles.svgCanvas}>
            {/* Dynamic Grid Guidelines (Scales proportionally with zoom + shifts in sync with panning) */}
            {[1, 2, 3].map((circleVal) => (
              <Circle
                key={circleVal}
                cx={CX + offsetX}
                cy={CY + offsetY}
                r={circleVal * 55 * zoom}
                fill="none"
                stroke={theme.colors.borderMuted}
                strokeWidth={0.5}
                strokeDasharray="4 6"
              />
            ))}

            {/* Render Link Edges first so they are layered behind the node buttons */}
            {nodes.slice(1).map((node) => {
              const coords = getCoordinates(node);
              const isSelected = selectedNode?.id === node.id;
              return (
                <Line
                  key={`line-${node.id}`}
                  x1={centerCoords.x}
                  y1={centerCoords.y}
                  x2={coords.x}
                  y2={coords.y}
                  stroke={isSelected ? node.color : theme.colors.border}
                  strokeWidth={isSelected ? 1.5 : 0.8}
                  strokeDasharray={node.tag === '#water' ? undefined : '3 3'}
                />
              );
            })}

            {/* Render Drink Nodes */}
            {nodes.slice(1).map((node) => {
              const coords = getCoordinates(node);
              const isSelected = selectedNode?.id === node.id;
              
              // Calculate responsive node radius: volume base * zoom scale
              const baseRad = getBaseNodeRadius(node.amount);
              const nodeRad = baseRad * zoom * (isSelected ? 1.4 : 1.0);
              
              return (
                <G key={node.id} onPress={() => setSelectedNode(isSelected ? null : node)}>
                  {/* Node outer glow on selection (scales with zoom) */}
                  {isSelected && (
                    <Circle
                      cx={coords.x}
                      cy={coords.y}
                      r={nodeRad * 2}
                      fill={node.color}
                      opacity={0.25}
                    />
                  )}
                  {/* Node Core */}
                  <Circle
                    cx={coords.x}
                    cy={coords.y}
                    r={nodeRad}
                    fill={node.color}
                    stroke={theme.colors.background}
                    strokeWidth={1.5}
                  />
                  {/* Node Text tag */}
                  <SvgText
                    x={coords.x}
                    y={coords.y - 12}
                    fill={isSelected ? theme.colors.text : theme.colors.textMuted}
                    fontSize={8}
                    fontFamily={theme.typography.mono}
                    textAnchor="middle"
                    fontWeight={isSelected ? 'bold' : 'normal'}
                  >
                    {node.label}
                  </SvgText>
                </G>
              );
            })}

            {/* Render Central Today Node */}
            <G onPress={() => setSelectedNode(selectedNode?.id === centerNode.id ? null : centerNode)}>
              {selectedNode?.id === centerNode.id && (
                <Circle
                  cx={centerCoords.x}
                  cy={centerCoords.y}
                  r={20 * zoom * 1.5}
                  fill={theme.colors.accent}
                  opacity={0.15}
                />
              )}
              <Circle
                cx={centerCoords.x}
                cy={centerCoords.y}
                r={12 * zoom}
                fill="#000000"
                stroke={theme.colors.accent}
                strokeWidth={2}
              />
              <Circle
                cx={centerCoords.x}
                cy={centerCoords.y}
                r={4 * zoom}
                fill={theme.colors.accent}
              />
              <SvgText
                x={centerCoords.x}
                y={centerCoords.y - 18}
                fill={theme.colors.text}
                fontSize={10}
                fontWeight="bold"
                fontFamily={theme.typography.mono}
                textAnchor="middle"
              >
                Today
              </SvgText>
            </G>
          </Svg>
        </View>

        <Text style={styles.interactiveHint}>*Pinch to zoom. Swipe to pan. Tap nodes to inspect.*</Text>
      </View>

      {/* Selected Node Inspector Pane (Obsidian Panel Style) */}
      <View style={styles.inspectorContainer}>
        <Text style={styles.sectionTitle}>## node-inspector</Text>
        
        {selectedNode ? (
          <View style={styles.inspectorCard}>
            <View style={styles.yamlRow}>
              <Text style={styles.yamlKey}>node_id: </Text>
              <Text style={[styles.yamlVal, { color: selectedNode.color }]}>{selectedNode.id.substring(0, 12)}...</Text>
            </View>
            <View style={styles.yamlRow}>
              <Text style={styles.yamlKey}>class: </Text>
              <Text style={styles.yamlVal}>{selectedNode.type === 'day' ? 'daily_note' : 'liquid_log'}</Text>
            </View>
            <View style={styles.yamlRow}>
              <Text style={styles.yamlKey}>label: </Text>
              <Text style={styles.yamlVal}>{selectedNode.label} ({selectedNode.subLabel})</Text>
            </View>
            <View style={styles.yamlRow}>
              <Text style={styles.yamlKey}>metadata_tags: </Text>
              <Text style={[styles.yamlVal, { color: selectedNode.color }]}>[{selectedNode.tag}]</Text>
            </View>
            {selectedNode.type === 'drink' && (() => {
              const eff = selectedNode.amount * selectedNode.multiplier;
              const formattedEff = Number(eff.toFixed(1)); // Keeps 1 decimal only if fractional
              return (
                <View style={styles.yamlRow}>
                  <Text style={styles.yamlKey}>hydration_ratio: </Text>
                  <Text style={styles.yamlVal}>
                    {Number(selectedNode.multiplier.toFixed(3))}x (effective: {formattedEff}ml)
                  </Text>
                </View>
              );
            })()}
          </View>
        ) : (
          <View style={styles.inspectorPlaceholder}>
            <Text style={styles.placeholderText}>No node selected.</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    padding: theme.spacing.md,
  },
  markdownHeader: {
    fontFamily: theme.typography.mono,
    fontSize: 18,
    fontWeight: theme.typography.weight.bold,
    color: theme.colors.text,
    marginBottom: theme.spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.border,
    paddingBottom: 6,
  },
  graphContainer: {
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    overflow: 'hidden',
    marginBottom: theme.spacing.md,
  },
  canvasHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingTop: theme.spacing.sm,
    paddingBottom: theme.spacing.xs,
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.borderMuted,
  },
  graphLabel: {
    fontFamily: theme.typography.mono,
    fontSize: 10,
    color: theme.colors.textMuted,
  },
  canvasWrapper: {
    width: '100%',
    height: CANVAS_HEIGHT,
  },
  svgCanvas: {
    backgroundColor: '#030303',
  },
  zoomContainer: {
    flexDirection: 'row',
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  zoomBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: theme.colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomBtnText: {
    fontFamily: theme.typography.mono,
    fontSize: 11,
    fontWeight: 'bold',
    color: theme.colors.text,
  },
  zoomResetBtn: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: theme.colors.borderMuted,
    backgroundColor: '#050505',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoomResetText: {
    fontFamily: theme.typography.mono,
    fontSize: 8,
    color: theme.colors.accentAmber,
    fontWeight: 'bold',
  },
  interactiveHint: {
    fontFamily: theme.typography.mono,
    fontSize: 9,
    color: theme.colors.textSubtle,
    marginVertical: theme.spacing.sm,
    textAlign: 'center',
  },
  inspectorContainer: {
    gap: theme.spacing.sm,
  },
  sectionTitle: {
    fontFamily: theme.typography.mono,
    fontSize: 12,
    color: theme.colors.text,
    fontWeight: theme.typography.weight.semibold,
  },
  inspectorCard: {
    backgroundColor: '#050505',
    borderWidth: 1,
    borderColor: theme.colors.borderMuted,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.md,
    gap: 4,
  },
  inspectorPlaceholder: {
    backgroundColor: '#030303',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: theme.colors.border,
    borderRadius: theme.borderRadius.sm,
    padding: theme.spacing.lg,
    alignItems: 'center',
  },
  placeholderText: {
    fontFamily: theme.typography.mono,
    fontSize: 11,
    color: theme.colors.textSubtle,
  },
  yamlRow: {
    flexDirection: 'row',
  },
  yamlKey: {
    fontFamily: theme.typography.mono,
    color: theme.colors.accentAmber,
    fontSize: 11,
  },
  yamlVal: {
    fontFamily: theme.typography.mono,
    color: theme.colors.text,
    fontSize: 11,
  },
});
