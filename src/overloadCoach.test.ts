import { suggestNextTarget, CoachSession } from './overloadCoach';
import * as assert from 'assert';

function runTests() {
  console.log('Running Edge case 1: targetReps = 5 sets range [3, 5]');
  const history1: CoachSession[] = [
    {
      dateKey: '2026-07-11',
      sets: [{ weightKg: 100, reps: 5 }]
    }
  ];
  const result1 = suggestNextTarget(history1, { targetReps: 5, incrementKg: 2.5 });
  assert.strictEqual(result1.suggestion?.weightKg, 102.5);
  assert.strictEqual(result1.suggestion?.targetReps, 3);
  assert.ok(result1.reasoning.includes('3 reps'));

  console.log('Running Edge case 2: targetReps = 12 sets range [8, 12]');
  const history2: CoachSession[] = [
    {
      dateKey: '2026-07-11',
      sets: [{ weightKg: 100, reps: 12 }]
    }
  ];
  const result2 = suggestNextTarget(history2, { targetReps: 12, incrementKg: 2.5 });
  assert.strictEqual(result2.suggestion?.weightKg, 102.5);
  assert.strictEqual(result2.suggestion?.targetReps, 8);

  console.log('Running Edge case 3: fallback to primaryGoal');
  const historyStrength: CoachSession[] = [
    {
      dateKey: '2026-07-11',
      sets: [{ weightKg: 100, reps: 6 }]
    }
  ];
  const resultStrength = suggestNextTarget(historyStrength, { primaryGoal: 'strength', incrementKg: 2.5 });
  assert.strictEqual(resultStrength.suggestion?.targetReps, 4);

  const historyHypertrophy: CoachSession[] = [
    {
      dateKey: '2026-07-11',
      sets: [{ weightKg: 100, reps: 12 }]
    }
  ];
  const resultHypertrophy = suggestNextTarget(historyHypertrophy, { primaryGoal: 'hypertrophy', incrementKg: 2.5 });
  assert.strictEqual(resultHypertrophy.suggestion?.targetReps, 8);

  console.log('Running Edge case 4: rpeEnabled = false counts failure even if RPE is not 9+');
  const history4: CoachSession[] = [
    {
      dateKey: '2026-07-11',
      sets: [{ weightKg: 100, reps: 7, rpe: 8 }]
    },
    {
      dateKey: '2026-07-04',
      sets: [{ weightKg: 100, reps: 7, rpe: 8 }]
    }
  ];
  const resultWithRPE = suggestNextTarget(history4, { rpeEnabled: true });
  assert.strictEqual(resultWithRPE.suggestion?.weightKg, 100); 

  const resultWithoutRPE = suggestNextTarget(history4, { rpeEnabled: false });
  assert.strictEqual(resultWithoutRPE.suggestion?.weightKg, 95);

  console.log('Running Cardio Case 1: First-time cardio session without history');
  const resultCardioTimeNoHistory = suggestNextTarget([], { isCardio: true, trackingType: 'time' });
  assert.strictEqual(resultCardioTimeNoHistory.suggestion, undefined);
  assert.strictEqual(resultCardioTimeNoHistory.cardioTarget?.targetMinutes, 20);
  assert.ok(resultCardioTimeNoHistory.reasoning.includes('baseline duration'));

  const resultCardioDistNoHistory = suggestNextTarget([], { isCardio: true, trackingType: 'time_distance' });
  assert.strictEqual(resultCardioDistNoHistory.suggestion, undefined);
  assert.strictEqual(resultCardioDistNoHistory.cardioTarget?.targetDistance, 5);
  assert.strictEqual(resultCardioDistNoHistory.cardioTarget?.targetMinutes, 30);
  assert.strictEqual(resultCardioDistNoHistory.cardioTarget?.paceMinutesPerUnit, 6);
  assert.ok(resultCardioDistNoHistory.reasoning.includes('baseline distance'));

  console.log('Running Cardio Case 2: Cardio time-only progression (Stairmaster)');
  const historyStairmaster: CoachSession[] = [
    {
      dateKey: '2026-07-11',
      sets: [{ weightKg: 0, reps: 20 }]
    }
  ];
  const resultStairmaster = suggestNextTarget(historyStairmaster, { isCardio: true, trackingType: 'time' });
  assert.strictEqual(resultStairmaster.suggestion, undefined);
  assert.strictEqual(resultStairmaster.cardioTarget?.targetMinutes, 22);
  assert.strictEqual(resultStairmaster.cardioTarget?.targetDistance, undefined);
  assert.strictEqual(resultStairmaster.reasoning, 'Last session: 20.0 min. Aim for 22.0 min at a sustained pace.');

  console.log('Running Cardio Case 3: Cardio time-distance progression (Treadmill)');
  const historyTreadmill: CoachSession[] = [
    {
      dateKey: '2026-07-11',
      sets: [{ weightKg: 5, reps: 30 }]
    }
  ];
  const resultTreadmill = suggestNextTarget(historyTreadmill, { isCardio: true, trackingType: 'time_distance' });
  assert.strictEqual(resultTreadmill.suggestion, undefined);
  assert.strictEqual(resultTreadmill.cardioTarget?.targetDistance, 5.3);
  assert.strictEqual(resultTreadmill.cardioTarget?.targetMinutes, 31.8);
  assert.strictEqual(resultTreadmill.cardioTarget?.paceMinutesPerUnit, 6);
  assert.ok(resultTreadmill.reasoning.includes('5.0km in 30.0 min'));
  assert.ok(resultTreadmill.reasoning.includes('5.3km in 31.8 min'));

  console.log('Running Cardio Case 4: Cardio with explicit distance and timeMinutes');
  const historyExplicit: CoachSession[] = [
    {
      dateKey: '2026-07-11',
      sets: [{ weightKg: 0, reps: 0, distance: 10, timeMinutes: 60 }]
    }
  ];
  const resultExplicit = suggestNextTarget(historyExplicit, { trackingType: 'time_distance' });
  assert.strictEqual(resultExplicit.suggestion, undefined);
  assert.strictEqual(resultExplicit.cardioTarget?.targetDistance, 10.5);
  assert.strictEqual(resultExplicit.cardioTarget?.targetMinutes, 63);
  assert.strictEqual(resultExplicit.cardioTarget?.paceMinutesPerUnit, 6);

  console.log('All tests passed successfully!');
}

runTests();
