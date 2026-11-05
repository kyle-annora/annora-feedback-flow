import { mkdir, readFile, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const mime = {
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.otf': 'font/otf',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
};
const cssURL = /url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gi;
const attribute = (tag, name) => tag.match(new RegExp('\\b' + name + '\\s*=\\s*(["\\\'])(.*?)\\1', 'i'))?.[2];
const embedded = value => /^(?:data:|#)/i.test(value);
const safeRawText = (text, tag) => text.replace(new RegExp('</' + tag, 'gi'), match => match.replace('</', '<\\/'));

async function replaceAsync(text, pattern, replacer) {
  const matches = [...text.matchAll(pattern)];
  const values = await Promise.all(matches.map(replacer));
  let index = 0;
  return text.replace(pattern, () => values[index++]);
}

async function sourceFile(root, name, base = root) {
  if (/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(name)) throw new Error(`External resource is not bundled: ${name}`);
  const pathname = name.split(/[?#]/, 1)[0];
  const requested = path.resolve(base, decodeURIComponent(pathname));
  if (requested !== root && !requested.startsWith(root + path.sep)) throw new Error(`Resource is outside the project: ${name}`);
  let actual;
  try { actual = await realpath(requested); }
  catch { throw new Error(`Unresolved local resource: ${name}`); }
  if (actual !== root && !actual.startsWith(root + path.sep)) throw new Error(`Resource resolves outside the project: ${name}`);
  return actual;
}

async function assetURL(root, value, base) {
  if (embedded(value)) return value;
  const file = await sourceFile(root, value, base);
  const type = mime[path.extname(file).toLowerCase()];
  if (!type) throw new Error(`Unsupported asset type: ${value}`);
  const fragment = value.includes('#') ? '#' + value.split('#').slice(1).join('#') : '';
  return `data:${type};base64,${(await readFile(file)).toString('base64')}${fragment}`;
}

async function stylesheet(root, filename) {
  const file = await sourceFile(root, filename);
  const css = await readFile(file, 'utf8');
  if (/@import\b/i.test(css)) throw new Error(`CSS imports must be resolved before bundling: ${filename}`);
  const resolved = await replaceAsync(css, cssURL, async match => {
    const url = (match[1] ?? match[2] ?? match[3]).trim();
    if (!url) throw new Error(`Empty CSS URL in ${filename}`);
    return `url("${await assetURL(root, url, path.dirname(file))}")`;
  });
  return safeRawText(resolved, 'style');
}

export function assertSelfContained(html) {
  if (/<script\b[^>]*\bsrc\s*=/i.test(html)) throw new Error('Unbundled script source remains');
  if (/<link\b[^>]*\brel\s*=\s*["']stylesheet["']/i.test(html)) throw new Error('Unbundled stylesheet remains');
  for (const match of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi)) {
    for (const url of match[1].matchAll(cssURL)) {
      const value = (url[1] ?? url[2] ?? url[3]).trim();
      if (!embedded(value)) throw new Error(`Unresolved CSS URL remains: ${value}`);
    }
  }
  for (const match of html.matchAll(/<(?:img|source)\b[^>]*>/gi)) {
    const src = attribute(match[0], 'src');
    if (src && !embedded(src)) throw new Error(`Unbundled image source remains: ${src}`);
    if (/\bsrcset\s*=/i.test(match[0])) throw new Error('Responsive image srcset must be bundled explicitly');
  }
}

export async function renderStandalone({ projectRoot = defaultRoot, entrypoint = 'index.html' } = {}) {
  const root = await realpath(projectRoot);
  let html = await readFile(await sourceFile(root, entrypoint), 'utf8');
  html = await replaceAsync(html, /<link\b[^>]*>/gi, async match => {
    if (attribute(match[0], 'rel')?.toLowerCase() !== 'stylesheet') return match[0];
    const href = attribute(match[0], 'href');
    if (!href) throw new Error('Stylesheet link has no href');
    return '<style>\n' + await stylesheet(root, href) + '\n</style>';
  });
  html = await replaceAsync(html, /<script\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>\s*<\/script\s*>/gi, async match => {
    const opening = match[0].slice(0, match[0].indexOf('>') + 1).replace(/\s+src\s*=\s*(["']).*?\1/i, '');
    const script = await readFile(await sourceFile(root, match[2]), 'utf8');
    return opening + '\n' + safeRawText(script, 'script') + '\n</script>';
  });
  html = await replaceAsync(html, /<(?:img|source)\b[^>]*>/gi, async match => {
    const src = attribute(match[0], 'src');
    if (!src || embedded(src)) return match[0];
    const data = await assetURL(root, src, root);
    return match[0].replace(/(\bsrc\s*=\s*)(["']).*?\2/i, (_, start) => `${start}"${data}"`);
  });
  assertSelfContained(html);
  return html;
}

export async function bundleDocuments({ projectRoot = defaultRoot, outputDir = path.join(projectRoot, 'docs') } = {}) {
  const html = await renderStandalone({ projectRoot });
  await mkdir(outputDir, { recursive: true });
  const outputs = ['index.html', 'Feedback-Flow.html'];
  await Promise.all(outputs.map(filename => writeFile(path.join(outputDir, filename), html)));
  return { outputs, bytes: Buffer.byteLength(html) };
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const result = await bundleDocuments();
  console.log(`Bundled ${result.outputs.join(' and ')} (${result.bytes} bytes each; all CSS assets embedded).`);
}
