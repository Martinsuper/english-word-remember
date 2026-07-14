export function resolveResourcePath(opfDir: string, href: string): string {
  if (!href) return '';

  if (href.startsWith('/') || href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }

  if (href.startsWith('#')) {
    return href;
  }

  const baseDir = opfDir.endsWith('/') ? opfDir : opfDir.substring(0, opfDir.lastIndexOf('/') + 1);
  const combined = `${baseDir}${href}`;
  return normalizePath(combined);
}

export function normalizePath(path: string): string {
  const parts = path.split('/');
  const result: string[] = [];

  for (const part of parts) {
    if (part === '..') {
      if (result.length > 0 && result[result.length - 1] !== '..') {
        result.pop();
      } else {
        result.push(part);
      }
    } else if (part !== '.' && part !== '') {
      result.push(part);
    }
  }

  if (path.startsWith('/') && (result.length === 0 || result[0] !== '')) {
    return `/${result.join('/')}`;
  }

  return result.join('/');
}

export function validateZipEntryPath(entryPath: string): boolean {
  if (!entryPath) return false;

  const normalized = normalizePath(entryPath);

  if (normalized.startsWith('/')) return false;
  if (normalized.includes('..')) return false;
  if (/^[a-zA-Z]:/.test(normalized)) return false;
  if (normalized.startsWith('\\\\')) return false;

  return true;
}

export function resolveHref(href: string): { path: string; fragment: string | null } {
  const hashIndex = href.indexOf('#');
  if (hashIndex === -1) {
    return { path: href, fragment: null };
  }
  return {
    path: href.substring(0, hashIndex),
    fragment: href.substring(hashIndex + 1),
  };
}
