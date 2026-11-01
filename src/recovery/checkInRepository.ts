import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  isMuscleRecoveryUnitId,
  isRecoveryPresentationGroupId,
  type MuscleRecoveryUnitId,
  type RecoveryPresentationGroupId,
} from './types';

export const RECOVERY_OBSERVATION_STORAGE_SCHEMA_VERSION = 2 as const;
export const RECOVERY_OBSERVATION_SCALE_VERSION = 1 as const;
export const RECOVERY_OBSERVATION_STORAGE_KEY =
  '@nexus_recovery_observations_v2';

/** The former v1 envelope remains a migration source, never a write target. */
export const CHECK_IN_STORAGE_SCHEMA_VERSION = 1 as const;
export const CHECK_IN_SCALE_VERSION = RECOVERY_OBSERVATION_SCALE_VERSION;
export const CHECK_IN_STORAGE_KEY = '@nexus_recovery_checkins_v1';

const LEGACY_OBSERVATION_STORAGE_KEYS = [
  CHECK_IN_STORAGE_KEY,
  '@nexus_recovery_muscle_readiness_checkins_v1',
  '@nexus_muscle_readiness_checkins',
  '@nexus_recovery_checkins',
  'muscle_readiness_checkins',
] as const;

export type RecoveryObservationReadiness =
  | 0
  | 1
  | 2
  | 3
  | 4
  | 5
  | 6
  | 7
  | 8
  | 9
  | 10;

export type RecoveryObservationSource =
  | 'manual'
  | 'pre_workout'
  | 'unified_check_in';

export type RecoveryObservationTarget =
  | {
      readonly kind: 'presentation_group';
      readonly presentationGroupId: RecoveryPresentationGroupId;
    }
  | {
      readonly kind: 'legacy_unit';
      readonly unitId: MuscleRecoveryUnitId;
    };

interface RecoveryObservationBase {
  id: string;
  readiness: RecoveryObservationReadiness;
  scaleVersion: typeof RECOVERY_OBSERVATION_SCALE_VERSION;
  recordedAt: number;
  timezoneOffsetMinutes: number;
  source: RecoveryObservationSource;
  linkedPlannedSessionId?: string;
  linkedLoadRecordIds: string[];
  painPresent?: boolean;
  illnessPresent?: boolean;
  modelVersion: string;
  registryVersion: string;
  supersedesId?: string;
  createdAt: number;
  updatedAt: number;
}

/** A UI-visible observation. New repository writes can only create this kind. */
export interface RecoveryGroupObservation extends RecoveryObservationBase {
  target: Extract<RecoveryObservationTarget, { kind: 'presentation_group' }>;
}

/** A losslessly retained v1 unit check-in. UI selectors intentionally hide it. */
export interface LegacyUnitRecoveryObservation extends RecoveryObservationBase {
  target: Extract<RecoveryObservationTarget, { kind: 'legacy_unit' }>;
  unitId: MuscleRecoveryUnitId;
  observedBurden?: number;
}

export type RecoveryObservation =
  | RecoveryGroupObservation
  | LegacyUnitRecoveryObservation;

export interface AddRecoveryGroupObservationInput {
  id?: string;
  presentationGroupId: RecoveryPresentationGroupId;
  readiness: number;
  source: RecoveryObservationSource;
  linkedPlannedSessionId?: string;
  linkedLoadRecordIds?: readonly string[];
  painPresent?: boolean;
  illnessPresent?: boolean;
  modelVersion: string;
  registryVersion: string;
  recordedAt?: number;
  timezoneOffsetMinutes?: number;
}

export type SupersedeRecoveryGroupObservationInput = Omit<
  AddRecoveryGroupObservationInput,
  'presentationGroupId'
>;

interface RecoveryObservationStorageEnvelopeV2 {
  schemaVersion: typeof RECOVERY_OBSERVATION_STORAGE_SCHEMA_VERSION;
  updatedAt: number;
  observations: RecoveryObservation[];
}

interface StoredPayload {
  key: string;
  raw: string;
}

export type RecoveryObservationRepositoryErrorCode =
  | 'storage_read_failed'
  | 'storage_write_failed'
  | 'invalid_json'
  | 'unsupported_schema'
  | 'invalid_payload'
  | 'invalid_observation'
  | 'duplicate_id'
  | 'not_found'
  | 'supersession_conflict';

export class RecoveryObservationRepositoryError extends Error {
  readonly code: RecoveryObservationRepositoryErrorCode;
  readonly causeValue?: unknown;

  constructor(
    code: RecoveryObservationRepositoryErrorCode,
    message: string,
    causeValue?: unknown,
  ) {
    super(message);
    this.name = 'RecoveryObservationRepositoryError';
    this.code = code;
    this.causeValue = causeValue;
  }
}

export type RecoveryObservationRepositoryResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: RecoveryObservationRepositoryError };

let mutationQueue: Promise<void> = Promise.resolve();

function enqueueMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function invalid(message: string): never {
  throw new RecoveryObservationRepositoryError(
    'invalid_observation',
    message,
  );
}

function parseNonEmptyString(
  value: unknown,
  field: string,
  index?: number,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    const location = index === undefined ? '' : ` at index ${index}`;
    return invalid(
      `Invalid ${field}${location}: expected a non-empty string.`,
    );
  }
  return value;
}

function parseOptionalString(
  value: unknown,
  field: string,
  index: number,
): string | undefined {
  return value === undefined
    ? undefined
    : parseNonEmptyString(value, field, index);
}

function parseTimestamp(
  value: unknown,
  field: string,
  index?: number,
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value) ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    const location = index === undefined ? '' : ` at index ${index}`;
    return invalid(
      `Invalid ${field}${location}: expected a non-negative Unix timestamp.`,
    );
  }
  return value;
}

function parseIsoTimestamp(
  value: unknown,
  field: string,
  index: number,
): number {
  if (typeof value !== 'string') {
    return invalid(
      `Invalid ${field} at index ${index}: expected an ISO timestamp.`,
    );
  }
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return invalid(
      `Invalid ${field} at index ${index}: expected an ISO timestamp.`,
    );
  }
  return parsed;
}

export function parseRecoveryObservationReadiness(
  value: unknown,
): RecoveryObservationReadiness {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 10
  ) {
    return invalid('Readiness must be an integer from 0 through 10.');
  }
  return value as RecoveryObservationReadiness;
}

function parseUnitId(value: unknown, index?: number): MuscleRecoveryUnitId {
  if (!isMuscleRecoveryUnitId(value)) {
    const location = index === undefined ? '' : ` at index ${index}`;
    return invalid(`Unknown recovery unit "${String(value)}"${location}.`);
  }
  return value;
}

export function parseRecoveryPresentationGroupId(
  value: unknown,
  index?: number,
): RecoveryPresentationGroupId {
  if (!isRecoveryPresentationGroupId(value)) {
    const location = index === undefined ? '' : ` at index ${index}`;
    return invalid(
      `Unknown recovery presentation group "${String(value)}"${location}.`,
    );
  }
  return value;
}

function parseSource(
  value: unknown,
  index?: number,
): RecoveryObservationSource {
  if (
    value !== 'manual' &&
    value !== 'pre_workout' &&
    value !== 'unified_check_in'
  ) {
    const location = index === undefined ? '' : ` at index ${index}`;
    return invalid(`Invalid source${location}.`);
  }
  return value;
}

function parseTimezoneOffset(value: unknown, index?: number): number {
  if (
    typeof value !== 'number' ||
    !Number.isInteger(value) ||
    value < -840 ||
    value > 840
  ) {
    const location = index === undefined ? '' : ` at index ${index}`;
    return invalid(`Invalid timezoneOffsetMinutes${location}.`);
  }
  return value;
}

function parseOptionalBoolean(
  value: unknown,
  field: string,
  index: number,
): boolean | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== 'boolean') {
    return invalid(
      `Invalid ${field} at index ${index}: expected a boolean.`,
    );
  }
  return value;
}

function parseLinkedLoadRecordIds(
  value: unknown,
  index?: number,
): string[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    const location = index === undefined ? '' : ` at index ${index}`;
    return invalid(
      `Invalid linkedLoadRecordIds${location}: expected an array.`,
    );
  }
  const ids = value.map((id) =>
    parseNonEmptyString(id, 'linkedLoadRecordIds entry', index),
  );
  if (new Set(ids).size !== ids.length) {
    const location = index === undefined ? '' : ` at index ${index}`;
    return invalid(
      `Invalid linkedLoadRecordIds${location}: duplicate IDs are not allowed.`,
    );
  }
  return ids;
}

function parseCommonFields(
  value: Record<string, unknown>,
  index: number,
): RecoveryObservationBase {
  const recordedAt = parseTimestamp(value.recordedAt, 'recordedAt', index);
  const createdAt = parseTimestamp(value.createdAt, 'createdAt', index);
  const updatedAt = parseTimestamp(value.updatedAt, 'updatedAt', index);
  if (updatedAt < createdAt || recordedAt > updatedAt) {
    return invalid(`Invalid timestamps at index ${index}.`);
  }
  if (value.scaleVersion !== RECOVERY_OBSERVATION_SCALE_VERSION) {
    return invalid(`Unsupported observation scale version at index ${index}.`);
  }

  const linkedPlannedSessionId = parseOptionalString(
    value.linkedPlannedSessionId,
    'linkedPlannedSessionId',
    index,
  );
  const painPresent = parseOptionalBoolean(
    value.painPresent,
    'painPresent',
    index,
  );
  const illnessPresent = parseOptionalBoolean(
    value.illnessPresent,
    'illnessPresent',
    index,
  );
  const supersedesId = parseOptionalString(
    value.supersedesId,
    'supersedesId',
    index,
  );

  return {
    id: parseNonEmptyString(value.id, 'id', index),
    readiness: parseRecoveryObservationReadiness(value.readiness),
    scaleVersion: RECOVERY_OBSERVATION_SCALE_VERSION,
    recordedAt,
    timezoneOffsetMinutes: parseTimezoneOffset(
      value.timezoneOffsetMinutes,
      index,
    ),
    source: parseSource(value.source, index),
    ...(linkedPlannedSessionId ? { linkedPlannedSessionId } : {}),
    linkedLoadRecordIds: parseLinkedLoadRecordIds(
      value.linkedLoadRecordIds,
      index,
    ),
    ...(painPresent === undefined ? {} : { painPresent }),
    ...(illnessPresent === undefined ? {} : { illnessPresent }),
    modelVersion: parseNonEmptyString(value.modelVersion, 'modelVersion', index),
    registryVersion: parseNonEmptyString(
      value.registryVersion,
      'registryVersion',
      index,
    ),
    ...(supersedesId ? { supersedesId } : {}),
    createdAt,
    updatedAt,
  };
}

function parseV2Observation(
  value: unknown,
  index: number,
): RecoveryObservation {
  if (!isRecord(value) || !isRecord(value.target)) {
    return invalid(`Invalid observation target at index ${index}.`);
  }
  const common = parseCommonFields(value, index);
  if (value.target.kind === 'presentation_group') {
    return {
      ...common,
      target: {
        kind: 'presentation_group',
        presentationGroupId: parseRecoveryPresentationGroupId(
          value.target.presentationGroupId,
          index,
        ),
      },
    };
  }
  if (value.target.kind === 'legacy_unit') {
    const targetUnitId = parseUnitId(value.target.unitId, index);
    const unitId = parseUnitId(value.unitId, index);
    if (targetUnitId !== unitId) {
      return invalid(`Legacy unit target mismatch at index ${index}.`);
    }
    const rawObservedBurden = value.observedBurden;
    let observedBurden: number | undefined;
    if (rawObservedBurden !== undefined) {
      if (
        typeof rawObservedBurden !== 'number' ||
        !Number.isFinite(rawObservedBurden)
      ) {
        return invalid(`Invalid observedBurden at index ${index}.`);
      }
      observedBurden = rawObservedBurden;
    }
    return {
      ...common,
      target: { kind: 'legacy_unit', unitId },
      unitId,
      ...(observedBurden === undefined ? {} : { observedBurden }),
    };
  }
  return invalid(`Unknown observation target kind at index ${index}.`);
}

function parseLegacyV1Observation(
  value: unknown,
  index: number,
): LegacyUnitRecoveryObservation {
  if (!isRecord(value)) {
    return invalid(`Invalid legacy unit observation at index ${index}.`);
  }

  const readiness = parseRecoveryObservationReadiness(value.readiness);
  const unitId = parseUnitId(value.unitId, index);
  const isPrototypeRecord =
    typeof value.createdAt === 'string' || typeof value.asOf === 'string';
  const normalized = isPrototypeRecord
    ? {
        ...value,
        scaleVersion: RECOVERY_OBSERVATION_SCALE_VERSION,
        recordedAt: parseIsoTimestamp(value.createdAt, 'createdAt', index),
        timezoneOffsetMinutes: 0,
        linkedLoadRecordIds: [],
        createdAt: parseIsoTimestamp(value.createdAt, 'createdAt', index),
        updatedAt: parseIsoTimestamp(value.createdAt, 'createdAt', index),
      }
    : value;
  if (isPrototypeRecord && value.asOf !== undefined) {
    parseIsoTimestamp(value.asOf, 'asOf', index);
  }
  const common = parseCommonFields(normalized, index);
  const observedBurden = value.observedBurden;
  if (observedBurden !== undefined) {
    const expected = (10 - readiness) * 10;
    if (observedBurden !== expected) {
      return invalid(`Invalid legacy observedBurden at index ${index}.`);
    }
  }
  return {
    ...common,
    target: { kind: 'legacy_unit', unitId },
    unitId,
    ...(observedBurden === undefined
      ? {}
      : { observedBurden: observedBurden as number }),
  };
}

function targetKey(observation: RecoveryObservation): string {
  return observation.target.kind === 'presentation_group'
    ? `group:${observation.target.presentationGroupId}`
    : `unit:${observation.target.unitId}`;
}

function validateCollection(
  values: readonly RecoveryObservation[],
): RecoveryObservation[] {
  const parsed = values.map((value, index) => parseV2Observation(value, index));
  const byId = new Map<string, RecoveryObservation>();
  for (const [index, observation] of parsed.entries()) {
    if (byId.has(observation.id)) {
      throw new RecoveryObservationRepositoryError(
        'duplicate_id',
        `Duplicate observation ID "${observation.id}" at index ${index}.`,
      );
    }
    byId.set(observation.id, observation);
  }

  const childCounts = new Map<string, number>();
  for (const observation of parsed) {
    if (!observation.supersedesId) continue;
    if (observation.supersedesId === observation.id) {
      throw new RecoveryObservationRepositoryError(
        'supersession_conflict',
        `Observation "${observation.id}" cannot supersede itself.`,
      );
    }
    const parent = byId.get(observation.supersedesId);
    if (
      !parent ||
      targetKey(parent) !== targetKey(observation) ||
      observation.recordedAt < parent.recordedAt
    ) {
      throw new RecoveryObservationRepositoryError(
        'supersession_conflict',
        `Invalid supersession for observation "${observation.id}".`,
      );
    }
    const childCount = (childCounts.get(parent.id) ?? 0) + 1;
    if (childCount > 1) {
      throw new RecoveryObservationRepositoryError(
        'supersession_conflict',
        `Observation "${parent.id}" has multiple replacements.`,
      );
    }
    childCounts.set(parent.id, childCount);
  }

  for (const observation of parsed) {
    const visited = new Set<string>();
    let current: RecoveryObservation | undefined = observation;
    while (current?.supersedesId) {
      if (visited.has(current.id)) {
        throw new RecoveryObservationRepositoryError(
          'supersession_conflict',
          `Supersession cycle detected at observation "${current.id}".`,
        );
      }
      visited.add(current.id);
      current = byId.get(current.supersedesId);
    }
  }

  return parsed.sort(
    (left, right) =>
      left.recordedAt - right.recordedAt || left.id.localeCompare(right.id),
  );
}

export function parseStoredRecoveryObservations(
  raw: string,
): RecoveryObservation[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new RecoveryObservationRepositoryError(
      'invalid_json',
      'Recovery observation storage contains invalid JSON.',
      error,
    );
  }

  if (Array.isArray(parsed)) {
    return validateCollection(parsed.map(parseLegacyV1Observation));
  }
  if (!isRecord(parsed)) {
    throw new RecoveryObservationRepositoryError(
      'invalid_payload',
      'Invalid recovery observation storage payload.',
    );
  }
  if (parsed.schemaVersion === CHECK_IN_STORAGE_SCHEMA_VERSION) {
    if (!Array.isArray(parsed.checkIns)) {
      throw new RecoveryObservationRepositoryError(
        'invalid_payload',
        'Invalid legacy unit observation collection.',
      );
    }
    parseTimestamp(parsed.updatedAt, 'storage updatedAt');
    return validateCollection(parsed.checkIns.map(parseLegacyV1Observation));
  }
  if (parsed.schemaVersion !== RECOVERY_OBSERVATION_STORAGE_SCHEMA_VERSION) {
    throw new RecoveryObservationRepositoryError(
      'unsupported_schema',
      'Unsupported recovery observation storage schema.',
    );
  }
  if (!Array.isArray(parsed.observations)) {
    throw new RecoveryObservationRepositoryError(
      'invalid_payload',
      'Invalid recovery observation collection.',
    );
  }
  parseTimestamp(parsed.updatedAt, 'storage updatedAt');
  return validateCollection(parsed.observations as RecoveryObservation[]);
}

export function isRecoveryGroupObservation(
  observation: RecoveryObservation,
): observation is RecoveryGroupObservation {
  return observation.target.kind === 'presentation_group';
}

/** UI-safe selector: migrated legacy unit records are deliberately excluded. */
export function selectRecoveryGroupObservations(
  observations: readonly RecoveryObservation[],
): RecoveryGroupObservation[] {
  return observations.filter(isRecoveryGroupObservation);
}

async function readStoredPayload(): Promise<StoredPayload | null> {
  try {
    const current = await AsyncStorage.getItem(
      RECOVERY_OBSERVATION_STORAGE_KEY,
    );
    if (current !== null) {
      return { key: RECOVERY_OBSERVATION_STORAGE_KEY, raw: current };
    }
    for (const key of LEGACY_OBSERVATION_STORAGE_KEYS) {
      const legacy = await AsyncStorage.getItem(key);
      if (legacy !== null) return { key, raw: legacy };
    }
    return null;
  } catch (error) {
    throw new RecoveryObservationRepositoryError(
      'storage_read_failed',
      'Failed to read recovery observations.',
      error,
    );
  }
}

async function writeObservationsRaw(
  observations: readonly RecoveryObservation[],
): Promise<void> {
  const envelope: RecoveryObservationStorageEnvelopeV2 = {
    schemaVersion: RECOVERY_OBSERVATION_STORAGE_SCHEMA_VERSION,
    updatedAt: Date.now(),
    observations: validateCollection(observations),
  };
  try {
    await AsyncStorage.setItem(
      RECOVERY_OBSERVATION_STORAGE_KEY,
      JSON.stringify(envelope),
    );
  } catch (error) {
    throw new RecoveryObservationRepositoryError(
      'storage_write_failed',
      'Failed to save recovery observations.',
      error,
    );
  }
}

async function loadObservationsRaw(
  migrateLegacy: boolean,
): Promise<RecoveryObservation[]> {
  const payload = await readStoredPayload();
  if (!payload) return [];
  const observations = parseStoredRecoveryObservations(payload.raw);
  if (migrateLegacy && payload.key !== RECOVERY_OBSERVATION_STORAGE_KEY) {
    await writeObservationsRaw(observations);
  }
  return observations;
}

export function loadRecoveryObservations(): Promise<RecoveryObservation[]> {
  return enqueueMutation(() => loadObservationsRaw(true));
}

export async function tryLoadRecoveryObservations(): Promise<
  RecoveryObservationRepositoryResult<RecoveryObservation[]>
> {
  try {
    return { ok: true, value: await loadRecoveryObservations() };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof RecoveryObservationRepositoryError
          ? error
          : new RecoveryObservationRepositoryError(
              'storage_read_failed',
              'Failed to load recovery observations.',
              error,
            ),
    };
  }
}

function createObservationId(recordedAt: number): string {
  const entropy = Math.random().toString(36).slice(2, 10);
  return `recovery-observation:${recordedAt.toString(36)}-${entropy}`;
}

export function createRecoveryGroupObservation(
  input: AddRecoveryGroupObservationInput,
  now: number = Date.now(),
): RecoveryGroupObservation {
  const recordedAt =
    input.recordedAt === undefined
      ? parseTimestamp(now, 'recordedAt')
      : parseTimestamp(input.recordedAt, 'recordedAt');
  const createdAt = parseTimestamp(now, 'createdAt');
  if (recordedAt > createdAt) {
    return invalid(
      'recordedAt cannot be later than the creation timestamp.',
    );
  }
  const linkedPlannedSessionId =
    input.linkedPlannedSessionId === undefined
      ? undefined
      : parseNonEmptyString(
          input.linkedPlannedSessionId,
          'linkedPlannedSessionId',
        );
  const painPresent = parseOptionalBoolean(
    input.painPresent,
    'painPresent',
    0,
  );
  const illnessPresent = parseOptionalBoolean(
    input.illnessPresent,
    'illnessPresent',
    0,
  );

  return {
    id:
      input.id === undefined
        ? createObservationId(recordedAt)
        : parseNonEmptyString(input.id, 'id'),
    target: {
      kind: 'presentation_group',
      presentationGroupId: parseRecoveryPresentationGroupId(
        input.presentationGroupId,
      ),
    },
    readiness: parseRecoveryObservationReadiness(input.readiness),
    scaleVersion: RECOVERY_OBSERVATION_SCALE_VERSION,
    recordedAt,
    timezoneOffsetMinutes:
      input.timezoneOffsetMinutes === undefined
        ? new Date(recordedAt).getTimezoneOffset()
        : parseTimezoneOffset(input.timezoneOffsetMinutes),
    source: parseSource(input.source),
    ...(linkedPlannedSessionId ? { linkedPlannedSessionId } : {}),
    linkedLoadRecordIds: parseLinkedLoadRecordIds(
      input.linkedLoadRecordIds,
    ),
    ...(painPresent === undefined ? {} : { painPresent }),
    ...(illnessPresent === undefined ? {} : { illnessPresent }),
    modelVersion: parseNonEmptyString(input.modelVersion, 'modelVersion'),
    registryVersion: parseNonEmptyString(
      input.registryVersion,
      'registryVersion',
    ),
    createdAt,
    updatedAt: createdAt,
  };
}

export function addRecoveryGroupObservation(
  input: AddRecoveryGroupObservationInput,
): Promise<RecoveryGroupObservation> {
  return enqueueMutation(async () => {
    const observations = await loadObservationsRaw(false);
    const observation = createRecoveryGroupObservation(input);
    if (observations.some((existing) => existing.id === observation.id)) {
      throw new RecoveryObservationRepositoryError(
        'duplicate_id',
        `A recovery observation with ID "${observation.id}" already exists.`,
      );
    }
    await writeObservationsRaw([...observations, observation]);
    return observation;
  });
}

export function supersedeRecoveryGroupObservation(
  supersedesId: string,
  input: SupersedeRecoveryGroupObservationInput,
): Promise<RecoveryGroupObservation> {
  return enqueueMutation(async () => {
    const observations = await loadObservationsRaw(false);
    const existing = observations.find(
      (observation) => observation.id === supersedesId,
    );
    if (!existing || !isRecoveryGroupObservation(existing)) {
      throw new RecoveryObservationRepositoryError(
        'not_found',
        `Recovery group observation "${supersedesId}" was not found.`,
      );
    }
    if (
      observations.some(
        (observation) => observation.supersedesId === supersedesId,
      )
    ) {
      throw new RecoveryObservationRepositoryError(
        'supersession_conflict',
        `Recovery observation "${supersedesId}" was already superseded.`,
      );
    }
    const replacement: RecoveryGroupObservation = {
      ...createRecoveryGroupObservation({
        ...input,
        presentationGroupId: existing.target.presentationGroupId,
      }),
      supersedesId: existing.id,
    };
    if (observations.some(({ id }) => id === replacement.id)) {
      throw new RecoveryObservationRepositoryError(
        'duplicate_id',
        `A recovery observation with ID "${replacement.id}" already exists.`,
      );
    }
    await writeObservationsRaw([...observations, replacement]);
    return replacement;
  });
}

export function deleteRecoveryObservation(id: string): Promise<boolean> {
  const observationId = parseNonEmptyString(id, 'id');
  return enqueueMutation(async () => {
    const observations = await loadObservationsRaw(false);
    const target = observations.find(({ id: candidate }) => candidate === observationId);
    if (!target) return false;
    if (
      observations.some(
        (observation) => observation.supersedesId === observationId,
      )
    ) {
      throw new RecoveryObservationRepositoryError(
        'supersession_conflict',
        `Cannot delete observation "${observationId}" while a replacement exists.`,
      );
    }
    const byId = new Map(observations.map((observation) => [observation.id, observation]));
    const chainIds = new Set<string>([observationId]);
    let current: RecoveryObservation | undefined = target;
    while (current.supersedesId) {
      chainIds.add(current.supersedesId);
      current = byId.get(current.supersedesId);
      if (!current) break;
    }
    await writeObservationsRaw(
      observations.filter((observation) => !chainIds.has(observation.id)),
    );
    return true;
  });
}
