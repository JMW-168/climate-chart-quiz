// GitHub Pages 沒有 SPA rewrite：複製 index.html 為 404.html，讓 /practice/xxx 等深層網址可直接開啟。
import { copyFileSync, writeFileSync } from 'node:fs';
copyFileSync('dist/index.html', 'dist/404.html');
writeFileSync('dist/.nojekyll', '');
console.log('已建立 dist/404.html 與 .nojekyll');
