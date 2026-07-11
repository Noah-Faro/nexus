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

  console.log('All tests passed successfully!');
}

runTests();
