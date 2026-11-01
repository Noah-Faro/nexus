import type {
  AnatomyRegionDisplay,
  AnatomySide,
  AnatomyView,
  RecoveryGroupName,
  RecoveryUnitDisplay,
  RecoveryUnitId,
} from './types';

const unit = (
  id: RecoveryUnitId,
  name: string,
  group: RecoveryGroupName,
  preferredView: AnatomyView,
  displayMode: RecoveryUnitDisplay['displayMode'],
  regionSlug?: string,
): RecoveryUnitDisplay => ({
  id,
  name,
  group,
  preferredView,
  displayMode,
  regionSlug,
});

export const recoveryUnitDisplayRegistry = [
  unit('upper_chest', 'Upper chest · clavicular head', 'Chest', 'front', 'shared', 'chest'),
  unit('lower_chest', 'Mid/lower chest · sternocostal head', 'Chest', 'front', 'shared', 'chest'),
  unit('anterior_deltoid', 'Anterior deltoid', 'Deltoids', 'front', 'shared', 'deltoids'),
  unit('lateral_deltoid', 'Lateral deltoid', 'Deltoids', 'front', 'shared', 'deltoids'),
  unit('posterior_deltoid', 'Posterior deltoid', 'Deltoids', 'back', 'shared', 'deltoids'),
  unit('biceps_long_head', 'Biceps brachii · long head', 'Biceps', 'front', 'shared', 'biceps'),
  unit('biceps_short_head', 'Biceps brachii · short head', 'Biceps', 'front', 'shared', 'biceps'),
  unit('brachialis', 'Brachialis', 'Biceps', 'front', 'shared', 'biceps'),
  unit('triceps_long_head', 'Triceps long head', 'Triceps', 'back', 'shared', 'triceps'),
  unit('triceps_lateral_head', 'Triceps lateral head', 'Triceps', 'back', 'shared', 'triceps'),
  unit('triceps_medial_head', 'Triceps medial head', 'Triceps', 'back', 'shared', 'triceps'),
  unit('upper_trapezius', 'Upper trapezius', 'Trapezius', 'front', 'shared', 'trapezius'),
  unit('middle_trapezius', 'Middle trapezius', 'Trapezius', 'back', 'shared', 'trapezius'),
  unit('lower_trapezius', 'Lower trapezius', 'Trapezius', 'back', 'shared', 'trapezius'),
  unit('latissimus_dorsi', 'Latissimus dorsi', 'Upper back', 'back', 'shared', 'upper-back'),
  unit('rhomboid', 'Rhomboid', 'Upper back', 'back', 'shared', 'upper-back'),
  unit('teres_major', 'Teres major', 'Upper back', 'back', 'shared', 'upper-back'),
  unit('serratus_anterior', 'Serratus anterior', 'Upper back', 'back', 'shared', 'upper-back'),
  unit('supraspinatus', 'Supraspinatus', 'Rotator cuff', 'back', 'shared', 'upper-back'),
  unit('infraspinatus', 'Infraspinatus', 'Rotator cuff', 'back', 'shared', 'upper-back'),
  unit('teres_minor', 'Teres minor', 'Rotator cuff', 'back', 'shared', 'upper-back'),
  unit('subscapularis', 'Subscapularis', 'Rotator cuff', 'front', 'list-only'),
  unit('upper_abs', 'Upper abs', 'Core', 'front', 'direct', 'abs'),
  unit('lower_abs', 'Lower abs', 'Core', 'front', 'direct', 'abs'),
  unit('upper_oblique', 'Upper oblique', 'Core', 'front', 'direct', 'obliques'),
  unit('lower_oblique', 'Lower oblique', 'Core', 'front', 'direct', 'obliques'),
  unit('rectus_femoris', 'Rectus femoris', 'Quadriceps', 'front', 'direct', 'quadriceps'),
  unit('vastus_lateralis', 'Vastus lateralis', 'Quadriceps', 'front', 'direct', 'quadriceps'),
  unit('vastus_medialis', 'Vastus medialis', 'Quadriceps', 'front', 'direct', 'quadriceps'),
  unit('vastus_intermedius', 'Vastus intermedius', 'Quadriceps', 'front', 'list-only'),
  unit('biceps_femoris_long_head', 'Biceps femoris · long head', 'Hamstrings', 'back', 'shared', 'hamstring'),
  unit('biceps_femoris_short_head', 'Biceps femoris · short head', 'Hamstrings', 'back', 'shared', 'hamstring'),
  unit('semitendinosus', 'Semitendinosus', 'Hamstrings', 'back', 'shared', 'hamstring'),
  unit('semimembranosus', 'Semimembranosus', 'Hamstrings', 'back', 'shared', 'hamstring'),
  unit('gluteus_maximus', 'Gluteus maximus', 'Glutes', 'back', 'shared', 'gluteal'),
  unit('gluteus_medius', 'Gluteus medius', 'Glutes', 'back', 'shared', 'gluteal'),
  unit('gluteus_minimus', 'Gluteus minimus', 'Glutes', 'back', 'shared', 'gluteal'),
  unit('adductor_longus', 'Adductor longus', 'Adductors', 'front', 'direct', 'adductors'),
  unit('adductor_magnus', 'Adductor magnus', 'Adductors', 'front', 'direct', 'adductors'),
  unit('gracilis', 'Gracilis', 'Adductors', 'front', 'direct', 'adductors'),
  unit('gastrocnemius_medial_head', 'Gastrocnemius medial head', 'Calves', 'back', 'shared', 'calves'),
  unit('gastrocnemius_lateral_head', 'Gastrocnemius lateral head', 'Calves', 'back', 'shared', 'calves'),
  unit('soleus', 'Soleus', 'Calves', 'back', 'shared', 'calves'),
  unit('tibialis_anterior', 'Tibialis anterior', 'Tibialis', 'front', 'direct', 'tibialis'),
  unit('psoas_major', 'Psoas major', 'Hip flexors', 'front', 'list-only'),
  unit('iliacus', 'Iliacus', 'Hip flexors', 'front', 'list-only'),
  unit('brachioradialis', 'Brachioradialis', 'Forearms', 'front', 'shared', 'forearm'),
  unit('forearm_flexors', 'Forearm flexors', 'Forearms', 'front', 'shared', 'forearm'),
  unit('forearm_extensors', 'Forearm extensors', 'Forearms', 'back', 'shared', 'forearm'),
  unit('upper_erector_spinae', 'Upper erector spinae', 'Erector spinae', 'back', 'direct', 'lower-back'),
  unit('lower_erector_spinae', 'Lower erector spinae', 'Erector spinae', 'back', 'direct', 'lower-back'),
] as const satisfies readonly RecoveryUnitDisplay[];

const shared = (
  view: AnatomyView,
  slug: string,
  parentLabel: string,
  unitIds: readonly RecoveryUnitId[],
): AnatomyRegionDisplay => ({
  view,
  slug,
  parentLabel,
  treatment: 'shared',
  unitIds,
});

const direct = (
  view: AnatomyView,
  slug: string,
  parentLabel: string,
  pathUnitIds: Readonly<Partial<Record<AnatomySide, readonly RecoveryUnitId[]>>>,
): AnatomyRegionDisplay => ({
  view,
  slug,
  parentLabel,
  treatment: 'direct',
  pathUnitIds,
});

const structural = (
  view: AnatomyView,
  slug: string,
  parentLabel: string,
): AnatomyRegionDisplay => ({
  view,
  slug,
  parentLabel,
  treatment: 'structural',
});

export const anatomyRegionDisplayRegistry: readonly AnatomyRegionDisplay[] = [
  shared('front', 'chest', 'Chest', ['upper_chest', 'lower_chest']),
  direct('front', 'obliques', 'Core', {
    left: ['upper_oblique', 'upper_oblique', 'upper_oblique', 'upper_oblique', 'lower_oblique', 'lower_oblique', 'lower_oblique', 'lower_oblique'],
    right: ['upper_oblique', 'upper_oblique', 'upper_oblique', 'upper_oblique', 'lower_oblique', 'lower_oblique', 'lower_oblique', 'lower_oblique'],
  }),
  direct('front', 'abs', 'Core', {
    left: ['upper_abs', 'lower_abs', 'upper_abs', 'lower_abs'],
    right: ['upper_abs', 'upper_abs', 'lower_abs', 'lower_abs'],
  }),
  shared('front', 'biceps', 'Biceps', ['biceps_long_head', 'biceps_short_head', 'brachialis']),
  shared('front', 'triceps', 'Triceps', ['triceps_long_head', 'triceps_lateral_head', 'triceps_medial_head']),
  {
    view: 'front',
    slug: 'neck',
    parentLabel: 'Neck',
    treatment: 'unavailable',
    unavailableReason: 'No neck-specific exercise mapping exists.',
  },
  shared('front', 'trapezius', 'Trapezius', ['upper_trapezius', 'middle_trapezius', 'lower_trapezius']),
  shared('front', 'deltoids', 'Deltoids', ['anterior_deltoid', 'lateral_deltoid', 'posterior_deltoid']),
  direct('front', 'adductors', 'Adductors', {
    left: ['adductor_longus', 'adductor_magnus', 'gracilis'],
    right: ['adductor_longus', 'adductor_magnus', 'gracilis'],
  }),
  direct('front', 'quadriceps', 'Quadriceps', {
    left: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis'],
    right: ['rectus_femoris', 'vastus_lateralis', 'vastus_medialis'],
  }),
  structural('front', 'knees', 'Knees'),
  direct('front', 'tibialis', 'Tibialis', {
    left: ['tibialis_anterior'],
    right: ['tibialis_anterior'],
  }),
  shared('front', 'calves', 'Calves', ['gastrocnemius_medial_head', 'gastrocnemius_lateral_head', 'soleus']),
  shared('front', 'forearm', 'Forearms', ['brachioradialis', 'forearm_flexors', 'forearm_extensors']),
  structural('front', 'hands', 'Hands'),
  structural('front', 'ankles', 'Ankles'),
  structural('front', 'feet', 'Feet'),
  structural('front', 'head', 'Head'),
  structural('front', 'hair', 'Hair'),
  {
    view: 'back',
    slug: 'neck',
    parentLabel: 'Neck',
    treatment: 'unavailable',
    unavailableReason: 'No neck-specific exercise mapping exists.',
  },
  shared('back', 'trapezius', 'Trapezius', ['upper_trapezius', 'middle_trapezius', 'lower_trapezius']),
  shared('back', 'deltoids', 'Deltoids', ['anterior_deltoid', 'lateral_deltoid', 'posterior_deltoid']),
  shared('back', 'upper-back', 'Upper back', [
    'rhomboid',
    'teres_major',
    'latissimus_dorsi',
    'serratus_anterior',
    'supraspinatus',
    'infraspinatus',
    'teres_minor',
  ]),
  shared('back', 'triceps', 'Triceps', ['triceps_long_head', 'triceps_lateral_head', 'triceps_medial_head']),
  direct('back', 'lower-back', 'Erector spinae', {
    left: ['lower_erector_spinae', 'upper_erector_spinae'],
    right: ['upper_erector_spinae', 'lower_erector_spinae'],
  }),
  shared('back', 'forearm', 'Forearms', ['brachioradialis', 'forearm_flexors', 'forearm_extensors']),
  shared('back', 'gluteal', 'Glutes', ['gluteus_maximus', 'gluteus_medius', 'gluteus_minimus']),
  direct('back', 'adductors', 'Adductors', {
    left: ['adductor_magnus'],
    right: ['adductor_magnus'],
  }),
  shared('back', 'hamstring', 'Hamstrings', [
    'biceps_femoris_long_head',
    'biceps_femoris_short_head',
    'semitendinosus',
    'semimembranosus',
  ]),
  shared('back', 'calves', 'Calves', ['gastrocnemius_medial_head', 'gastrocnemius_lateral_head', 'soleus']),
  structural('back', 'ankles', 'Ankles'),
  structural('back', 'feet', 'Feet'),
  structural('back', 'hands', 'Hands'),
  structural('back', 'head', 'Head'),
  structural('back', 'hair', 'Hair'),
];

export const recoveryUnitDisplayById = new Map(
  recoveryUnitDisplayRegistry.map((entry) => [entry.id, entry]),
);

export const anatomyRegionDisplayByKey = new Map(
  anatomyRegionDisplayRegistry.map((entry) => [
    `${entry.view}:${entry.slug}`,
    entry,
  ]),
);

export const listOnlyRecoveryUnitIds = recoveryUnitDisplayRegistry
  .filter((entry) => entry.displayMode === 'list-only')
  .map((entry) => entry.id);

export const mapSelectableRecoveryUnitIds = recoveryUnitDisplayRegistry
  .filter((entry) => entry.displayMode !== 'list-only')
  .map((entry) => entry.id);

export const resolveDirectPathUnitId = (
  view: AnatomyView,
  slug: string,
  side: AnatomySide,
  pathIndex: number,
): RecoveryUnitId | undefined => {
  const region = anatomyRegionDisplayByKey.get(`${view}:${slug}`);
  if (region?.treatment !== 'direct') {
    return undefined;
  }

  return region.pathUnitIds?.[side]?.[pathIndex];
};

export const isRecoveryUnitVisibleInView = (
  unitId: RecoveryUnitId,
  view: AnatomyView,
): boolean =>
  anatomyRegionDisplayRegistry.some((region) => {
    if (region.view !== view) return false;
    if (region.treatment === 'shared') {
      return region.unitIds?.includes(unitId) ?? false;
    }
    if (region.treatment === 'direct') {
      return Object.values(region.pathUnitIds ?? {}).some((pathUnitIds) =>
        pathUnitIds?.includes(unitId),
      );
    }
    return false;
  });
