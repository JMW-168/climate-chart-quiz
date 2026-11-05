// 內容驗證（規格 §3、§14 C01–C03）。

import { koppen, matchesKoppen } from './koppen';
import type { ContentMode, ContentPackage, ReviewStatus } from './types';

export interface ValidationIssue {
  code: string;
  /** 具體資料ID */
  id: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/** 某狀態在此內容模式下可否用來出題 */
export function isEligibleStatus(status: ReviewStatus, mode: ContentMode): boolean {
  if (status === 'retired') return false;
  if (mode === 'production') return status === 'published';
  return true; // demo：draft／reviewed／published 皆可，畫面須標示
}

const MONTHS = 12;

function isFiniteNumberArray(xs: unknown, len: number): xs is number[] {
  return Array.isArray(xs) && xs.length === len && xs.every((x) => typeof x === 'number' && Number.isFinite(x));
}

export function validateContentPackage(pkg: ContentPackage): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const err = (code: string, id: string, message: string) => errors.push({ code, id, message });
  const warn = (code: string, id: string, message: string) => warnings.push({ code, id, message });

  const { taxonomy, datasets, explanations, curriculum, mode } = pkg;

  // ── 分類 ──
  const frameworkIds = new Set(taxonomy.frameworks.map((f) => f.id));
  if (!frameworkIds.has(pkg.frameworkId)) err('framework-missing', pkg.frameworkId, '內容包指定的分類框架不存在');
  const groupIds = new Set(taxonomy.groups.map((g) => g.id));
  const typeById = new Map<string, (typeof taxonomy.types)[number]>();
  for (const t of taxonomy.types) {
    if (typeById.has(t.id)) err('type-duplicate', t.id, '氣候類型ID重複');
    typeById.set(t.id, t);
  }
  const labelOwner = new Map<string, string>();
  for (const t of taxonomy.types) {
    if (!t.label.trim()) err('type-label', t.id, '缺少顯示名稱');
    if (!frameworkIds.has(t.frameworkId)) err('type-framework', t.id, `分類框架 ${t.frameworkId} 不存在`);
    if (!groupIds.has(t.groupId)) err('type-group', t.id, `分組 ${t.groupId} 不存在`);
    if (!t.keyFeature.trim()) err('type-key-feature', t.id, '缺少判讀重點 keyFeature');
    if (!t.graphIdentifiable && !t.notIdentifiableReason) err('type-not-identifiable-reason', t.id, '不可命題的類型必須寫明原因');
    if (t.graphIdentifiable && (!Array.isArray(t.koppenCodes) || t.koppenCodes.length === 0)) {
      err('type-koppen', t.id, '可命題類型必須列出可接受的柯本代碼 koppenCodes');
    }
    for (const name of [t.label, ...t.aliases]) {
      const owner = labelOwner.get(name);
      if (owner && owner !== t.id) err('alias-conflict', t.id, `名稱「${name}」同時屬於 ${owner}，相關名稱不可當同義詞`);
      labelOwner.set(name, t.id);
    }
    for (const ref of t.confusableTypeIds) {
      if (!typeById.has(ref) && !taxonomy.types.some((x) => x.id === ref)) err('type-ref', t.id, `confusableTypeIds 引用不存在的 ${ref}`);
      if (ref === t.id) err('type-ref', t.id, 'confusableTypeIds 不可包含自己');
    }
    for (const ref of t.overlapTypeIds) {
      const other = taxonomy.types.find((x) => x.id === ref);
      if (!other) err('type-ref', t.id, `overlapTypeIds 引用不存在的 ${ref}`);
      else if (!other.overlapTypeIds.includes(t.id)) err('overlap-asymmetric', t.id, `與 ${ref} 的重疊關係須雙向標示`);
      if (t.confusableTypeIds.includes(ref)) err('overlap-confusable', t.id, `${ref} 已標示重疊，不可再當干擾選項`);
    }
  }

  // ── 解析 ──
  const explById = new Map<string, (typeof explanations)[number]>();
  for (const e of explanations) {
    if (explById.has(e.id)) err('explanation-duplicate', e.id, '解析ID重複');
    explById.set(e.id, e);
    if (!e.temperatureEvidence?.trim() || !e.precipitationEvidence?.trim() || !e.conclusion?.trim()) {
      err('explanation-empty', e.id, '氣溫證據、降水證據與綜合判斷皆須填寫');
    }
    if (!Array.isArray(e.hints) || e.hints.length !== 3 || e.hints.some((h) => !h?.trim())) {
      err('explanation-hints', e.id, '提示必須恰為三層且不可空白');
    }
    for (const m of [...(e.highlightMonths?.temperature ?? []), ...(e.highlightMonths?.precipitation ?? [])]) {
      if (!Number.isInteger(m) || m < 1 || m > 12) err('explanation-month', e.id, `標記月份 ${m} 不在 1–12`);
    }
    for (const key of Object.keys(e.distractorReasons ?? {})) {
      if (!typeById.has(key)) err('explanation-ref', e.id, `distractorReasons 引用不存在的類型 ${key}`);
    }
  }

  // ── 資料集 ──
  const dsIds = new Set<string>();
  for (const d of datasets) {
    if (dsIds.has(d.id)) err('dataset-duplicate', d.id, '資料集ID重複');
    dsIds.add(d.id);
    if (!isFiniteNumberArray(d.temperatureC, MONTHS)) err('dataset-temperature', d.id, '月均溫必須恰為12個有限數值');
    if (!isFiniteNumberArray(d.precipitationMm, MONTHS)) err('dataset-precipitation', d.id, '月降水必須恰為12個有限數值');
    else if (d.precipitationMm.some((p) => p < 0)) err('dataset-negative-precip', d.id, '降水量不得為負');
    if (isFiniteNumberArray(d.temperatureC, MONTHS) && d.temperatureC.some((t) => t < -90 || t > 60)) {
      err('dataset-temperature-range', d.id, '月均溫超出合理範圍 −90～60°C');
    }
    if (!Array.isArray(d.difficulty) || d.difficulty.length === 0) err('dataset-difficulty', d.id, '至少指定一個難度');
    if (!Number.isInteger(d.revision) || d.revision < 1) err('dataset-revision', d.id, 'revision 必須為正整數');
    if (!d.source?.title?.trim() || !d.source?.license?.trim()) err('dataset-source', d.id, '缺少來源或授權');
    const type = typeById.get(d.typeId);
    if (!type) {
      err('dataset-type', d.id, `引用不存在的類型 ${d.typeId}`);
      continue;
    }
    // 柯本交叉檢查（#1）：不一致須有書面例外原因
    if (d.status !== 'retired' && type.graphIdentifiable && isFiniteNumberArray(d.temperatureC, MONTHS) && isFiniteNumberArray(d.precipitationMm, MONTHS)) {
      const code = koppen(d.temperatureC, d.precipitationMm, d.hemisphere);
      if (!matchesKoppen(code, type.koppenCodes ?? [])) {
        if (d.koppenException?.trim()) {
          warn('koppen-exception', d.id, `柯本 ${code} 與 ${type.id}（${type.koppenCodes.join('/')}）不一致，已註記例外：${d.koppenException}`);
        } else {
          err('koppen-mismatch', d.id, `柯本分類為 ${code}，與所標類型 ${type.id}（可接受 ${type.koppenCodes.join('/')}）不一致`);
        }
      }
    }
    const exp = explById.get(d.explanationId);
    if (!exp) err('dataset-explanation', d.id, `引用不存在的解析 ${d.explanationId}`);
    if (d.status !== 'retired' && !type.graphIdentifiable) {
      err('dataset-type-not-identifiable', d.id, `類型 ${type.id} 標示為無法單憑氣候圖命題，不可有出題資料`);
    }
    if ((d.status === 'reviewed' || d.status === 'published') && !d.review) {
      err('dataset-review', d.id, '已審核或已發布的資料必須有審核紀錄');
    }
    if (exp && isEligibleStatus(d.status, mode)) {
      // 每個混淆類型都必須有「為何不符」的解析
      for (const c of type.confusableTypeIds) {
        if (!exp.distractorReasons[c]) err('explanation-missing-reason', d.id, `缺少與 ${c} 比較的錯誤選項解析`);
      }
      for (const other of taxonomy.types) {
        if (other.id === type.id || type.overlapTypeIds.includes(other.id)) continue;
        if (!other.graphIdentifiable || other.frameworkId !== type.frameworkId) continue;
        if (!exp.distractorReasons[other.id]) warn('explanation-reason-gap', d.id, `沒有與 ${other.id} 比較的解析，該類型不會成為此題干擾選項`);
      }
      if (exp.distractorReasons[type.id]) err('explanation-self-reason', d.id, '不可對自己的類型寫「為何不符」');
      for (const o of type.overlapTypeIds) {
        if (exp.distractorReasons[o]) err('explanation-overlap-reason', d.id, `${o} 與本類型重疊，不可寫成錯誤選項`);
      }
    }
    if (mode === 'production' && d.status === 'published') {
      if (!d.review) err('C03-review', d.id, '正式資料缺審核紀錄');
      if (!d.source.period && d.origin === 'observed-normal') err('C03-period', d.id, '測站資料須註明統計期間');
    }
  }

  // ── 教材對照 ──
  const mapped = new Set(curriculum.entries.map((e) => e.typeId));
  for (const e of curriculum.entries) {
    if (!typeById.has(e.typeId)) err('curriculum-ref', e.typeId, '教材對照引用不存在的類型');
  }
  for (const t of taxonomy.types) {
    if (!mapped.has(t.id)) err('curriculum-missing', t.id, '類型未列入教材對照矩陣');
  }
  if (mode === 'production') {
    if (curriculum.status !== 'published') err('C03-curriculum', 'curriculum-mapping', '正式內容的教材對照矩陣須為已發布');
    for (const e of curriculum.entries) {
      if (e.coverage === 'question-ready' && (e.references.length === 0 || !e.reviewer)) {
        err('C03-curriculum-ref', e.typeId, '可命題類型須有教材版本頁碼與審核人');
      }
    }
    for (const t of taxonomy.types) {
      if (t.status === 'published' && t.curriculumRefs.length === 0) err('C03-type-ref', t.id, '已發布類型須有教材出處');
    }
  }

  // ── 題量 ──
  for (const t of taxonomy.types) {
    if (!t.graphIdentifiable || !isEligibleStatus(t.status, mode)) continue;
    const n = datasets.filter((d) => d.typeId === t.id && isEligibleStatus(d.status, mode)).length;
    if (n < 3) warn('dataset-count', t.id, `只有 ${n} 組可用資料，低於每類 3 組的建置目標`);
  }

  return { ok: errors.length === 0, errors, warnings };
}
