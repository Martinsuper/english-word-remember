import { XMLParser } from 'fast-xml-parser';

export type PackageInfo = {
  title?: string;
  creator?: string;
  publisher?: string;
  language?: string;
  description?: string;
  version: string;
  manifest: Map<string, ManifestItem>;
  spine: SpineItem[];
  coverImageId?: string;
  navItemId?: string;
  ncxItemId?: string;
};

export type ManifestItem = {
  id: string;
  href: string;
  mediaType: string;
  properties?: string;
};

export type SpineItem = {
  idref: string;
  linear: boolean;
};

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  parseAttributeValue: false,
  isArray: (name: string) => {
    return name === 'item' || name === 'itemref' || name === 'meta';
  },
});

export function parsePackageDocument(opfXml: string): PackageInfo {
  const parsed = xmlParser.parse(opfXml);

  const pkg = parsed.package || parsed['opf:package'] || parsed;
  const version = pkg['@_version'] || '2.0';

  const metadata = pkg.metadata || pkg['opf:metadata'] || {};
  const manifest = pkg.manifest || pkg['opf:manifest'] || {};
  const spine = pkg.spine || pkg['opf:spine'] || {};

  const title = extractDcElement(metadata, 'dc:title') || extractSimpleElement(metadata, 'title');
  const creator = extractDcElement(metadata, 'dc:creator') || extractSimpleElement(metadata, 'creator');
  const publisher = extractDcElement(metadata, 'dc:publisher') || extractSimpleElement(metadata, 'publisher');
  const language = extractDcElement(metadata, 'dc:language') || extractSimpleElement(metadata, 'language');
  const description = extractDcElement(metadata, 'dc:description') || extractSimpleElement(metadata, 'description');

  const manifestItems = parseManifest(manifest);
  const spineItems = parseSpine(spine);

  let coverImageId: string | undefined;
  let navItemId: string | undefined;
  let ncxItemId: string | undefined;

  for (const [, item] of manifestItems) {
    if (item.properties?.includes('cover-image')) {
      coverImageId = item.id;
    }
    if (item.properties?.includes('nav')) {
      navItemId = item.id;
    }
    if (item.mediaType === 'application/x-dtbncx+xml') {
      ncxItemId = item.id;
    }
  }

  if (!coverImageId) {
    coverImageId = findCoverFromMeta(metadata, manifestItems);
  }

  const tocId = spine['@_toc'];
  if (tocId && !ncxItemId) {
    ncxItemId = tocId;
  }

  return {
    title,
    creator,
    publisher,
    language,
    description,
    version,
    manifest: manifestItems,
    spine: spineItems,
    coverImageId,
    navItemId,
    ncxItemId,
  };
}

function parseManifest(manifest: any): Map<string, ManifestItem> {
  const items = new Map<string, ManifestItem>();
  const rawItems = manifest.item || [];
  const list = Array.isArray(rawItems) ? rawItems : [rawItems];

  for (const item of list) {
    if (!item) continue;
    const id = item['@_id'];
    const href = item['@_href'];
    const mediaType = item['@_media-type'] || '';
    const properties = item['@_properties'];

    if (id && href) {
      items.set(id, { id, href, mediaType, properties });
    }
  }

  return items;
}

function parseSpine(spine: any): SpineItem[] {
  const items: SpineItem[] = [];
  const rawItems = spine.itemref || [];
  const list = Array.isArray(rawItems) ? rawItems : [rawItems];

  for (const itemref of list) {
    if (!itemref) continue;
    const idref = itemref['@_idref'];
    if (idref) {
      items.push({
        idref,
        linear: itemref['@_linear'] !== 'no',
      });
    }
  }

  return items;
}

function extractDcElement(metadata: any, key: string): string | undefined {
  const value = metadata[key];
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const first = value[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && first['#text']) return String(first['#text']);
  }
  if (typeof value === 'object' && value['#text']) return String(value['#text']);
  return undefined;
}

function extractSimpleElement(metadata: any, key: string): string | undefined {
  const value = metadata[key];
  if (!value) return undefined;
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value['#text']) return String(value['#text']);
  return undefined;
}

function findCoverFromMeta(metadata: any, manifestItems: Map<string, ManifestItem>): string | undefined {
  const metas = metadata.meta || metadata['opf:meta'] || [];
  const list = Array.isArray(metas) ? metas : [metas];

  for (const meta of list) {
    if (!meta) continue;
    const name = meta['@_name'] || meta['name'];
    const content = meta['@_content'] || meta['content'];
    if (name === 'cover' && content) {
      if (manifestItems.has(content)) {
        return content;
      }
    }
  }

  return undefined;
}

export function parseContainerXml(xml: string): string | null {
  const match = xml.match(/<rootfile[^>]*full-path="([^"]+)"/);
  return match ? match[1] : null;
}
