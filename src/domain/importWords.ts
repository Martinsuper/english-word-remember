import { Word } from '../types';
import { normalizeWordId, sanitizeWordCandidate, sanitizeWordList } from './wordQuality';

function splitDelimitedLine(line: string) {
  if (line.includes('\t')) {
    return line.split('\t').map((item) => item.trim());
  }
  if (line.includes('|')) {
    return line.split('|').map((item) => item.trim());
  }
  return splitCsvLine(line);
}

function splitCsvLine(line: string) {
  const parts: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (char === ',' && !inQuotes) {
      parts.push(current.trim());
      current = '';
      continue;
    }

    current += char;
  }

  parts.push(current.trim());
  return parts;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, '');
}

function columnIndex(headers: string[], patterns: RegExp[], fallback: number) {
  const index = headers.findIndex((header) =>
    patterns.some((pattern) => pattern.test(normalizeHeader(header))),
  );
  return index >= 0 ? index : fallback;
}

function looksLikeHeader(parts: string[]) {
  return parts.some((part) =>
    /^(单词|word|term|vocab|英音|美音|释义|meaning|definition|translation|例句|sentence|example)$/i.test(
      normalizeHeader(part),
    ),
  );
}

function parseDelimitedLine(line: string): Word | null {
  const parts = splitDelimitedLine(line);
  if (parts.length < 2) {
    return null;
  }

  return (
    sanitizeWordCandidate({
      id: parts[0],
      term: parts[0],
      phonetic: parts[1] ?? '',
      meaning: parts[2] ?? '',
      example: parts[3] ?? '',
      exampleMeaning: parts[4] ?? '',
    }) ?? null
  );
}

function parseTableRows(lines: string[]): Word[] {
  const rows = lines.map(splitDelimitedLine);
  if (rows.length === 0) {
    return [];
  }

  const hasHeader = looksLikeHeader(rows[0]);
  const headers = hasHeader ? rows[0] : [];
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const termIndex = hasHeader ? columnIndex(headers, [/^单词$/, /^word$/, /^term$/, /^vocab/], 0) : 0;
  const ukIndex = hasHeader ? columnIndex(headers, [/英音/, /uk/, /british/], -1) : 1;
  const usIndex = hasHeader ? columnIndex(headers, [/美音/, /us/, /american/, /phonetic/], -1) : 2;
  const phoneticIndex = hasHeader ? columnIndex(headers, [/^音标$/, /^phonetic$/, /^ipa$/], -1) : 1;
  const meaningIndex = hasHeader
    ? columnIndex(headers, [/释义/, /中文/, /meaning/, /definition/, /translation/], 3)
    : 2;
  const exampleIndex = hasHeader ? columnIndex(headers, [/例句/, /example/, /sentence/], -1) : 3;
  const exampleMeaningIndex = hasHeader
    ? columnIndex(headers, [/例句翻译/, /例句释义/, /examplemeaning/, /exampletranslation/], -1)
    : 4;

  const candidates = dataRows.map((row, index) => {
    const term = row[termIndex] ?? '';
    const uk = ukIndex >= 0 ? row[ukIndex] ?? '' : '';
    const us = usIndex >= 0 ? row[usIndex] ?? '' : '';
    const phonetic = phoneticIndex >= 0 ? row[phoneticIndex] ?? '' : uk || us;
    const meaning = row[meaningIndex] ?? '';
    const example = exampleIndex >= 0 ? row[exampleIndex] ?? '' : '';
    const exampleMeaning = exampleMeaningIndex >= 0 ? row[exampleMeaningIndex] ?? '' : '';

    return {
      id: `excel-${String(index + 1).padStart(4, '0')}-${normalizeWordId(term)}`,
      term,
      phonetic,
      meaning,
      example,
      exampleMeaning,
      sourceBook: 'Excel 链接词库',
      sourcePage: index + 1,
      rawText: uk && us && uk !== us ? `英音 ${uk} | 美音 ${us}` : '',
    };
  });

  return sanitizeWordList(candidates);
}

function extractJsonItems(parsed: unknown): unknown[] {
  if (Array.isArray(parsed)) {
    return parsed;
  }

  if (!parsed || typeof parsed !== 'object') {
    return [];
  }

  const source = parsed as Record<string, unknown>;
  const items = source.words ?? source.deck ?? source.items;
  return Array.isArray(items) ? items : [];
}

export function parseImportedWords(raw: string): Word[] {
  const trimmed = raw.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    try {
      const parsed = JSON.parse(trimmed) as unknown;
      return sanitizeWordList(extractJsonItems(parsed));
    } catch {
      // Fall through to line-based parsing.
    }
  }

  const lines = trimmed
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.some((line) => line.includes('\t')) || looksLikeHeader(splitDelimitedLine(lines[0] ?? ''))) {
    return parseTableRows(lines);
  }

  return lines
    .map((line, index) => {
      if (index === 0 && /^term[,|\t]/i.test(line)) {
        return null;
      }

      if (line.startsWith('{')) {
        try {
          return sanitizeWordCandidate(JSON.parse(line));
        } catch {
          return null;
        }
      }

      return parseDelimitedLine(line);
    })
    .filter((word): word is Word => Boolean(word));
}
