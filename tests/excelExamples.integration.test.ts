import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import test from 'node:test';
import { parseXlsxWords } from '../src/domain/importExcelLink';
import { filterWords } from '../src/domain/text';

const workbookPath = process.env.EXAMPLE_WORKBOOK_PATH;

test('真实例句 Excel 可完整导入并保留多义项关系', { skip: !workbookPath }, async () => {
  const file = await fs.readFile(workbookPath!);
  const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
  const words = await parseXlsxWords(buffer, '自动化测试词库');
  const examples = words.flatMap((word) => word.examples ?? []);

  assert.equal(words.length, 1536);
  assert.equal(examples.length, 2115);
  assert.ok(words.every((word) => word.term && word.meaning));
  assert.ok(examples.every((example) => example.sense && example.sentence && example.translation));

  const vision = words.find((word) => word.term === 'vision');
  assert.ok(vision);
  assert.equal(vision.examples?.length, 2);
  assert.deepEqual(vision.examples?.map((example) => example.sense), ['n. 视力', 'n. 想象力']);
  assert.equal(vision.example, vision.examples?.[0].sentence);
  assert.equal(vision.exampleMeaning, vision.examples?.[0].translation);

  assert.ok(filterWords(words, '想象力').some((word) => word.term === 'vision'));
  assert.ok(filterWords(words, 'Regular eye examinations').some((word) => word.term === 'vision'));
});
