const ALLOWED_TAGS = new Set([
  'p', 'br', 'hr',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'div', 'span', 'section', 'article', 'aside', 'header', 'footer', 'nav', 'main',
  'em', 'strong', 'b', 'i', 'u', 'small', 'sub', 'sup', 'mark', 'del', 'ins',
  'a', 'img',
  'ul', 'ol', 'li', 'dl', 'dt', 'dd',
  'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col',
  'blockquote', 'q', 'cite', 'pre', 'code',
  'figure', 'figcaption',
  'ruby', 'rt', 'rp',
  'abbr', 'time',
  'html', 'head', 'body', 'title',
]);

const ALLOWED_ATTRS = new Set([
  'href', 'src', 'alt', 'title', 'class', 'id',
  'colspan', 'rowspan', 'scope',
  'lang', 'xml:lang', 'dir',
  'epub:type',
  'role', 'aria-label',
  'width', 'height',
  'type', 'start', 'value',
]);

const UNSAFE_TAGS = new Set([
  'script', 'style', 'iframe', 'object', 'embed', 'applet',
  'form', 'input', 'button', 'textarea', 'select', 'option',
  'link', 'meta', 'base',
  'svg', 'math',
  'audio', 'video', 'source', 'track',
  'canvas', 'map', 'area',
]);

export function sanitizeChapterHtml(html: string): string {
  let result = html;

  for (const tag of UNSAFE_TAGS) {
    result = removeTag(result, tag);
  }

  result = result.replace(/\s+on\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  result = result.replace(
    /(<\w+[^>]*\s)href\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi,
    '$1href="#"',
  );

  result = result.replace(
    /(<\w+[^>]*\s)src\s*=\s*(?:"javascript:[^"]*"|'javascript:[^']*')/gi,
    '$1src=""',
  );

  result = result.replace(
    /<(\w+)((?:\s+[^>]*)?)>/g,
    (match, tagName: string, attrs: string) => {
      const tag = tagName.toLowerCase();
      if (!ALLOWED_TAGS.has(tag) && !UNSAFE_TAGS.has(tag)) {
        return '';
      }

      const cleanAttrs = sanitizeAttributes(attrs);
      return `<${tag}${cleanAttrs}>`;
    },
  );

  result = result.replace(/<(\w+)(\s[^>]*)?\/>/g, (match, tagName: string, attrs: string) => {
    const tag = tagName.toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) {
      return '';
    }
    const cleanAttrs = attrs ? sanitizeAttributes(attrs) : '';
    const voidElements = new Set(['br', 'hr', 'img', 'col', 'input']);
    if (voidElements.has(tag)) {
      return `<${tag}${cleanAttrs} />`;
    }
    return `<${tag}${cleanAttrs}></${tag}>`;
  });

  return result;
}

function removeTag(html: string, tag: string): string {
  const selfClosing = new RegExp(`<${tag}[^>]*/\s*>`, 'gi');
  html = html.replace(selfClosing, '');

  const withContent = new RegExp(`<${tag}[^>]*>[\\s\\S]*?<\\/${tag}\\s*>`, 'gi');
  html = html.replace(withContent, '');

  const orphanOpen = new RegExp(`<${tag}[^>]*>`, 'gi');
  html = html.replace(orphanOpen, '');

  const orphanClose = new RegExp(`<\\/${tag}\\s*>`, 'gi');
  html = html.replace(orphanClose, '');

  return html;
}

function sanitizeAttributes(attrs: string): string {
  if (!attrs) return '';

  const attrRegex = /(\w[\w:.-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+)))?/g;
  let match: RegExpExecArray | null;
  const cleanParts: string[] = [];

  while ((match = attrRegex.exec(attrs)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4] ?? '';

    if (name.startsWith('on')) continue;
    if (name.startsWith('data-') && name !== 'data-chapter-id') continue;
    if (!ALLOWED_ATTRS.has(name) && !name.startsWith('xmlns')) continue;

    if (name === 'href' || name === 'src') {
      const trimmed = value.trim().toLowerCase();
      if (
        trimmed.startsWith('javascript:') ||
        trimmed.startsWith('vbscript:') ||
        trimmed.startsWith('data:text/html')
      ) {
        continue;
      }
      if (name === 'src' && /^(?:https?:|\/\/)/.test(trimmed)) continue;
    }

    cleanParts.push(` ${name}="${escapeAttr(value)}"`);
  }

  return cleanParts.join('');
}

function escapeAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
