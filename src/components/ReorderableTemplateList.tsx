import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityActionEvent,
  AccessibilityInfo,
  Animated,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { BarChart2, Dumbbell, List, Pencil, Plus } from 'lucide-react-native';
import { WorkoutTemplate } from '../trainingTypes';
import { theme } from '../theme';

const CARD_HEIGHT = 92;
const CARD_GAP = 16;
const CARD_STEP = CARD_HEIGHT + CARD_GAP;

export interface ReorderableTemplateListProps {
  templates: WorkoutTemplate[];
  onStart: (template: WorkoutTemplate | null) => void;
  onEdit: (template: WorkoutTemplate) => void;
  onReorder: (templates: WorkoutTemplate[]) => Promise<boolean>;
  onCreate: () => void;
  onOpenHistory: () => void;
  onOpenProgress: () => void;
}

function sameOrder(left: WorkoutTemplate[], right: WorkoutTemplate[]): boolean {
  return left.length === right.length && left.every((template, index) => template.id === right[index]?.id);
}

function targetSetCount(template: WorkoutTemplate): number {
  return template.exercises.reduce((total, exercise) => total + exercise.targetSets, 0);
}

function moveTemplate(templates: WorkoutTemplate[], from: number, to: number): WorkoutTemplate[] {
  const next = [...templates];
  const [moved] = next.splice(from, 1);
  if (!moved) return templates;
  next.splice(to, 0, moved);
  return next;
}

function resolveTemplateColor(color?: string): { icon: string; tile: string } {
  const candidate = color?.trim();
  const match = candidate?.match(/^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i);
  if (!match) {
    return { icon: theme.colors.accentCyan, tile: theme.colors.accentCyanFade };
  }

  let hex = match[1];
  if (hex.length === 3 || hex.length === 4) {
    hex = hex.slice(0, 3).split('').map(character => character + character).join('');
  } else {
    hex = hex.slice(0, 6);
  }

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);
  return {
    icon: `#${hex}`,
    tile: `rgba(${red}, ${green}, ${blue}, 0.14)`,
  };
}

// ---------------------------------------------------------------------------
// TemplateCard — pure visual component, NO PanResponder inside
// ---------------------------------------------------------------------------

interface TemplateCardProps {
  template: WorkoutTemplate;
  index: number;
  total: number;
  panY: Animated.Value;
  positionAnim: Animated.Value;
  draggingId: string | null;
  panHandlers: Record<string, any>;
  onEdit: () => void;
  onMove: (direction: -1 | 1) => void;
}

const TemplateCard = React.memo(({
  template,
  index,
  total,
  panY,
  positionAnim,
  draggingId,
  panHandlers,
  onEdit,
  onMove,
}: TemplateCardProps) => {
  const id = template.id;
  const isDragging = draggingId === id;
  const isAnyDragging = draggingId !== null;

  const templateColors = useMemo(() => resolveTemplateColor(template.color), [template.color]);
  const exerciseCount = template.exercises.length;
  const setCount = targetSetCount(template);
  const summary = `${exerciseCount} exercises \u2022 ${setCount} target sets`;

  const handleAccessibilityAction = useCallback((event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'moveUp') onMove(-1);
    if (event.nativeEvent.actionName === 'moveDown') onMove(1);
  }, [onMove]);

  // Visual transform: when this card is being dragged, use panY. Otherwise use
  // positionAnim (spring-animated by the parent on swap).
  const translateY = isDragging ? panY : positionAnim;

  const opacity = isDragging ? 0.82 : isAnyDragging ? 0.55 : 1;
  const zIndex = isDragging ? 100 : 1;
  const scale = isDragging ? 1.025 : 1;

  return (
    <Animated.View
      style={[
        styles.cardWrapper,
        {
          transform: [{ translateY }, { scale }],
          zIndex,
          opacity,
        },
      ]}
      {...panHandlers}
    >
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${template.name}, ${summary}, position ${index + 1} of ${total}`}
        accessibilityHint="Tap to start workout. Hold to reorder."
        accessibilityState={{ disabled: isAnyDragging }}
        accessibilityActions={[
          ...(index > 0 ? [{ name: 'moveUp', label: 'Move up' }] : []),
          ...(index < total - 1 ? [{ name: 'moveDown', label: 'Move down' }] : []),
        ]}
        onAccessibilityAction={handleAccessibilityAction}
        style={[
          styles.card,
          isDragging && styles.draggedCard,
        ]}
      >
        <View style={styles.cardBody}>
          <View style={[styles.iconTile, { backgroundColor: templateColors.tile }]}>
            <Dumbbell size={28} color={templateColors.icon} strokeWidth={1.8} />
          </View>
          <View style={styles.cardCopy}>
            <Text style={styles.templateName}>{template.name}</Text>
            <Text style={styles.templateSummary}>{summary}</Text>
          </View>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Edit ${template.name}`}
          accessibilityState={{ disabled: isAnyDragging }}
          disabled={isAnyDragging}
          hitSlop={4}
          onPress={onEdit}
          style={({ pressed }) => [styles.editButton, pressed && styles.pressedControl]}
        >
          <Pencil size={20} color={theme.colors.textMuted} strokeWidth={1.8} />
        </Pressable>
      </View>
    </Animated.View>
  );
});

// ---------------------------------------------------------------------------
// Main list component
// ---------------------------------------------------------------------------

export default function ReorderableTemplateList({
  templates,
  onStart,
  onEdit,
  onReorder,
  onCreate,
  onOpenHistory,
  onOpenProgress,
}: ReorderableTemplateListProps) {
  const [isPersisting, setIsPersisting] = useState(false);
  const [localTemplates, setLocalTemplates] = useState(templates);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  // Mutable ref of localTemplates so PanResponder handlers always read the
  // freshest order (avoids stale closures — same pattern as NexusVault).
  const orderRef = useRef(localTemplates);
  useEffect(() => { orderRef.current = localTemplates; }, [localTemplates]);

  // Callback refs for external callbacks (same pattern as NexusVault)
  const onStartRef = useRef(onStart);
  const onEditRef = useRef(onEdit);
  const onReorderRef = useRef(onReorder);
  useEffect(() => { onStartRef.current = onStart; }, [onStart]);
  useEffect(() => { onEditRef.current = onEdit; }, [onEdit]);
  useEffect(() => { onReorderRef.current = onReorder; }, [onReorder]);

  // ---- Drag refs (owned by parent, used by PanResponders) -----------------
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isDraggingRef = useRef(false);
  const isPersistingRef = useRef(isPersisting);
  useEffect(() => { isPersistingRef.current = isPersisting; }, [isPersisting]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (longPressTimer.current) clearTimeout(longPressTimer.current);
    };
  }, []);

  // ---- Animated values ---------------------------------------------------
  const panY = useRef(new Animated.Value(0)).current;

  // One Animated.Value per template id — created lazily and cached.
  const positionAnimMap = useRef<Record<string, Animated.Value>>({});
  const getPositionAnim = useCallback((id: string, index: number): Animated.Value => {
    if (!positionAnimMap.current[id]) {
      positionAnimMap.current[id] = new Animated.Value(index * CARD_STEP);
    }
    return positionAnimMap.current[id];
  }, []);

  // Sync from parent prop when not dragging or persisting
  useEffect(() => {
    if (!isPersisting && draggingId === null) {
      setLocalTemplates(templates);
      templates.forEach((t, i) => {
        getPositionAnim(t.id, i).setValue(i * CARD_STEP);
      });
    }
  }, [templates, isPersisting, draggingId, getPositionAnim]);

  // ---- PanResponders (all created in parent, keyed by template ID) --------
  // Rebuild when the set of template IDs changes (adds/removes).
  const templateIds = localTemplates.map(t => t.id).join(',');

  const panResponders = useMemo(() => {
    const responders: Record<string, any> = {};
    const ids = templateIds.split(',').filter(Boolean);

    ids.forEach(id => {
      let startY = 0;

      responders[id] = PanResponder.create({
        onStartShouldSetPanResponder: () => !isDraggingRef.current && !isPersistingRef.current,
        onMoveShouldSetPanResponder: () => !isDraggingRef.current && !isPersistingRef.current,
        onPanResponderTerminationRequest: () => !isDraggingRef.current,

        onPanResponderGrant: () => {
          if (longPressTimer.current) clearTimeout(longPressTimer.current);
          isDraggingRef.current = false;

          const currentIndex = orderRef.current.findIndex(t => t.id === id);
          startY = currentIndex * CARD_STEP;

          longPressTimer.current = setTimeout(() => {
            isDraggingRef.current = true;
            setDraggingId(id);
            panY.setValue(startY);
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
          }, 350);
        },

        onPanResponderMove: (_, gestureState) => {
          if (!isDraggingRef.current) {
            // Cancel long-press if finger moves too far before activation
            if (Math.abs(gestureState.dy) > 8 || Math.abs(gestureState.dx) > 8) {
              if (longPressTimer.current) {
                clearTimeout(longPressTimer.current);
                longPressTimer.current = null;
              }
            }
            return;
          }

          const newY = startY + gestureState.dy;
          panY.setValue(newY);

          // Inline collision detection (no addListener / __getValue)
          const current = orderRef.current;
          const hoverIndex = Math.max(0, Math.min(current.length - 1, Math.round(newY / CARD_STEP)));
          const currentIndex = current.findIndex(t => t.id === id);

          if (hoverIndex !== currentIndex) {
            Haptics.selectionAsync();
            const newOrder = [...current];
            newOrder.splice(currentIndex, 1);
            newOrder.splice(hoverIndex, 0, current[currentIndex]);
            orderRef.current = newOrder;

            // Animate non-dragged cards to their new positions
            newOrder.forEach((t, idx) => {
              if (t.id !== id) {
                const anim = positionAnimMap.current[t.id];
                if (anim) {
                  Animated.spring(anim, {
                    toValue: idx * CARD_STEP,
                    useNativeDriver: true,
                    bounciness: 0,
                  }).start();
                }
              }
            });
          }
        },

        onPanResponderRelease: () => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }

          if (!isDraggingRef.current) {
            // Tap — start workout
            const template = orderRef.current.find(t => t.id === id);
            if (template) onStartRef.current(template);
            return;
          }

          const finalOrder = orderRef.current;
          const finalIndex = finalOrder.findIndex(t => t.id === id);
          Animated.spring(panY, {
            toValue: finalIndex * CARD_STEP,
            useNativeDriver: true,
            bounciness: 0,
          }).start(() => {
            const anim = positionAnimMap.current[id];
            if (anim) anim.setValue(finalIndex * CARD_STEP);
            isDraggingRef.current = false;
            setDraggingId(null);
            setLocalTemplates([...finalOrder]);
            void finalizeReorder(finalOrder);
          });
        },

        onPanResponderTerminate: () => {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }

          if (isDraggingRef.current) {
            const finalOrder = orderRef.current;
            const finalIndex = finalOrder.findIndex(t => t.id === id);
            Animated.spring(panY, {
              toValue: finalIndex * CARD_STEP,
              useNativeDriver: true,
              bounciness: 0,
            }).start(() => {
              const anim = positionAnimMap.current[id];
              if (anim) anim.setValue(finalIndex * CARD_STEP);
              isDraggingRef.current = false;
              setDraggingId(null);
              setLocalTemplates([...finalOrder]);
              void finalizeReorder(finalOrder);
            });
          } else {
            isDraggingRef.current = false;
            setDraggingId(null);
          }
        },
      });
    });

    return responders;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateIds]);

  // Persist reorder to parent
  const finalizeReorder = useCallback(async (nextOrder: WorkoutTemplate[]) => {
    if (sameOrder(templates, nextOrder)) return;

    setIsPersisting(true);
    try {
      const didSave = await onReorderRef.current(nextOrder);
      if (!didSave) {
        // Rollback
        setLocalTemplates(templates);
        templates.forEach((t, i) => {
          const anim = positionAnimMap.current[t.id];
          if (anim) anim.setValue(i * CARD_STEP);
        });
        AccessibilityInfo.announceForAccessibility('Workout order was not saved. Previous order restored.');
      } else {
        const movedId = nextOrder.find((t, i) => templates[i]?.id !== t.id)?.id;
        if (movedId) {
          const movedTemplate = nextOrder.find(t => t.id === movedId);
          if (movedTemplate) {
            AccessibilityInfo.announceForAccessibility(
              `${movedTemplate.name} moved to position ${nextOrder.findIndex(t => t.id === movedId) + 1} of ${nextOrder.length}`
            );
          }
        }
      }
    } catch {
      setLocalTemplates(templates);
      templates.forEach((t, i) => {
        const anim = positionAnimMap.current[t.id];
        if (anim) anim.setValue(i * CARD_STEP);
      });
      AccessibilityInfo.announceForAccessibility('Workout order was not saved. Previous order restored.');
    }
    setIsPersisting(false);
  }, [templates]);

  // ---- Accessibility move (VoiceOver / TalkBack) -------------------------

  const handleAccessibleMove = useCallback(async (id: string, direction: -1 | 1) => {
    if (isPersisting || draggingId !== null) return;
    const previous = [...localTemplates];
    const fromIndex = previous.findIndex(template => template.id === id);
    const toIndex = Math.max(0, Math.min(previous.length - 1, fromIndex + direction));
    if (fromIndex < 0 || fromIndex === toIndex) return;

    const next = moveTemplate(previous, fromIndex, toIndex);
    const movedTemplate = next[toIndex];

    setLocalTemplates(next);
    next.forEach((t, i) => {
      const anim = positionAnimMap.current[t.id];
      if (anim) anim.setValue(i * CARD_STEP);
    });

    setIsPersisting(true);
    let didSave = false;
    try {
      didSave = await onReorder(next);
    } catch {
      didSave = false;
    }

    if (!didSave) {
      setLocalTemplates(previous);
      previous.forEach((t, i) => {
        const anim = positionAnimMap.current[t.id];
        if (anim) anim.setValue(i * CARD_STEP);
      });
      AccessibilityInfo.announceForAccessibility('Workout order was not saved. Previous order restored.');
    } else {
      AccessibilityInfo.announceForAccessibility(
        `${movedTemplate.name} moved to position ${toIndex + 1} of ${next.length}`
      );
    }
    setIsPersisting(false);
  }, [draggingId, isPersisting, localTemplates, onReorder]);

  // ---- Stable card callbacks ---------------------------------------------

  const handleCardEdit = useCallback((template: WorkoutTemplate) => {
    if (!isPersisting && draggingId === null) onEdit(template);
  }, [isPersisting, draggingId, onEdit]);

  const handleCardMove = useCallback((id: string, dir: -1 | 1) => {
    void handleAccessibleMove(id, dir);
  }, [handleAccessibleMove]);

  // ---- Reduce-motion preference ------------------------------------------
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const listHeight = Math.max(0, localTemplates.length * CARD_STEP - CARD_GAP);

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        scrollEnabled={draggingId === null && !isPersisting}
        keyboardDismissMode="on-drag"
        keyboardShouldPersistTaps="handled"
        scrollEventThrottle={16}
      >
        <Text style={styles.sectionTitle}>START WORKOUT</Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Quick Start"
          disabled={isPersisting}
          onPress={() => onStartRef.current(null)}
          style={({ pressed }) => [styles.quickStartButton, pressed && styles.pressedControl]}
        >
          <Plus size={20} color={theme.colors.background} strokeWidth={1.8} />
          <Text style={styles.quickStartButtonText}>Quick Start</Text>
        </Pressable>

        {localTemplates.length === 0 ? (
          <View style={styles.emptyCard} accessible accessibilityRole="text">
            <Dumbbell size={28} color={theme.colors.textMuted} strokeWidth={1.8} />
            <Text style={styles.emptyTitle}>No workout templates yet</Text>
            <Text style={styles.emptyCopy}>Create a template to start logging training.</Text>
          </View>
        ) : (
          <View style={[styles.list, { height: listHeight }]}>
            {localTemplates.map((template, index) => (
              <TemplateCard
                key={template.id}
                template={template}
                index={index}
                total={localTemplates.length}
                panY={panY}
                positionAnim={getPositionAnim(template.id, index)}
                draggingId={draggingId}
                panHandlers={localTemplates.length > 1 && panResponders[template.id]
                  ? panResponders[template.id].panHandlers
                  : {}}
                onEdit={() => handleCardEdit(template)}
                onMove={(dir) => handleCardMove(template.id, dir)}
              />
            ))}
          </View>
        )}

        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Create workout template"
          disabled={isPersisting}
          onPress={onCreate}
          style={({ pressed }) => [styles.createButton, pressed && styles.pressedControl]}
        >
          <Plus size={20} color={theme.colors.text} strokeWidth={1.8} />
          <Text style={styles.createButtonText}>Create Template</Text>
        </Pressable>

        <View style={styles.navigationRow}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open workout history"
            onPress={onOpenHistory}
            style={({ pressed }) => [styles.navigationCard, pressed && styles.pressedControl]}
          >
            <List size={24} color={theme.colors.textMuted} strokeWidth={1.8} />
            <Text style={styles.navigationText}>History</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Open training progress"
            onPress={onOpenProgress}
            style={({ pressed }) => [styles.navigationCard, pressed && styles.pressedControl]}
          >
            <BarChart2 size={24} color={theme.colors.textMuted} strokeWidth={1.8} />
            <Text style={styles.navigationText}>Progress</Text>
          </Pressable>
        </View>

        {reduceMotion && draggingId !== null ? (
          <Text style={styles.srStatus} accessibilityLiveRegion="polite">
            Reordering workout templates
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

export function ReorderableTemplateSkeleton() {
  return (
    <View style={styles.root} accessible={false} pointerEvents="none">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        <View style={styles.skeletonSectionTitle} />
        {[0, 1, 2].map(index => (
          <View key={index} style={styles.skeletonCard}>
            <View style={styles.skeletonIcon} />
            <View style={styles.skeletonCopy}>
              <View style={styles.skeletonTitle} />
              <View style={styles.skeletonSummary} />
            </View>
            <View style={styles.skeletonEdit} />
          </View>
        ))}
        <View style={styles.skeletonCreate} />
        <View style={styles.navigationRow}>
          <View style={styles.skeletonNavigation} />
          <View style={styles.skeletonNavigation} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  scroll: {
    flex: 1,
  },
  content: {
    padding: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  sectionTitle: {
    fontFamily: theme.typography.semibold,
    fontSize: 14,
    color: theme.colors.textMuted,
    letterSpacing: 2,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  list: {
    position: 'relative',
  },
  cardWrapper: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    minHeight: CARD_HEIGHT,
  },
  card: {
    minHeight: CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
  },
  draggedCard: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
  cardBody: {
    minHeight: CARD_HEIGHT,
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: theme.spacing.md,
    paddingVertical: theme.spacing.md,
  },
  iconTile: {
    width: 60,
    height: 60,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.spacing.md,
    marginRight: theme.spacing.md,
  },
  cardCopy: {
    flex: 1,
    minWidth: 0,
  },
  templateName: {
    fontFamily: theme.typography.semibold,
    fontSize: 18,
    lineHeight: 24,
    color: theme.colors.text,
    marginBottom: theme.spacing.xs,
  },
  templateSummary: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    lineHeight: 20,
    color: theme.colors.textMuted,
  },
  editButton: {
    minWidth: 48,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: theme.spacing.sm,
    borderRadius: theme.borderRadius.md,
  },
  pressedControl: {
    opacity: 0.65,
  },
  emptyCard: {
    minHeight: CARD_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
  },
  emptyTitle: {
    fontFamily: theme.typography.semibold,
    fontSize: 16,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  emptyCopy: {
    fontFamily: theme.typography.sans,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    color: theme.colors.textMuted,
    marginTop: theme.spacing.xs,
  },
  quickStartButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    marginBottom: theme.spacing.md,
    backgroundColor: theme.colors.text,
    borderRadius: theme.borderRadius.md,
  },
  quickStartButtonText: {
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.background,
    marginLeft: theme.spacing.sm,
  },
  createButton: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.md,
    marginTop: theme.spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.border,
    borderStyle: 'dashed',
    borderRadius: theme.borderRadius.md,
  },
  createButtonText: {
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.text,
    marginLeft: theme.spacing.sm,
  },
  navigationRow: {
    flexDirection: 'row',
    gap: theme.spacing.md,
    marginTop: theme.spacing.lg,
  },
  navigationCard: {
    minHeight: 80,
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surface,
    borderRadius: theme.borderRadius.md,
  },
  navigationText: {
    fontFamily: theme.typography.semibold,
    fontSize: 15,
    color: theme.colors.text,
    marginTop: theme.spacing.sm,
  },
  srStatus: {
    position: 'absolute',
    width: 1,
    height: 1,
    opacity: 0,
  },
  skeletonSectionTitle: {
    width: 128,
    height: 14,
    borderRadius: theme.borderRadius.xs,
    backgroundColor: theme.colors.border,
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
  skeletonCard: {
    minHeight: CARD_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    padding: theme.spacing.md,
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.lg,
    marginBottom: CARD_GAP,
  },
  skeletonIcon: {
    width: 60,
    height: 60,
    borderRadius: theme.spacing.md,
    backgroundColor: theme.colors.border,
    marginRight: theme.spacing.md,
  },
  skeletonCopy: {
    flex: 1,
  },
  skeletonTitle: {
    width: '64%',
    height: 18,
    borderRadius: theme.borderRadius.xs,
    backgroundColor: theme.colors.border,
    marginBottom: theme.spacing.sm,
  },
  skeletonSummary: {
    width: '82%',
    height: 14,
    borderRadius: theme.borderRadius.xs,
    backgroundColor: theme.colors.borderMuted,
  },
  skeletonEdit: {
    width: 44,
    height: 44,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.border,
  },
  skeletonCreate: {
    height: 48,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
    marginTop: theme.spacing.sm,
  },
  skeletonNavigation: {
    height: 80,
    flex: 1,
    borderRadius: theme.borderRadius.md,
    backgroundColor: theme.colors.surface,
  },
});
