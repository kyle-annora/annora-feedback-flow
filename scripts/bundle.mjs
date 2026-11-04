import { mkdir, readFile, writeFile } from 'node:fs/promises';

const projectRoot = new URL('../', import.meta.url);
const outputDir = new URL('docs/', projectRoot);
const readSource = (filename) => readFile(new URL(filename, projectRoot), 'utf8');

let html = await readSource('index.html');
const cover = Buffer.from(await readSource('cover.svg')).toString('base64');
const css = (await readSource('studio.css')).replace(
  'url("cover.svg")',
  () => 'url("data:image/svg+xml;base64,' + cover + '")'
);
html = html.replace('<link rel="stylesheet" href="studio.css">', () => '<style>' + css + '</style>');
for (const match of Array.from(html.matchAll(/<script src="([^"]+)"><\/script>/g))) {
  const script = (await readSource(match[1])).replace(/<\/script/gi, '<\\/script');
  html = html.replace(match[0], () => '<script>' + script + '</script>');
}

await mkdir(outputDir, { recursive: true });
for (const filename of ['index.html', 'Feedback-Flow.html']) {
  await writeFile(new URL(filename, outputDir), html);
}
