export function normalizeWord(raw: string): string {
  return raw
    .normalize('NFC')
    .replace(/[’`]/g, "'")
    .replace(/^[\s.,;:!?"“”()[\]{}<>]+/, '')
    .replace(/[\s.,;:!?"“”()[\]{}<>]+$/, '')
    .toLowerCase()
    .trim();
}

export function isValidWordSelection(text: string): boolean {
  if (!text || text.length === 0 || text.length > 80) return false;
  if (!/[a-zA-Z]/.test(text)) return false;
  if (/[^a-zA-Z'’\-\s]/.test(text)) return false;
  const words = text.split(/\s+/);
  if (words.length > 3) return false;
  return true;
}

export function extractSentence(
  fullText: string,
  wordStart: number,
  wordEnd: number,
): string {
  const maxLen = 500;
  const sentenceEndings = /[.!?。！？]+/g;

  let start = 0;
  let lastEnd = 0;
  sentenceEndings.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = sentenceEndings.exec(fullText)) !== null) {
    const end = match.index + match[0].length;
    if (end <= wordStart) {
      lastEnd = end;
    } else {
      break;
    }
  }

  start = lastEnd;

  sentenceEndings.lastIndex = wordEnd;
  match = sentenceEndings.exec(fullText);
  const end = match ? match.index + match[0].length : fullText.length;

  let sentence = fullText.substring(start, end).trim();
  if (sentence.length > maxLen) {
    sentence = sentence.substring(0, maxLen) + '...';
  }

  return sentence;
}
