import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasLearningProgress,
  deckProgressFromDeck,
  mergeProgressIntoDeck,
} from '../src/domain/deckProgress';
import { DeckEntry, Word } from '../src/types';

function makeEntry(id: string, state: Partial<DeckEntry['state']>): DeckEntry {
  const word: Word = {
    id,
    term: id,
    phonetic: '',
    meaning: '',
    example: '',
    exampleMeaning: '',
  };
  return {
    ...word,
    state: {
      learningStep: 0,
      easeFactor: 2.5,
      intervalDays: 0,
      repetition: 0,
      correctCount: 0,
      wrongCount: 0,
      ...state,
    },
  };
}

test('无进度条目判定为未学习', () => {
  assert.equal(hasLearningProgress(makeEntry('w1', {})), false);
});

test('任一进度字段存在即判定为已学习', () => {
  assert.equal(hasLearningProgress(makeEntry('w1', { repetition: 1 })), true);
  assert.equal(hasLearningProgress(makeEntry('w1', { correctCount: 2 })), true);
  assert.equal(hasLearningProgress(makeEntry('w1', { wrongCount: 1 })), true);
  assert.equal(hasLearningProgress(makeEntry('w1', { lastReviewedAt: '2026-01-01T00:00:00.000Z' })), true);
});

test('deckProgressFromDeck 只导出有进度的条目', () => {
  const deck = [
    makeEntry('fresh', {}),
    makeEntry('learned', { repetition: 2, correctCount: 2 }),
    makeEntry('wrong', { wrongCount: 1 }),
  ];
  const progress = deckProgressFromDeck(deck);
  assert.deepEqual(
    progress.map((entry) => entry.id),
    ['learned', 'wrong'],
  );
  assert.equal(progress[0].state.repetition, 2);
});

test('mergeProgressIntoDeck 空进度返回原数组引用', () => {
  const deck = [makeEntry('w1', {})];
  assert.equal(mergeProgressIntoDeck(deck, []), deck);
});

test('mergeProgressIntoDeck 按 id 合并进度且不改其他条目', () => {
  const deck = [makeEntry('w1', {}), makeEntry('w2', {})];
  const merged = mergeProgressIntoDeck(deck, [
    { id: 'w2', state: makeEntry('w2', { repetition: 3 }).state },
  ]);
  assert.equal(merged[0].state.repetition, 0);
  assert.equal(merged[1].state.repetition, 3);
  // 原 deck 不被修改
  assert.equal(deck[1].state.repetition, 0);
});
