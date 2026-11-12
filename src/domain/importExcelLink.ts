import JSZip from 'jszip';
import { Word } from '../types';
import { parseImportedWords } from './importWords';
import { normalizeWordId, sanitizeWordList } from './wordQuality';

type CellValue = string | number | boolean | null;

function decodeXml(value: string) {
  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&#([0-9]+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'");
}

function stripTags(value: string) {
  return decodeXml(value.replace(/<[^>]+>/g, ''));
}

function columnIndex(cellRef: string) {
  const letters = cellRef.replace(/[0-9]/g, '').toUpperCase();
  let index = 0;
  for (const char of letters) {
    index = index * 26 + char.charCodeAt(0) - 64;
  }
  return index - 1;
}

function parseSharedStrings(xml: string) {
  const strings: string[] = [];
  const itemMatches = xml.match(/<si[\s\S]*?<\/si>/g) ?? [];

  for (const item of itemMatches) {
    const textParts = [...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1]));
    strings.push(textParts.join(''));
  }

  return strings;
}

function parseCellValue(cellXml: string, sharedStrings: string[]): CellValue {
  const type = cellXml.match(/\st="([^"]+)"/)?.[1];
  const inlineText = cellXml.match(/<is[\s\S]*?<\/is>/)?.[0];
  if (inlineText) {
    return stripTags(inlineText);
  }

  const value = cellXml.match(/<v>([\s\S]*?)<\/v>/)?.[1];
  if (value == null) {
    return null;
  }

  if (type === 's') {
    return sharedStrings[Number(value)] ?? '';
  }
  if (type === 'b') {
    return value === '1';
  }
  if (type === 'str') {
    return decodeXml(value);
  }

  return Number.isFinite(Number(value)) ? Number(value) : decodeXml(value);
}

function parseRows(sheetXml: string, sharedStrings: string[]) {
  const rows: CellValue[][] = [];
  const rowMatches = sheetXml.match(/<row[\s\S]*?<\/row>/g) ?? [];

  for (const rowXml of rowMatches) {
    const row: CellValue[] = [];
    const cellMatches = rowXml.match(/<c[\s\S]*?<\/c>/g) ?? [];

    for (const cellXml of cellMatches) {
      const ref = cellXml.match(/\sr="([^"]+)"/)?.[1] ?? '';
      row[columnIndex(ref)] = parseCellValue(cellXml, sharedStrings);
    }

    rows.push(row.map((cell) => cell ?? ''));
  }

  return rows;
}

function normalizeHeader(value: CellValue) {
  return String(value ?? '').trim().toLowerCase().replace(/\s+/g, '');
}

function indexFor(headers: CellValue[], patterns: RegExp[], fallback: number) {
  const index = headers.findIndex((header) => patterns.some((pattern) => pattern.test(normalizeHeader(header))));
  return index >= 0 ? index : fallback;
}

function cleanText(value: CellValue) {
  return String(value ?? '').trim().replace(/\r\n/g, '\n');
}

function wordsFromRows(rows: CellValue[][], sourceBook: string): Word[] {
  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0];
  const termIndex = indexFor(headers, [/^单词$/, /^word$/, /^term$/, /^vocab/], 0);
  const ukIndex = indexFor(headers, [/英音/, /uk/, /british/], -1);
  const usIndex = indexFor(headers, [/美音/, /us/, /american/, /phonetic/], -1);
  const phoneticIndex = indexFor(headers, [/^音标$/, /^phonetic$/, /^ipa$/], -1);
  const meaningIndex = indexFor(headers, [/释义/, /中文/, /meaning/, /definition/, /translation/], 3);
  const examplesJsonIndex = indexFor(headers, [/^例句json$/, /^examplesjson$/, /^examplejson$/, /^examples$/], -1);
  const exampleIndex = indexFor(headers, [/^例句$/, /^example$/, /^sentence$/], -1);
  const exampleMeaningIndex = indexFor(headers, [/例句翻译/, /例句释义/, /examplemeaning/, /exampletranslation/], -1);

  const candidates = rows.slice(1).map((row, index) => {
    const term = cleanText(row[termIndex]);
    const uk = ukIndex >= 0 ? cleanText(row[ukIndex]) : '';
    const us = usIndex >= 0 ? cleanText(row[usIndex]) : '';
    const phonetic = phoneticIndex >= 0 ? cleanText(row[phoneticIndex]) : uk || us;
    const meaning = cleanText(row[meaningIndex]);
    const example = exampleIndex >= 0 ? cleanText(row[exampleIndex]) : '';
    const exampleMeaning = exampleMeaningIndex >= 0 ? cleanText(row[exampleMeaningIndex]) : '';
    const examplesJson = examplesJsonIndex >= 0 ? cleanText(row[examplesJsonIndex]) : '';

    return {
      id: `excel-link-${String(index + 1).padStart(4, '0')}-${normalizeWordId(term)}`,
      term,
      phonetic,
      meaning,
      example,
      exampleMeaning,
      examplesJson,
      sourceBook,
      sourcePage: index + 1,
      rawText: uk && us && uk !== us ? `英音 ${uk} | 美音 ${us}` : '',
    };
  });

  return sanitizeWordList(candidates);
}

export async function parseXlsxWords(buffer: ArrayBuffer, sourceBook: string) {
  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    throw new Error('这个链接返回的不是可解析的 .xlsx 文件。请确认链接是公开、可直接下载的新版 Excel 文件。');
  }

  const sheetFile = zip.file(/^xl\/worksheets\/sheet\d+\.xml$/)[0];
  if (!sheetFile) {
    throw new Error('Excel 文件里没有找到工作表，请确认文件不是空文件。');
  }

  const sharedStringsFile = zip.file('xl/sharedStrings.xml');
  const sharedStrings = sharedStringsFile ? parseSharedStrings(await sharedStringsFile.async('string')) : [];
  const rows = parseRows(await sheetFile.async('string'), sharedStrings);
  return wordsFromRows(rows, sourceBook);
}

export async function importWordsFromExcelFile(uri: string, fileName: string, mimeType = '') {
  if (/\.xls$/i.test(fileName) && !/\.xlsx$/i.test(fileName)) {
    throw new Error('暂不支持旧版 .xls 文件，请在 Excel/WPS 中另存为 .xlsx 后再导入。');
  }

  let response: Response;
  try {
    response = await fetch(uri);
  } catch {
    throw new Error('无法读取所选文件，请重新选择后再试。');
  }
  if (!response.ok) {
    throw new Error('无法读取所选文件，请确认文件仍然存在且有访问权限。');
  }

  const sourceBook = fileName.replace(/\.(xlsx|xls|csv|tsv)$/i, '') || '本地 Excel 词库';
  let words: Word[];
  if (/\.xlsx$/i.test(fileName) || /spreadsheetml/i.test(mimeType)) {
    words = await parseXlsxWords(await response.arrayBuffer(), sourceBook);
  } else {
    words = parseImportedWords(await response.text()).map((word) => ({ ...word, sourceBook }));
  }
  assertParsedWords(words);
  return { title: sourceBook, words };
}

function normalizeExcelUrl(rawUrl: string) {
  const trimmed = rawUrl.trim();
  let url: URL;

  try {
    url = new URL(trimmed);
  } catch {
    throw new Error('链接格式不正确，请粘贴以 http:// 或 https:// 开头的 Excel 链接。');
  }

  if (!/^https?:$/.test(url.protocol)) {
    throw new Error('只支持 http:// 或 https:// 链接。');
  }

  const googleMatch = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([^/]+)/);
  if (googleMatch) {
    const gid = trimmed.match(/[?&#]gid=(\d+)/)?.[1] ?? '0';
    return `https://docs.google.com/spreadsheets/d/${googleMatch[1]}/export?format=tsv&gid=${gid}`;
  }

  if (/^github\.com$/i.test(url.hostname)) {
    const parts = url.pathname.split('/').filter(Boolean);
    const blobIndex = parts.indexOf('blob');
    if (parts.length > blobIndex + 2 && blobIndex === 2) {
      const [owner, repo] = parts;
      const branch = parts[blobIndex + 1];
      const filePath = parts.slice(blobIndex + 2).join('/');
      return `https://github.com/${owner}/${repo}/raw/refs/heads/${branch}/${filePath}`;
    }
  }

  if (/dropbox\.com$/i.test(url.hostname)) {
    url.searchParams.set('dl', '1');
    return url.toString();
  }

  if (/1drv\.ms$|onedrive\.live\.com$/i.test(url.hostname)) {
    url.searchParams.set('download', '1');
    return url.toString();
  }

  return trimmed;
}

function titleFromUrl(rawUrl: string) {
  try {
    const url = new URL(rawUrl);
    const lastPart = decodeURIComponent(url.pathname.split('/').filter(Boolean).at(-1) ?? '');
    return lastPart.replace(/\.(xlsx|xls|csv|tsv)$/i, '') || url.hostname;
  } catch {
    return 'Excel 链接词库';
  }
}

function looksLikeXlsx(url: string, contentType: string) {
  return /\.xlsx($|[?#])/i.test(url) || /spreadsheetml|application\/zip/.test(contentType);
}

function looksLikeLegacyXls(url: string, contentType: string) {
  return /\.xls($|[?#])/i.test(url) || /application\/vnd\.ms-excel/.test(contentType);
}

function looksLikeHtml(text: string, contentType: string) {
  return /text\/html/i.test(contentType) || /^\s*<!doctype html/i.test(text) || /^\s*<html[\s>]/i.test(text);
}

function assertParsedWords(words: Word[]) {
  if (words.length === 0) {
    throw new Error('没有从表格里解析出词条。请确认第一列是单词，并包含“释义 / meaning / translation”等释义列。');
  }
}

export async function importWordsFromExcelLink(rawUrl: string) {
  const url = normalizeExcelUrl(rawUrl);
  let response: Response;

  try {
    response = await fetch(url);
  } catch {
    throw new Error('无法访问这个链接。请确认手机网络正常，并且链接可以公开访问。');
  }

  if (!response.ok) {
    throw new Error(`链接请求失败，服务器返回 ${response.status}。请确认链接公开可访问。`);
  }

  const contentType = response.headers.get('content-type') ?? '';
  const sourceBook = titleFromUrl(rawUrl);

  if (looksLikeLegacyXls(url, contentType) && !looksLikeXlsx(url, contentType)) {
    throw new Error('暂不支持旧版 .xls 文件，请在 Excel/WPS 中另存为 .xlsx 后再导入。');
  }

  if (looksLikeXlsx(url, contentType)) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength === 0) {
      throw new Error('下载到的 Excel 文件为空，请确认链接可以直接下载文件。');
    }
    const words = await parseXlsxWords(buffer, sourceBook);
    assertParsedWords(words);
    return {
      title: sourceBook,
      words,
    };
  }

  const text = await response.text();
  if (looksLikeHtml(text, contentType)) {
    throw new Error('这个链接返回的是网页，不是 Excel 数据。请使用公开的直接下载链接，或公开 Google Sheets 链接。');
  }

  const words = parseImportedWords(text).map((word) => ({ ...word, sourceBook }));
  assertParsedWords(words);
  return {
    title: sourceBook,
    words,
  };
}
