import type { PackageInfo } from './parsePackage';

export type TocEntry = {
  title: string;
  href: string;
};

export function parseNcxNavPoints(ncxXml: string): TocEntry[] {
  const entries: TocEntry[] = [];
  const navPointRegex = /<navPoint[^>]*>([\s\S]*?)<\/navPoint>/g;
  let match: RegExpExecArray | null;

  while ((match = navPointRegex.exec(ncxXml)) !== null) {
    const block = match[1];
    const textMatch = block.match(/<text[^>]*>([\s\S]*?)<\/text>/);
    const contentMatch = block.match(/<content[^>]*src="([^"]+)"/);

    if (textMatch && contentMatch) {
      entries.push({
        title: decodeXmlEntities(textMatch[1].trim()),
        href: contentMatch[1],
      });
    }
  }

  return entries;
}

export function parseEpub3NavDocument(navHtml: string): TocEntry[] {
  const entries: TocEntry[] = [];

  const linkRegex = /<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
  let match: RegExpExecArray | null;

  while ((match = linkRegex.exec(navHtml)) !== null) {
    const href = match[1];
    const title = stripHtmlTags(match[2]).trim();

    if (href && title && !href.startsWith('#') && !href.startsWith('http')) {
      entries.push({
        title: decodeXmlEntities(title),
        href,
      });
    }
  }

  return entries;
}

export function buildChapterTitleMap(
  tocEntries: TocEntry[],
): Map<string, string> {
  const titleMap = new Map<string, string>();
  for (const entry of tocEntries) {
    const hrefWithoutFragment = normalizeTocHref(entry.href);
    if (hrefWithoutFragment && !titleMap.has(hrefWithoutFragment)) {
      titleMap.set(hrefWithoutFragment, entry.title);
    }
  }
  return titleMap;
}

export function normalizeTocHref(href: string): string {
  const withoutFragment = href.split('#')[0].replace(/^\.\//, '');
  try {
    return decodeURIComponent(withoutFragment);
  } catch {
    return withoutFragment;
  }
}

export function extractDocumentTitle(html: string): string | null {
  const heading = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i)?.[1];
  const title = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  const value = stripHtmlTags(heading || title || '').replace(/\s+/g, ' ').trim();
  return value ? decodeXmlEntities(value) : null;
}

export function findNavDocumentHref(packageInfo: PackageInfo): string | undefined {
  if (packageInfo.navItemId) {
    const navItem = packageInfo.manifest.get(packageInfo.navItemId);
    if (navItem) return navItem.href;
  }

  for (const [, item] of packageInfo.manifest) {
    if (item.properties?.includes('nav')) {
      return item.href;
    }
  }

  return undefined;
}

export function findNcxDocumentHref(packageInfo: PackageInfo): string | undefined {
  if (packageInfo.ncxItemId) {
    const ncxItem = packageInfo.manifest.get(packageInfo.ncxItemId);
    if (ncxItem) return ncxItem.href;
  }

  for (const [, item] of packageInfo.manifest) {
    if (item.mediaType === 'application/x-dtbncx+xml') {
      return item.href;
    }
  }

  return undefined;
}

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code) => String.fromCharCode(parseInt(code, 16)));
}

function stripHtmlTags(html: string): string {
  return html.replace(/<[^>]+>/g, '');
}
