import assert from 'node:assert/strict';
import test from 'node:test';
import { parseImportedWords } from '../src/domain/importWords';
import { getWordExamples, sanitizeWordExamples } from '../src/domain/wordExamples';
import { sanitizeWordCandidate } from '../src/domain/wordQuality';

test('解析 Excel 表格中的例句JSON并保留义项对应关系', () => {
  const examples = JSON.stringify([
    { sense: 'n. 行动', sentence: 'Immediate action is required to prevent further damage.', translation: '必须立即采取行动以防止进一步损害。' },
    { sense: 'n. 情节', sentence: 'The action of the novel develops at a steady pace.', translation: '这部小说的情节以稳定的节奏发展。' },
  ]);
  const words = parseImportedWords(`单词\t英音\t美音\t释义\t例句JSON\naction\t[ˈækʃn]\t[ˈækʃn]\tn. 行动；情节\t${examples}`);

  assert.equal(words.length, 1);
  assert.equal(words[0].examples?.length, 2);
  assert.equal(words[0].examples?.[1].sense, 'n. 情节');
  assert.equal(words[0].example, 'Immediate action is required to prevent further damage.');
  assert.equal(words[0].exampleMeaning, '必须立即采取行动以防止进一步损害。');
});

test('旧版单条例句自动转换为统一的例句数组', () => {
  const word = sanitizeWordCandidate({
    term: 'actual',
    meaning: 'adj. 实际的',
    example: 'The actual cost was higher than expected.',
    exampleMeaning: '实际成本高于预期。',
  });

  assert.ok(word);
  assert.deepEqual(getWordExamples(word), [{
    sense: '',
    sentence: 'The actual cost was higher than expected.',
    translation: '实际成本高于预期。',
  }]);
});

test('非法JSON和不完整例句被安全忽略', () => {
  assert.deepEqual(sanitizeWordExamples('{broken'), []);
  assert.deepEqual(sanitizeWordExamples([
    { sense: 'n. 行动', sentence: '', translation: '缺少英文。' },
    { sense: 'n. 行动', sentence: 'Action matters.', translation: '行动很重要。', ignored: true },
  ]), [{ sense: 'n. 行动', sentence: 'Action matters.', translation: '行动很重要。' }]);
});
