import { loadSourceContent } from '../../scripts/lib/load-content';
import type { ContentPackage } from '../../src/domain/types';

export function demoPackage(): ContentPackage {
  return structuredClone(loadSourceContent().pkg);
}
