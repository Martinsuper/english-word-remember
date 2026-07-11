import { DailyTask, DeckEntry, StudyPlan, TaskWordType } from '../types';
import { isDue, localDateKey } from './review';

const DAY_MS = 24 * 60 * 60 * 1000;

export function getStudyDate(value = new Date(), boundaryHour = 4) {
  return new Date(value.getTime() - boundaryHour * 60 * 60 * 1000);
}

export function getStudyDateKey(value = new Date(), boundaryHour = 4) {
  return localDateKey(getStudyDate(value, boundaryHour));
}

export function createDefaultStudyPlan(packId: string, now = new Date()): StudyPlan {
  return {
    id: `plan-${packId}`,
    packId,
    mode: 'daily_words',
    startDate: getStudyDateKey(now),
    dailyNewWordTarget: 20,
    studyWeekdays: [0, 1, 2, 3, 4, 5, 6],
    batchSize: 10,
    catchUpStrategy: 'smooth',
    dailyCatchUpCapRatio: 0.3,
    dayBoundaryHour: 4,
    status: 'active',
  };
}

export function isIntroduced(entry: DeckEntry) {
  return Boolean(entry.state.introducedAt || entry.state.lastReviewedAt);
}

function taskAllocatedIds(tasks: Record<string, DailyTask>) {
  const ids = new Set<string>();
  Object.values(tasks).forEach((task) => {
    [...task.newWordIds, ...task.catchUpWordIds, ...task.advancedWordIds].forEach((id) => ids.add(id));
  });
  return ids;
}

function unfinishedNewIds(tasks: Record<string, DailyTask>, beforeDateKey: string) {
  const ids: string[] = [];
  const completedAnywhere = new Set(
    Object.values(tasks).flatMap((task) => task.completedWordIds),
  );
  Object.values(tasks)
    .filter((task) => task.dateKey < beforeDateKey)
    .sort((a, b) => a.dateKey.localeCompare(b.dateKey))
    .forEach((task) => {
      const completed = new Set(task.completedWordIds);
      [...task.newWordIds, ...task.catchUpWordIds].forEach((id) => {
        if (!completed.has(id) && !completedAnywhere.has(id) && !ids.includes(id)) ids.push(id);
      });
    });
  return ids;
}

export function createDailyTask(
  deck: DeckEntry[],
  plan: StudyPlan,
  existingTasks: Record<string, DailyTask>,
  now = new Date(),
): DailyTask {
  const dateKey = getStudyDateKey(now, plan.dayBoundaryHour);
  const studyDate = getStudyDate(now, plan.dayBoundaryHour);
  const isStudyDay = plan.studyWeekdays.includes(studyDate.getDay());
  const deckIds = new Set(deck.map((entry) => entry.id));
  const allocated = taskAllocatedIds(existingTasks);
  const overdueNew = unfinishedNewIds(existingTasks, dateKey).filter((id) => deckIds.has(id));
  const catchUpLimit =
    plan.catchUpStrategy === 'shift'
      ? 0
      : plan.catchUpStrategy === 'next_day'
        ? overdueNew.length
        : Math.ceil(plan.dailyNewWordTarget * plan.dailyCatchUpCapRatio);
  const catchUpWordIds = isStudyDay ? overdueNew.slice(0, catchUpLimit) : [];
  const shiftedWordIds = isStudyDay && plan.catchUpStrategy === 'shift'
    ? overdueNew.slice(0, plan.dailyNewWordTarget)
    : [];
  const advancedCredit = Object.values(existingTasks).reduce((total, task) => {
    if (task.advancedTargetDateKey !== dateKey) return total;
    return total + task.advancedWordIds.length;
  }, 0);
  const dueReviewIds = deck
    .filter((entry) => isIntroduced(entry) && isDue(entry, now))
    .sort((a, b) => {
      const wrongDelta = b.state.wrongCount - a.state.wrongCount;
      if (wrongDelta !== 0) return wrongDelta;
      return (a.state.nextReviewAt ?? '').localeCompare(b.state.nextReviewAt ?? '');
    })
    .map((entry) => entry.id);
  const freshWordIds = isStudyDay
    ? deck
        .filter((entry) => !isIntroduced(entry) && !allocated.has(entry.id) && !catchUpWordIds.includes(entry.id))
        .slice(0, Math.max(0, plan.dailyNewWordTarget - shiftedWordIds.length - advancedCredit))
        .map((entry) => entry.id)
    : [];
  const newWordIds = [...shiftedWordIds, ...freshWordIds];

  const hasRequiredWords = dueReviewIds.length + newWordIds.length + catchUpWordIds.length > 0;
  return {
    dateKey,
    planId: plan.id,
    dueReviewIds,
    newWordIds,
    catchUpWordIds,
    advancedWordIds: [],
    completedWordIds: [],
    skippedRelearningIds: [],
    status: hasRequiredWords ? 'not_started' : 'completed',
    completedAt: hasRequiredWords ? undefined : now.toISOString(),
  };
}

export function taskTypeForWord(task: DailyTask, wordId: string): TaskWordType | undefined {
  if (task.dueReviewIds.includes(wordId)) return 'review';
  if (task.newWordIds.includes(wordId)) return 'new';
  if (task.catchUpWordIds.includes(wordId)) return 'catch_up';
  if (task.advancedWordIds.includes(wordId)) return 'advanced';
  return undefined;
}

export function requiredTaskIds(task: DailyTask) {
  return [...task.dueReviewIds, ...task.newWordIds, ...task.catchUpWordIds];
}

export function remainingTaskIds(task: DailyTask, includeAdvanced = true) {
  const completed = new Set(task.completedWordIds);
  const required = requiredTaskIds(task).filter((id) => !completed.has(id));
  const advanced = includeAdvanced ? task.advancedWordIds.filter((id) => !completed.has(id)) : [];
  return [...required, ...advanced];
}

export function completeTaskWord(task: DailyTask, wordId: string, now = new Date()): DailyTask {
  if (task.completedWordIds.includes(wordId)) return task;
  const completedWordIds = [...task.completedWordIds, wordId];
  const required = requiredTaskIds(task);
  const completedRequired = required.every((id) => completedWordIds.includes(id));
  return {
    ...task,
    completedWordIds,
    status: completedRequired ? 'completed' : 'in_progress',
    completedAt: completedRequired ? task.completedAt ?? now.toISOString() : undefined,
  };
}

export function addAdvancedWords(
  task: DailyTask,
  deck: DeckEntry[],
  plan: StudyPlan,
  tasks: Record<string, DailyTask>,
  now = new Date(),
) {
  if (task.advancedWordIds.length > 0) return { task, count: 0 };
  const allocated = taskAllocatedIds(tasks);
  const ids = deck
    .filter((entry) => !isIntroduced(entry) && !allocated.has(entry.id))
    .slice(0, plan.dailyNewWordTarget)
    .map((entry) => entry.id);
  const cursor = getStudyDate(now, plan.dayBoundaryHour);
  do {
    cursor.setTime(cursor.getTime() + DAY_MS);
  } while (!plan.studyWeekdays.includes(cursor.getDay()));
  return {
    task: {
      ...task,
      advancedWordIds: ids,
      advancedTargetDateKey: localDateKey(cursor),
    },
    count: ids.length,
  };
}

export function estimatedCompletionDate(unintroduced: number, plan: StudyPlan, from = new Date()) {
  if (unintroduced <= 0) return getStudyDateKey(from, plan.dayBoundaryHour);
  let remaining = unintroduced;
  const cursor = new Date(from);
  for (let index = 0; index < 3660; index += 1) {
    if (plan.studyWeekdays.includes(cursor.getDay())) remaining -= plan.dailyNewWordTarget;
    if (remaining <= 0) return localDateKey(cursor);
    cursor.setTime(cursor.getTime() + DAY_MS);
  }
  return localDateKey(cursor);
}

export function addDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}
