import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const sources = [
  { file: 'CET4_T.json', tag: '四级词汇' },
  { file: 'CET6_T.json', tag: '六级词汇' },
  { file: 'KaoYan_3_T.json', tag: '考研词汇' },
];
const baseUrl = 'https://raw.githubusercontent.com/RealKai42/qwerty-learner/master/public/dicts';
const outputPath = resolve('src/reading/infrastructure/dictionary/examDictionary.json');
const entries = new Map();

for (const source of sources) {
  const response = await fetch(`${baseUrl}/${source.file}`);
  if (!response.ok) throw new Error(`下载 ${source.file} 失败：${response.status}`);
  const words = await response.json();
  for (const word of words) {
    const term = String(word.name ?? '').trim().toLowerCase();
    if (!/^[a-z][a-z' -]*$/.test(term)) continue;
    const existing = entries.get(term) ?? {
      term,
      phonetic: '',
      meaning: '',
      tags: [],
    };
    existing.phonetic ||= String(word.usphone ?? word.ukphone ?? '').trim();
    existing.meaning ||= Array.isArray(word.trans)
      ? word.trans.map((item) => String(item).trim()).filter(Boolean).join('；')
      : '';
    if (!existing.tags.includes(source.tag)) existing.tags.push(source.tag);
    entries.set(term, existing);
  }
}

const dictionary = [...entries.values()].sort((a, b) => a.term.localeCompare(b.term));
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(dictionary)}\n`);
console.log(`生成 ${dictionary.length} 条英汉词条：${outputPath}`);
