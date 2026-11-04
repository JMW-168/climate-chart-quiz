// 題庫內容來源（規格 §8、§12）：讀取靜態 JSON 版本包，校驗大小與 SHA-256 後整包存入 IndexedDB。
// 下載失敗保留舊完整版本，不半套覆蓋。之後可替換為遠端來源。

import { validateContentPackage } from '../domain/validation';
import type { ContentManifest, ContentPackage } from '../domain/types';
import type { ProgressRepository, StoredContent } from './progress';

export class ContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ContentError';
  }
}

const base = () => import.meta.env.BASE_URL;

async function sha256Hex(buf: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

function isJsonResponse(res: Response): boolean {
  // 靜態主機可能把不存在的路徑回成 index.html；不可當成功
  const ct = res.headers.get('content-type') ?? '';
  return res.ok && !ct.includes('text/html');
}

export async function fetchManifest(): Promise<ContentManifest> {
  let res: Response;
  try {
    res = await fetch(`${base()}content/manifest.json`, { cache: 'no-store' });
  } catch {
    throw new ContentError('無法連線取得題庫版本資訊');
  }
  if (!isJsonResponse(res)) throw new ContentError(`題庫版本資訊讀取失敗（HTTP ${res.status}）`);
  const m = (await res.json()) as ContentManifest;
  if (!m?.contentVersion || !Array.isArray(m.files) || m.files.length !== 4) throw new ContentError('題庫版本資訊格式不正確');
  return m;
}

export async function downloadPackage(manifest: ContentManifest): Promise<ContentPackage> {
  const parts: Record<string, unknown> = {};
  for (const f of manifest.files) {
    let res: Response;
    try {
      res = await fetch(`${base()}content/${f.path}`, { cache: 'no-cache' });
    } catch {
      throw new ContentError(`下載 ${f.name} 時中斷`);
    }
    if (!isJsonResponse(res)) throw new ContentError(`下載 ${f.name} 失敗（HTTP ${res.status}）`);
    const buf = await res.arrayBuffer();
    if (buf.byteLength !== f.size) throw new ContentError(`${f.name} 檔案大小不符，可能下載不完整`);
    if ((await sha256Hex(buf)) !== f.sha256) throw new ContentError(`${f.name} 校驗碼不符`);
    parts[f.name] = JSON.parse(new TextDecoder().decode(buf));
  }
  const pkg: ContentPackage = {
    contentVersion: manifest.contentVersion,
    mode: manifest.mode,
    frameworkId: manifest.frameworkId,
    taxonomy: parts['taxonomy'] as ContentPackage['taxonomy'],
    datasets: parts['datasets'] as ContentPackage['datasets'],
    explanations: parts['explanations'] as ContentPackage['explanations'],
    curriculum: parts['curriculum-mapping'] as ContentPackage['curriculum'],
  };
  const v = validateContentPackage(pkg);
  if (!v.ok) {
    const first = v.errors[0];
    throw new ContentError(`題庫內容驗證失敗：${first.id} ${first.message}`);
  }
  return pkg;
}

export interface ContentLoadResult {
  content: StoredContent | undefined;
  /** 本次是否下載了新版本 */
  updated: boolean;
  error: string | null;
}

/** 啟動時呼叫：先用本機完整版本，再嘗試取得新版本。 */
export async function syncContent(repo: ProgressRepository, force = false): Promise<ContentLoadResult> {
  const current = await repo.getCurrentContent();
  try {
    const manifest = await fetchManifest();
    if (!force && current && current.contentVersion === manifest.contentVersion) {
      return { content: current, updated: false, error: null };
    }
    const pkg = await downloadPackage(manifest);
    const stored: StoredContent = { contentVersion: manifest.contentVersion, manifest, pkg, storedAt: new Date().toISOString() };
    await repo.saveContent(stored);
    return { content: stored, updated: true, error: null };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    // 離線或下載失敗：沿用舊完整版本
    return { content: current, updated: false, error: current ? null : msg };
  }
}
