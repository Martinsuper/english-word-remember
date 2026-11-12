import test from 'node:test';
import assert from 'node:assert/strict';
import { lookupLocalWord } from '../src/reading/domain/localDictionary';
import { Word, WordPack } from '../src/types';

function makeWord(id: string, term: string): Word {
  return {
    id,
    term,
    phonetic: '',
    meaning: `${term} 的释义`,
    example: '',
    exampleMeaning: '',
  };
}

function makePack(id: string, terms: string[]): WordPack {
  return {
    id,
    title: id,
    description: '',
    words: terms.map((term, index) => makeWord(`${id}-${index}`, term)),
  };
}

test('基础词命中并返回查询词形', () => {
  const packs = [makePack('p1', ['economy'])];
  const match = lookupLocalWord(packs, 'economy');
  assert.ok(match);
  assert.equal(match.word.term, 'economy');
  assert.equal(match.queriedTerm, 'economy');
});

test('词形还原可命中原形词', () => {
  const packs = [makePack('p1', ['study'])];
  const match = lookupLocalWord(packs, 'studies');
  assert.ok(match);
  assert.equal(match.word.term, 'study');
  assert.equal(match.queriedTerm, 'study');
});

test('多个词包重复词时后包胜出（与单 Map 语义一致）', () => {
  const builtIn = makePack('builtin', ['bank']);
  const custom = makePack('custom', ['bank']);
  const match = lookupLocalWord([builtIn, custom], 'bank');
  assert.ok(match);
  assert.equal(match.word.id, 'custom-0');
});

test('索引缓存后仍能命中新增词包与词形', () => {
  const builtIn = makePack('builtin', ['run']);
  assert.ok(lookupLocalWord([builtIn], 'run'));
  // builtIn 的索引已被缓存；新增 custom 包走各自缓存路径
  const custom = makePack('custom', ['running']);
  const match = lookupLocalWord([builtIn, custom], 'runs');
  assert.ok(match);
  assert.equal(match.word.term, 'run');
  // 缓存命中后再次查询，词形还原依旧生效
  assert.ok(lookupLocalWord([builtIn, custom], 'running'));
});

test('未命中返回 null', () => {
  const packs = [makePack('p1', ['economy'])];
  assert.equal(lookupLocalWord(packs, 'zzzqqq'), null);
});
