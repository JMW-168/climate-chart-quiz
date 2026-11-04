// 驗證後把內容包輸出為不可變版本路徑 public/content/<version>/，
// 並產生 public/content/manifest.json（含檔案大小與 SHA-256，規格 §12）。
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateContentPackage } from '../src/domain/validation';
import type { ContentManifest, ContentManifestFile } from '../src/domain/types';
import { CONTENT_FILES, loadSourceContent, readJson, root } from './lib/load-content';

const { manifest, pkg } = loadSourceContent();
const result = validateContentPackage(pkg);
if (!result.ok) {
  for (const e of result.errors) console.error(`✗ [${e.code}] ${e.id}：${e.message}`);
  console.error('內容驗證失敗，停止建置。');
  process.exit(1);
}

const outRoot = join(root, 'public', 'content');
rmSync(outRoot, { recursive: true, force: true });
const versionDir = join(outRoot, `v${manifest.contentVersion}`);
mkdirSync(versionDir, { recursive: true });

const files: ContentManifestFile[] = [];
for (const name of CONTENT_FILES) {
  const text = JSON.stringify(readJson(`${name}.json`));
  const bytes = Buffer.from(text, 'utf8');
  writeFileSync(join(versionDir, `${name}.json`), bytes);
  files.push({
    name,
    path: `v${manifest.contentVersion}/${name}.json`,
    size: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  });
}

const out: ContentManifest = {
  contentVersion: manifest.contentVersion,
  mode: manifest.mode,
  frameworkId: manifest.frameworkId,
  generatedAt: new Date().toISOString(),
  files,
};
writeFileSync(join(outRoot, 'manifest.json'), JSON.stringify(out, null, 2));
console.log(`內容包 ${manifest.contentVersion}（${manifest.mode}）已輸出 ${files.length} 個檔案`);
