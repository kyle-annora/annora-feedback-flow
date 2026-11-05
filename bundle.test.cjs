const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtemp, mkdir, readFile, writeFile, rm } = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const vm = require('node:vm');
const { spawn } = require('node:child_process');
const bundle = import('./scripts/bundle.mjs');

async function fixture(t, css = '@font-face{font-family:Test;src:url(../assets/test.woff2)} .cover{background:url("../assets/cover.svg")}') {
  const root = await mkdtemp(path.join(os.tmpdir(), 'annora-bundle-test-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, 'styles'));
  await mkdir(path.join(root, 'assets'));
  await Promise.all([
    writeFile(path.join(root, 'index.html'), '<!doctype html><html><head><link rel="stylesheet" href="styles/theme.css"></head><body><img src="assets/cover.svg" alt=""><script src="first.js"></script><script src="second.js"></script></body></html>'),
    writeFile(path.join(root, 'styles/theme.css'), css),
    writeFile(path.join(root, 'assets/test.woff2'), Buffer.from([0, 1, 2, 3, 240, 255])),
    writeFile(path.join(root, 'assets/cover.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><text>$&amp;</text></svg>'),
    writeFile(path.join(root, 'first.js'), 'window.value = "$&"; window.fragment = "</ScRiPt><p>literal</p>";'),
    writeFile(path.join(root, 'second.js'), 'window.value += " second";'),
  ]);
  return root;
}

test('renderer embeds binary fonts and CSS-relative images without changing script values/order', async t => {
  const root = await fixture(t);
  const { renderStandalone, assertSelfContained } = await bundle;
  const html = await renderStandalone({ projectRoot: root });
  assert.match(html, /data:font\/woff2;base64,AAECA\/D\//);
  assert.match(html, /data:image\/svg\+xml;base64,/);
  assert.doesNotMatch(html, /src="(?:first|second)\.js"|href="styles\/theme\.css"|url\("?\.\.\/assets/);
  assert.doesNotThrow(() => assertSelfContained(html));
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  assert.equal(scripts.length, 2);
  const context = { window: {} };
  for (const source of scripts) vm.runInNewContext(source, context);
  assert.equal(context.window.value, '$& second');
  assert.equal(context.window.fragment, '</ScRiPt><p>literal</p>');
});

test('bundle writes identical self-contained public and legacy entrypoints', async t => {
  const root = await fixture(t);
  const { bundleDocuments, assertSelfContained } = await bundle;
  const result = await bundleDocuments({ projectRoot: root });
  assert.deepEqual(result.outputs, ['index.html', 'Feedback-Flow.html']);
  const first = await readFile(path.join(root, 'docs/index.html'), 'utf8');
  const second = await readFile(path.join(root, 'docs/Feedback-Flow.html'), 'utf8');
  assert.equal(first, second);
  assert.equal(result.bytes, Buffer.byteLength(first));
  assert.doesNotThrow(() => assertSelfContained(first));
});

test('missing local CSS assets fail the build before outputs are written', async t => {
  const root = await fixture(t, 'body{background:url("../assets/missing.png")}');
  const { bundleDocuments } = await bundle;
  await assert.rejects(bundleDocuments({ projectRoot: root }), /Unresolved local resource: .*missing\.png/);
  await assert.rejects(readFile(path.join(root, 'docs/index.html')), { code: 'ENOENT' });
});

test('unbundled imports and external or out-of-project CSS resources fail explicitly', async t => {
  const { renderStandalone } = await bundle;
  for (const [css, error] of [
    ['@import "other.css";', /CSS imports must be resolved/],
    ['body{background:url(https://example.test/image.png)}', /External resource is not bundled/],
    ['body{background:url(../../outside.svg)}', /Resource is outside the project/],
  ]) {
    const root = await fixture(t, css);
    await assert.rejects(renderStandalone({ projectRoot: root }), error);
  }
});

test('approved source fonts and all existing scripts render without separate dependencies', async () => {
  const { renderStandalone, assertSelfContained } = await bundle;
  const html = await renderStandalone({ projectRoot: __dirname });
  assert.doesNotThrow(() => assertSelfContained(html));
  assert.match(html, /font-family:Inter;src:url\("data:font\/ttf;base64,/);
  assert.equal((html.match(/font-family:"Source Serif Pro";src:url\("data:font\/woff2;base64,/g) || []).length, 2);
  const source = await readFile(path.join(__dirname, 'index.html'), 'utf8');
  assert.equal((html.match(/<script\b/g) || []).length, (source.match(/<script\b/g) || []).length);
});

test('local server sends the font MIME types used by the editable preview', async t => {
  const child = spawn(process.execPath, [path.join(__dirname, 'scripts/serve.mjs')], {
    cwd: __dirname, env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
  });
  t.after(() => child.kill('SIGTERM'));
  const url = await new Promise((resolve, reject) => {
    let output = '';
    const timeout = setTimeout(() => reject(new Error('Preview server did not start')), 5000);
    child.once('error', error => {clearTimeout(timeout);reject(error);});
    child.stdout.on('data', chunk => {
      output += chunk;
      const match = output.match(/Local: (http:\/\/127\.0\.0\.1:\d+\/)/);
      if (match) {clearTimeout(timeout);resolve(match[1]);}
    });
  });
  for (const [file, type] of [['inter.ttf', 'font/ttf'], ['source-serif-pro-latin-400-normal.woff2', 'font/woff2']]) {
    const response = await fetch(url + 'assets/' + file, { method: 'HEAD' });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('content-type'), type);
  }
});
