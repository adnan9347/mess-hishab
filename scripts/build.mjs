// Production build: compile Tailwind, then copy only the files the site needs into dist/.
import { execSync } from 'node:child_process';
import { cp, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const PUBLIC = ['index.html', 'manifest.webmanifest', 'sw.js', 'css', 'js', 'icons'];

execSync('npx tailwindcss -i ./css/tailwind.src.css -o ./css/tailwind.css --minify', { cwd: root, stdio: 'inherit' });

await rm(dist, { recursive: true, force: true });
await mkdir(dist);
for (const entry of PUBLIC) {
  await cp(join(root, entry), join(dist, entry), {
    recursive: true,
    filter: (src) => !src.endsWith('tailwind.src.css')
  });
}
console.log(`Built ${PUBLIC.length} entries into dist/`);
