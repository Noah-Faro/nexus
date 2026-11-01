export type AnatomyView = 'front' | 'back';

export type AnatomySide = 'left' | 'right' | 'common';

export type AnatomyPathMap = Readonly<
  Partial<Record<AnatomySide, readonly string[]>>
>;

export interface AnatomyPathGroup {
  readonly slug: string;
  readonly color: string;
  readonly path: AnatomyPathMap;
}

export type RecoveryUnitDisplayMode = 'direct' | 'shared' | 'list-only';

export interface RecoveryUnitDisplay {
  readonly id: RecoveryUnitId;
  readonly name: string;
  readonly group: RecoveryGroupName;
  readonly preferredView: AnatomyView;
  readonly displayMode: RecoveryUnitDisplayMode;
  readonly regionSlug?: string;
}

export type RegionTreatment =
  | 'direct'
  | 'shared'
  | 'structural'
  | 'unavailable';

export interface AnatomyRegionDisplay {
  readonly view: AnatomyView;
  readonly slug: string;
  readonly parentLabel: string;
  readonly treatment: RegionTreatment;
  readonly unitIds?: readonly RecoveryUnitId[];
  readonly pathUnitIds?: Readonly<
    Partial<Record<AnatomySide, readonly RecoveryUnitId[]>>
  >;
  readonly unavailableReason?: string;
}

export type RecoveryGroupName =
  | 'Chest'
  | 'Deltoids'
  | 'Biceps'
  | 'Triceps'
  | 'Trapezius'
  | 'Upper back'
  | 'Rotator cuff'
  | 'Core'
  | 'Quadriceps'
  | 'Hamstrings'
  | 'Glutes'
  | 'Adductors'
  | 'Calves'
  | 'Tibialis'
  | 'Hip flexors'
  | 'Forearms'
  | 'Erector spinae';

export type RecoveryUnitId =
  | 'upper_chest'
  | 'lower_chest'
  | 'anterior_deltoid'
  | 'lateral_deltoid'
  | 'posterior_deltoid'
  | 'biceps_long_head'
  | 'biceps_short_head'
  | 'brachialis'
  | 'triceps_long_head'
  | 'triceps_lateral_head'
  | 'triceps_medial_head'
  | 'upper_trapezius'
  | 'middle_trapezius'
  | 'lower_trapezius'
  | 'latissimus_dorsi'
  | 'rhomboid'
  | 'teres_major'
  | 'serratus_anterior'
  | 'supraspinatus'
  | 'infraspinatus'
  | 'teres_minor'
  | 'subscapularis'
  | 'upper_abs'
  | 'lower_abs'
  | 'upper_oblique'
  | 'lower_oblique'
  | 'rectus_femoris'
  | 'vastus_lateralis'
  | 'vastus_medialis'
  | 'vastus_intermedius'
  | 'biceps_femoris_long_head'
  | 'biceps_femoris_short_head'
  | 'semitendinosus'
  | 'semimembranosus'
  | 'gluteus_maximus'
  | 'gluteus_medius'
  | 'gluteus_minimus'
  | 'adductor_longus'
  | 'adductor_magnus'
  | 'gracilis'
  | 'gastrocnemius_medial_head'
  | 'gastrocnemius_lateral_head'
  | 'soleus'
  | 'tibialis_anterior'
  | 'psoas_major'
  | 'iliacus'
  | 'brachioradialis'
  | 'forearm_flexors'
  | 'forearm_extensors'
  | 'upper_erector_spinae'
  | 'lower_erector_spinae';
