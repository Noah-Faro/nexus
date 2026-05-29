import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { theme } from '../theme';
import * as Haptics from 'expo-haptics';

interface SegmentedControlProps<T extends string | number> {
  values: readonly T[] | T[];
  selectedValue: T;
  onChange: (value: T) => void;
  labels?: readonly string[] | string[];
  icons?: (React.ReactNode | null)[];
}

export default function SegmentedControl<T extends string | number>({
  values,
  selectedValue,
  onChange,
  labels,
  icons,
}: SegmentedControlProps<T>) {
  const handleSelect = (val: T) => {
    Haptics.selectionAsync();
    onChange(val);
  };

  return (
    <View style={styles.segmentedControl}>
      {values.map((val, index) => {
        const isSelected = selectedValue === val;
        const displayLabel = labels ? labels[index] : String(val);
        const icon = icons && icons[index] ? icons[index] : null;

        return (
          <TouchableOpacity
            key={String(val)}
            style={[styles.segment, isSelected && styles.activeSegment]}
            onPress={() => handleSelect(val)}
            activeOpacity={0.8}
          >
            {icon && (
              <View style={styles.iconContainer}>
                {React.cloneElement(icon as React.ReactElement<any>, {
                  color: isSelected ? '#000000' : theme.colors.text,
                })}
              </View>
            )}
            <Text style={[styles.segmentText, isSelected && styles.activeSegmentText]}>
              {displayLabel}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceElevated,
    borderRadius: theme.borderRadius.sm,
    padding: 2,
    alignSelf: 'stretch',
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    borderRadius: theme.borderRadius.sm - 2,
    gap: 6,
  },
  activeSegment: {
    backgroundColor: theme.colors.text,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 1,
    elevation: 2,
  },
  iconContainer: {
    marginRight: 2,
  },
  segmentText: {
    fontFamily: theme.typography.sans,
    fontSize: 13,
    fontWeight: theme.typography.weight.medium,
    color: theme.colors.text,
  },
  activeSegmentText: {
    color: '#000000',
    fontWeight: theme.typography.weight.semibold,
  },
});
