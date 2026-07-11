import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addAdvancedWords,
  completeTaskWord,
  createDailyTask,
  createDefaultStudyPlan,
  getStudyDateKey,
} from '../src/domain/studyPlan';
import { createInitialDeck } from '../src/domain/review';
import { DailyTask, StudyPlan, Word } from '../src/types';

function words(count: number): Word[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `word-${index + 1}`,
    term: `word${index + 1}`,
    phonetic: '',
    meaning: `释义 ${index + 1}`,
    example: '',
    exampleMeaning: '',
  }));
}

function plan(now: Date, patch: Partial<StudyPlan> = {}) {
  return { ...createDefaultStudyPlan('pack', now), ...patch };
}

function complete(task: DailyTask) {
  return [...task.dueReviewIds, ...task.newWordIds, ...task.catchUpWordIds].reduce(
    (current, id) => completeTaskWord(current, id),
    task,
  );
}

test('默认计划每天分配 20 个新词，批次大小保持为 10', () => {
  const now = new Date('2026-07-13T10:00:00+08:00');
  const currentPlan = plan(now);
  const task = createDailyTask(createInitialDeck(words(50)), currentPlan, {}, now);

  assert.equal(currentPlan.batchSize, 10);
  assert.equal(task.newWordIds.length, 20);
  assert.equal(task.dueReviewIds.length, 0);
  assert.equal(task.status, 'not_started');
});

test('04:00 之前仍属于前一个学习日', () => {
  assert.equal(getStudyDateKey(new Date('2026-07-13T03:59:00+08:00'), 4), '2026-07-12');
  assert.equal(getStudyDateKey(new Date('2026-07-13T04:00:00+08:00'), 4), '2026-07-13');
});

test('休息日且没有到期复习时直接完成当天任务', () => {
  const sunday = new Date('2026-07-12T10:00:00+08:00');
  const currentPlan = plan(sunday, { studyWeekdays: [1, 2, 3, 4, 5, 6] });
  const task = createDailyTask(createInitialDeck(words(20)), currentPlan, {}, sunday);

  assert.equal(task.newWordIds.length, 0);
  assert.equal(task.status, 'completed');
  assert.ok(task.completedAt);
});

test('平滑补学最多增加每日目标的 30%', () => {
  const dayOne = new Date('2026-07-13T10:00:00+08:00');
  const dayTwo = new Date('2026-07-14T10:00:00+08:00');
  const currentPlan = plan(dayOne);
  const deck = createInitialDeck(words(60));
  const missed = createDailyTask(deck, currentPlan, {}, dayOne);
  const next = createDailyTask(deck, currentPlan, { [missed.dateKey]: missed }, dayTwo);

  assert.equal(next.catchUpWordIds.length, 6);
  assert.equal(next.newWordIds.length, 20);
});

test('提前学习 20 个后，下一学习日不再重复分配新词额度', () => {
  const dayOne = new Date('2026-07-13T10:00:00+08:00');
  const dayTwo = new Date('2026-07-14T10:00:00+08:00');
  const currentPlan = plan(dayOne);
  const deck = createInitialDeck(words(80));
  const original = createDailyTask(deck, currentPlan, {}, dayOne);
  const completed = complete(original);
  const advanced = addAdvancedWords(completed, deck, currentPlan, { [completed.dateKey]: completed }, dayOne);
  const tasks = { [completed.dateKey]: advanced.task };
  const next = createDailyTask(deck, currentPlan, tasks, dayTwo);

  assert.equal(advanced.count, 20);
  assert.equal(advanced.task.advancedTargetDateKey, '2026-07-14');
  assert.equal(next.newWordIds.length, 0);
});

test('同一天不能重复领取第二份提前学习额度', () => {
  const now = new Date('2026-07-13T10:00:00+08:00');
  const currentPlan = plan(now);
  const deck = createInitialDeck(words(80));
  const original = complete(createDailyTask(deck, currentPlan, {}, now));
  const first = addAdvancedWords(original, deck, currentPlan, { [original.dateKey]: original }, now);
  const second = addAdvancedWords(first.task, deck, currentPlan, { [original.dateKey]: first.task }, now);

  assert.equal(first.count, 20);
  assert.equal(second.count, 0);
  assert.deepEqual(second.task.advancedWordIds, first.task.advancedWordIds);
});
