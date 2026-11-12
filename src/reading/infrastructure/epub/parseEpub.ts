import JSZip from 'jszip';
import {
  readAsStringAsync,
  writeAsStringAsync,
  EncodingType,
  makeDirectoryAsync,
  getInfoAsync,
} from 'expo-file-system/legacy';
import { parseContainerXml, parsePackageDocument } from './parsePackage';
import {
  parseNcxNavPoints,
  parseEpub3NavDocument,
  buildChapterTitleMap,
  normalizeTocHref,
  extractDocumentTitle,
  findNavDocumentHref,
  findNcxDocumentHref,
} from './parseNavigation';
import { sanitizeChapterHtml } from './sanitizeChapter';
import { resolveResourcePath, validateZipEntryPath } from './resolveResource';

export type EpubImportErrorCode =
  | 'FILE_UNREADABLE'
  | 'INVALID_ZIP'
  | 'INVALID_CONTAINER'
  | 'INVALID_PACKAGE'
  | 'NO_READABLE_SPINE'
  | 'ZIP_SAFETY_LIMIT';

export class EpubImportError extends Error {
  constructor(
    public code: EpubImportErrorCode,
    message?: string,
  ) {
    super(message || code);
    this.name = 'EpubImportError';
  }
}

export type ParsedEpub = {
  title: string;
  author?: string;
  publisher?: string;
  language?: string;
  description?: string;
  epubVersion: string;
  chapters: ParsedChapter[];
  coverPath?: string;
  resourcePaths: string[];
};

export type ParsedChapter = {
  spineIndex: number;
  title: string;
  href: string;
  archivePath: string;
  mediaType: string;
  sanitizedHtml: string;
  linear: boolean;
};

const MAX_FILE_COUNT = 10000;
const MAX_SINGLE_UNCOMPRESSED_SIZE = 100 * 1024 * 1024;
const MAX_TOTAL_UNCOMPRESSED_SIZE = 500 * 1024 * 1024;

export async function parseEpubFile(epubPath: string): Promise<ParsedEpub> {
  let base64: string;
  try {
    base64 = await readAsStringAsync(epubPath, { encoding: EncodingType.Base64 });
  } catch {
    throw new EpubImportError('FILE_UNREADABLE', `Cannot read file: ${epubPath}`);
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(base64, { base64: true });
  } catch {
    throw new EpubImportError('INVALID_ZIP', 'Failed to open as ZIP archive');
  }

  validateZipSafety(zip);

  const containerXml = await readZipEntry(zip, 'META-INF/container.xml');
  if (!containerXml) {
    throw new EpubImportError('INVALID_CONTAINER', 'Missing META-INF/container.xml');
  }

  const opfPath = parseContainerXml(containerXml);
  if (!opfPath) {
    throw new EpubImportError('INVALID_CONTAINER', 'Cannot find rootfile in container.xml');
  }

  if (!validateZipEntryPath(opfPath)) {
    throw new EpubImportError('INVALID_CONTAINER', 'OPF path traversal detected');
  }

  const opfXml = await readZipEntry(zip, opfPath);
  if (!opfXml) {
    throw new EpubImportError('INVALID_PACKAGE', `Cannot read OPF: ${opfPath}`);
  }

  const packageInfo = parsePackageDocument(opfXml);
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

  const tocEntries = await extractTocEntries(zip, opfDir, packageInfo);
  const titleMap = buildChapterTitleMap(tocEntries);

  const chapters: ParsedChapter[] = [];
  let spineIndex = 0;

  for (const spineItem of packageInfo.spine) {
    const manifestItem = packageInfo.manifest.get(spineItem.idref);
    if (!manifestItem) continue;

    const isHtml =
      manifestItem.mediaType === 'application/xhtml+xml' ||
      manifestItem.mediaType === 'text/html' ||
      manifestItem.mediaType === 'application/x-html';

    if (!isHtml) continue;

    const chapterPath = resolveResourcePath(opfDir, manifestItem.href);
    if (!validateZipEntryPath(chapterPath)) continue;

    const rawHtml = await readZipEntry(zip, chapterPath);
    if (!rawHtml) continue;

    const sanitized = sanitizeChapterHtml(rawHtml);
    const title =
      titleMap.get(normalizeTocHref(manifestItem.href)) ||
      extractDocumentTitle(rawHtml) ||
      `Chapter ${spineIndex + 1}`;

    chapters.push({
      spineIndex,
      title,
      href: manifestItem.href,
      archivePath: chapterPath,
      mediaType: manifestItem.mediaType,
      sanitizedHtml: sanitized,
      linear: spineItem.linear,
    });

    spineIndex++;
  }

  if (chapters.length === 0) {
    throw new EpubImportError('NO_READABLE_SPINE', 'No readable HTML chapters found in spine');
  }

  let coverPath: string | undefined;
  if (packageInfo.coverImageId) {
    const coverItem = packageInfo.manifest.get(packageInfo.coverImageId);
    if (coverItem) {
      const coverFullPath = resolveResourcePath(opfDir, coverItem.href);
      if (validateZipEntryPath(coverFullPath)) {
        const coverData = await readZipEntryBase64(zip, coverFullPath);
        if (coverData) {
          const ext = coverItem.href.split('.').pop() || 'jpg';
          coverPath = `cover.${ext}`;
        }
      }
    }
  }

  return {
    title: packageInfo.title || 'Unknown Title',
    author: packageInfo.creator,
    publisher: packageInfo.publisher,
    language: packageInfo.language,
    description: packageInfo.description,
    epubVersion: packageInfo.version,
    chapters,
    coverPath,
    resourcePaths: [...packageInfo.manifest.values()]
      .filter((item) => !item.mediaType.includes('html') && item.mediaType !== 'application/x-dtbncx+xml')
      .map((item) => resolveResourcePath(opfDir, item.href))
      .filter(validateZipEntryPath),
  };
}

export async function extractEpubResources(
  epubPath: string,
  outputDir: string,
  resourcePaths: string[],
): Promise<void> {
  const base64 = await readAsStringAsync(epubPath, { encoding: EncodingType.Base64 });
  const zip = await JSZip.loadAsync(base64, { base64: true });
  for (const resourcePath of resourcePaths) {
    if (!validateZipEntryPath(resourcePath)) continue;
    const entry = zip.file(resourcePath);
    if (!entry) continue;
    const parent = resourcePath.includes('/')
      ? `${outputDir}${resourcePath.slice(0, resourcePath.lastIndexOf('/') + 1)}`
      : outputDir;
    const info = await getInfoAsync(parent);
    if (!info.exists) await makeDirectoryAsync(parent, { intermediates: true });
    const data = await entry.async('base64');
    await writeAsStringAsync(`${outputDir}${resourcePath}`, data, { encoding: EncodingType.Base64 });
  }
}

export async function extractCoverImage(
  epubPath: string,
  outputPath: string,
): Promise<boolean> {
  const base64 = await readAsStringAsync(epubPath, { encoding: EncodingType.Base64 });
  const zip = await JSZip.loadAsync(base64, { base64: true });

  const containerXml = await readZipEntry(zip, 'META-INF/container.xml');
  if (!containerXml) return false;

  const opfPath = parseContainerXml(containerXml);
  if (!opfPath) return false;

  const opfXml = await readZipEntry(zip, opfPath);
  if (!opfXml) return false;

  const packageInfo = parsePackageDocument(opfXml);
  const opfDir = opfPath.substring(0, opfPath.lastIndexOf('/') + 1);

  if (!packageInfo.coverImageId) return false;

  const coverItem = packageInfo.manifest.get(packageInfo.coverImageId);
  if (!coverItem) return false;

  const coverFullPath = resolveResourcePath(opfDir, coverItem.href);
  const coverData = await readZipEntryBase64(zip, coverFullPath);
  if (!coverData) return false;

  await writeAsStringAsync(outputPath, coverData, { encoding: EncodingType.Base64 });
  return true;
}

async function extractTocEntries(
  zip: JSZip,
  opfDir: string,
  packageInfo: ReturnType<typeof parsePackageDocument>,
) {
  const navHref = findNavDocumentHref(packageInfo);
  if (navHref) {
    const navPath = resolveResourcePath(opfDir, navHref);
    const navXml = await readZipEntry(zip, navPath);
    if (navXml) {
      return parseEpub3NavDocument(navXml);
    }
  }

  const ncxHref = findNcxDocumentHref(packageInfo);
  if (ncxHref) {
    const ncxPath = resolveResourcePath(opfDir, ncxHref);
    const ncxXml = await readZipEntry(zip, ncxPath);
    if (ncxXml) {
      return parseNcxNavPoints(ncxXml);
    }
  }

  return [];
}

function validateZipSafety(zip: JSZip): void {
  let fileCount = 0;
  let totalSize = 0;

  zip.forEach((relativePath) => {
    fileCount++;
    if (fileCount > MAX_FILE_COUNT) {
      throw new EpubImportError('ZIP_SAFETY_LIMIT', `Too many files: ${fileCount}`);
    }

    if (!validateZipEntryPath(relativePath)) {
      throw new EpubImportError('ZIP_SAFETY_LIMIT', `Path traversal in: ${relativePath}`);
    }
    const entry = zip.file(relativePath) as (JSZip.JSZipObject & { _data?: { uncompressedSize?: number } }) | null;
    const size = entry?._data?.uncompressedSize ?? 0;
    if (size > MAX_SINGLE_UNCOMPRESSED_SIZE) {
      throw new EpubImportError('ZIP_SAFETY_LIMIT', `File is too large: ${relativePath}`);
    }
    totalSize += size;
    if (totalSize > MAX_TOTAL_UNCOMPRESSED_SIZE) {
      throw new EpubImportError('ZIP_SAFETY_LIMIT', 'Uncompressed EPUB is too large');
    }
  });
}

async function readZipEntry(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  try {
    return await entry.async('string');
  } catch {
    return null;
  }
}

async function readZipEntryBase64(zip: JSZip, path: string): Promise<string | null> {
  const entry = zip.file(path);
  if (!entry) return null;
  try {
    return await entry.async('base64');
  } catch {
    return null;
  }
}
