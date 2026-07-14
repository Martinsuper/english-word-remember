import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeWord, isValidWordSelection, extractSentence } from '../src/reading/domain/wordSelection';
import { normalizePath, resolveResourcePath, validateZipEntryPath } from '../src/reading/infrastructure/epub/resolveResource';
import { sanitizeChapterHtml } from '../src/reading/infrastructure/epub/sanitizeChapter';
import { parseContainerXml, parsePackageDocument } from '../src/reading/infrastructure/epub/parsePackage';
import { buildChapterTitleMap, extractDocumentTitle } from '../src/reading/infrastructure/epub/parseNavigation';
import { wordFormCandidates } from '../src/reading/domain/localDictionary';
import { lookupExamDictionary } from '../src/reading/infrastructure/dictionary/examDictionary';

test('规范化阅读单词并保留内部撇号', () => {
  assert.equal(normalizeWord('“Don’t!”'), "don't");
  assert.equal(isValidWordSelection("state-of-the-art"), true);
  assert.equal(isValidWordSelection('123'), false);
});

test('从点击位置提取所在句子', () => {
  const text = 'First sentence. The market faces constraints today! Last one.';
  const start = text.indexOf('constraints');
  assert.equal(extractSentence(text, start, start + 11), 'The market faces constraints today!');
});

test('拒绝 ZIP 路径穿越并正确解析相对资源', () => {
  assert.equal(validateZipEntryPath('../secret.txt'), false);
  assert.equal(validateZipEntryPath('/absolute/file'), false);
  assert.equal(validateZipEntryPath('OPS/images/cover.jpg'), true);
  assert.equal(resolveResourcePath('OPS/text/', '../images/pic.jpg'), 'OPS/images/pic.jpg');
  assert.equal(normalizePath('OPS/text/../images/pic.jpg'), 'OPS/images/pic.jpg');
});

test('清理脚本、事件和外部图片', () => {
  const cleaned = sanitizeChapterHtml(
    '<p onclick="steal()">Safe</p><script>alert(1)</script><img src="https://evil.test/a.png"><a href="javascript:alert(1)">x</a>',
  );
  assert.equal(cleaned.includes('<script'), false);
  assert.equal(cleaned.includes('onclick'), false);
  assert.equal(cleaned.includes('https://evil.test'), false);
  assert.equal(cleaned.includes('javascript:'), false);
});

test('解析 EPUB container 和 package spine', () => {
  assert.equal(
    parseContainerXml('<container><rootfiles><rootfile full-path="OPS/content.opf"/></rootfiles></container>'),
    'OPS/content.opf',
  );
  const pkg = parsePackageDocument(`
    <package version="3.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <metadata><dc:title>Test Book</dc:title><dc:language>en</dc:language></metadata>
      <manifest><item id="c1" href="text/one.xhtml" media-type="application/xhtml+xml"/></manifest>
      <spine><itemref idref="c1"/></spine>
    </package>`);
  assert.equal(pkg.title, 'Test Book');
  assert.equal(pkg.spine[0]?.idref, 'c1');
  assert.equal(pkg.manifest.get('c1')?.href, 'text/one.xhtml');
});

test('规范化 EPUB 目录链接并从正文补充缺失标题', () => {
  const titles = buildChapterTitleMap([{ href: './article%20one.xhtml#top', title: 'Article One' }]);
  assert.equal(titles.get('article one.xhtml'), 'Article One');
  assert.equal(extractDocumentTitle('<html><head><title>Fallback</title></head><body><h1>Real <em>Title</em></h1></body></html>'), 'Real Title');
});

test('为常见屈折词生成原形候选', () => {
  assert.deepEqual(wordFormCandidates('studies').slice(0, 2), ['studies', 'study']);
  assert.equal(wordFormCandidates('running').includes('run'), true);
  assert.equal(wordFormCandidates('worked').includes('work'), true);
  assert.equal(wordFormCandidates('went').includes('go'), true);
  assert.equal(wordFormCandidates('children').includes('child'), true);
});

test('离线英汉词典合并考试标签并支持词形还原', () => {
  const direct = lookupExamDictionary('environment');
  assert.ok(direct?.meaning);
  assert.equal(direct?.tags.includes('四级词汇'), true);
  assert.equal(direct?.tags.includes('六级词汇'), true);
  const inflected = lookupExamDictionary('environments');
  assert.equal(inflected?.term, 'environment');
  assert.ok(inflected?.meaning);
});
