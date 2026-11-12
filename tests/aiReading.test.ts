import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLocalRecallExercise,
  createLocalSentenceAnalysis,
} from '../src/reading/infrastructure/ai/aiReadingService';

test('offline sentence analysis separates common logical connectors', () => {
  const result = createLocalSentenceAnalysis(
    'Although rereading feels familiar, it does not necessarily create durable memory.',
  );

  assert.ok(result.chunks.length >= 2);
  assert.match(result.logic, /连接词/);
  assert.ok(result.checkQuestion.length > 0);
});

test('offline recall exercise asks for active recall and keeps a source checkpoint', () => {
  const result = createLocalRecallExercise(
    'Rereading creates familiarity. Active recall strengthens retrieval.',
  );

  assert.match(result.question, /概括/);
  assert.deepEqual(result.expectedPoints, ['Rereading creates familiarity.']);
  assert.ok(result.hint.length > 0);
});
