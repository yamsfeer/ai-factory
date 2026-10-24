import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const urls = [
  'https://miaoda.feishu.cn/fonts/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+SC:wght@400;500;600;700&display=swap',
  'https://miaoda.feishu.cn/fonts/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200',
];
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';
const outDir = path.resolve('web/public/fonts');
const seen = new Map();
let all = '';
for (const url of urls) {
  const res = await fetch(url, { headers: { 'user-agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  let css = await res.text();
  const refs = [...css.matchAll(/url\((https:\/\/[^)]+?)\)/g)].map(m => m[1]);
  for (const ref of refs) {
    let name = seen.get(ref);
    if (!name) {
      const buf = Buffer.from(await (await fetch(ref)).arrayBuffer());
      name = crypto.createHash('sha1').update(ref).digest('hex').slice(0, 12) + '.woff2';
      await fs.writeFile(path.join(outDir, name), buf);
      seen.set(ref, name);
      process.stdout.write('.');
    }
    css = css.split(ref).join('/fonts/' + name);
  }
  all += css + '\n';
}
await fs.writeFile('web/src/styles/fonts.css', all);
console.log(`\nfonts: ${seen.size} files, css ${(all.length/1024).toFixed(1)}KB`);
