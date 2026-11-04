import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ContentMode, ContentPackage } from '../../src/domain/types';

export const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const CONTENT_FILES = ['taxonomy', 'datasets', 'explanations', 'curriculum-mapping'] as const;

export interface SourceManifest {
  contentVersion: string;
  mode: ContentMode;
  frameworkId: string;
  note?: string;
}

export function readJson<T>(name: string): T {
  return JSON.parse(readFileSync(join(root, 'content', name), 'utf8')) as T;
}

export function loadSourceContent(modeOverride?: ContentMode): { manifest: SourceManifest; pkg: ContentPackage } {
  const manifest = readJson<SourceManifest>('manifest.json');
  const mode = modeOverride ?? manifest.mode;
  const pkg: ContentPackage = {
    contentVersion: manifest.contentVersion,
    mode,
    frameworkId: manifest.frameworkId,
    taxonomy: readJson('taxonomy.json'),
    datasets: readJson('datasets.json'),
    explanations: readJson('explanations.json'),
    curriculum: readJson('curriculum-mapping.json'),
  };
  return { manifest, pkg };
}
