import { WordPack } from '../types';
import kaoyanYouShu5500 from './packs/kaoyanYouShu5500.json';

export const builtInPacks: WordPack[] = [
  {
    id: 'builtin-kaoyan-youshu-5500',
    title: '考研英语记词有树5500',
    description: '内置考研英语词库，来自开源 Excel 表格',
    words: kaoyanYouShu5500,
  },
];

export function getBundledWords() {
  return builtInPacks[0]?.words ?? [];
}

export function getInitialWords() {
  return getBundledWords();
}
