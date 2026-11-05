// 題目產生器（規格 §10）：從審核資料組題與洗牌，不在執行時改動月資料。

import { createRng, shuffle, type Rng } from './rng';
import { computeScale } from './stats';
import { isEligibleStatus } from './validation';
import type {
  ChartSnapshot,
  ChartToTypeQuestion,
  ClimateDataset,
  ClimateType,
  ContentPackage,
  Difficulty,
  Explanation,
  PracticeSettings,
  QuestionKind,
  QuestionSnapshot,
  TypeToChartQuestion,
} from './types';

export interface GenerationResult {
  questions: QuestionSnapshot[];
  requested: number;
  /** 實際可組出的題數 */
  available: number;
  /** 給使用者看的提示（資料不足、重新分配等） */
  notices: string[];
  /** 組題失敗的具體資料ID（C02） */
  problems: { id: string; message: string }[];
}

export class ContentIndex {
  readonly types: ClimateType[];
  readonly typeById: Map<string, ClimateType>;
  readonly explById: Map<string, Explanation>;
  readonly datasets: ClimateDataset[];

  constructor(readonly pkg: ContentPackage) {
    const mode = pkg.mode;
    this.types = pkg.taxonomy.types.filter(
      (t) => t.frameworkId === pkg.frameworkId && t.graphIdentifiable && isEligibleStatus(t.status, mode),
    );
    this.typeById = new Map(this.types.map((t) => [t.id, t]));
    this.explById = new Map(pkg.explanations.map((e) => [e.id, e]));
    this.datasets = pkg.datasets.filter(
      (d) => isEligibleStatus(d.status, mode) && this.typeById.has(d.typeId) && this.explById.has(d.explanationId),
    );
  }

  explanationOf(d: ClimateDataset): Explanation {
    const e = this.explById.get(d.explanationId);
    if (!e) throw new Error(`缺少解析 ${d.explanationId}（資料 ${d.id}）`);
    return e;
  }

  overlaps(a: string, b: string): boolean {
    const ta = this.typeById.get(a);
    const tb = this.typeById.get(b);
    return !!(ta?.overlapTypeIds.includes(b) || tb?.overlapTypeIds.includes(a));
  }
}

function chartOf(d: ClimateDataset): ChartSnapshot {
  return {
    datasetId: d.id,
    temperatureC: d.temperatureC.slice(),
    precipitationMm: d.precipitationMm.slice(),
    hemisphere: d.hemisphere,
  };
}

/** 依「混淆類型優先，其餘補足」排序候選類型 */
function orderedDistractorTypes(index: ContentIndex, target: ClimateType, rng: Rng): ClimateType[] {
  const others = index.types.filter((t) => t.id !== target.id && !index.overlaps(t.id, target.id));
  const confusable = shuffle(others.filter((t) => target.confusableTypeIds.includes(t.id)), rng);
  const rest = shuffle(others.filter((t) => !target.confusableTypeIds.includes(t.id)), rng);
  return [...confusable, ...rest];
}

function pickNonOverlapping<T>(items: T[], typeIdOf: (x: T) => string, index: ContentIndex, n: number): T[] {
  const chosen: T[] = [];
  for (const it of items) {
    if (chosen.length >= n) break;
    const id = typeIdOf(it);
    if (chosen.some((c) => typeIdOf(c) === id || index.overlaps(typeIdOf(c), id))) continue;
    chosen.push(it);
  }
  return chosen;
}

export function buildChartToType(
  index: ContentIndex,
  target: ClimateDataset,
  rng: Rng,
  qid: string,
  difficulty: Difficulty,
): ChartToTypeQuestion | { problem: string } {
  const type = index.typeById.get(target.typeId)!;
  const exp = index.explanationOf(target);
  const candidates = orderedDistractorTypes(index, type, rng).filter((t) => !!exp.distractorReasons[t.id]);
  const distractors = pickNonOverlapping(candidates, (t) => t.id, index, 3);
  if (distractors.length < 3) return { problem: `資料 ${target.id} 的有效干擾選項不足 3 個` };

  const options = shuffle([type, ...distractors], rng).map((t) => ({ id: `opt-${t.id}`, typeId: t.id, label: t.label }));
  const correctOptionId = `opt-${type.id}`;
  const optionReasons: Record<string, string> = {};
  const optionChecks: NonNullable<ChartToTypeQuestion['explanation']['optionChecks']> = {};
  for (const t of distractors) {
    optionReasons[`opt-${t.id}`] = exp.distractorReasons[t.id];
    const c = exp.distractorChecks?.[t.id];
    if (c) optionChecks[`opt-${t.id}`] = { ...structuredClone(c), typeLabel: t.label };
  }

  return {
    id: qid,
    kind: 'chart-to-type',
    targetTypeId: type.id,
    targetLabel: type.label,
    targetDatasetId: target.id,
    datasetIds: [target.id],
    correctOptionId,
    contentVersion: index.pkg.contentVersion,
    difficulty,
    showSummary: difficulty !== 'advanced',
    scale: computeScale([target]),
    chart: chartOf(target),
    options,
    explanation: {
      correctLabel: type.label,
      temperatureEvidence: exp.temperatureEvidence,
      precipitationEvidence: exp.precipitationEvidence,
      conclusion: exp.conclusion,
      hints: [...exp.hints] as [string, string, string],
      highlightMonths: {
        temperature: exp.highlightMonths.temperature.slice(),
        precipitation: exp.highlightMonths.precipitation.slice(),
      },
      optionReasons,
      optionChecks,
    },
  };
}

export function buildTypeToChart(
  index: ContentIndex,
  target: ClimateDataset,
  rng: Rng,
  qid: string,
  difficulty: Difficulty,
  seen: Set<string>,
  isTargetCandidate: (d: ClimateDataset) => boolean = () => false,
): TypeToChartQuestion | { problem: string } {
  const type = index.typeById.get(target.typeId)!;
  const exp = index.explanationOf(target);
  const typeOrder = orderedDistractorTypes(index, type, rng);
  const rank = new Map(typeOrder.map((t, i) => [t.id, i]));

  // 候選錯誤圖：其他類型、且其解析說明了「為何不是目標類型」。
  // 非進階題不拿只標進階（如南半球）的圖當干擾，避免入門題過難。
  const pool = index.datasets.filter(
    (d) =>
      d.id !== target.id &&
      rank.has(d.typeId) &&
      !!index.explanationOf(d).distractorReasons[type.id] &&
      (difficulty === 'advanced' || d.difficulty.some((x) => x !== 'advanced')),
  );
  // 優先：混淆類型 → 不會成為本回合目標的圖（或已看過的圖）→ 同難度
  // 如此錯誤圖較少「消耗」之後可當正確答案的新圖（規格 §10 第 7 點）。
  const score = (d: ClimateDataset) =>
    (rank.get(d.typeId) ?? 99) * 10 +
    (isTargetCandidate(d) && !seen.has(d.id) ? 4 : 0) +
    (d.difficulty.includes(difficulty) ? 0 : 1);
  // 每個類型先洗牌再依分數排序，保持可重現又有變化
  const sorted = shuffle(pool, rng).sort((a, b) => score(a) - score(b));
  // 每個類型只取一張，避免同類錯誤圖重複
  const distractors = pickNonOverlapping(sorted, (d) => d.typeId, index, 3);
  if (distractors.length < 3) return { problem: `資料 ${target.id} 的有效錯誤圖不足 3 張` };

  const all = shuffle([target, ...distractors], rng);
  const options = all.map((d, i) => ({ id: `opt-${d.id}`, letter: 'ABCD'[i], typeId: d.typeId, chart: chartOf(d) }));
  const optionReasons: Record<string, string> = {};
  const optionChecks: NonNullable<TypeToChartQuestion['explanation']['optionChecks']> = {};
  for (const d of distractors) {
    const dt = index.typeById.get(d.typeId)!;
    optionReasons[`opt-${d.id}`] = `這張是「${dt.label}」的圖：${index.explanationOf(d).distractorReasons[type.id]}`;
    const c = index.explanationOf(d).distractorChecks?.[type.id];
    // Q2：檢查目標類型的條件放在這張錯誤圖上哪一項不成立；typeLabel 記錄這張圖實際的類型
    if (c) optionChecks[`opt-${d.id}`] = { ...structuredClone(c), typeLabel: dt.label };
  }

  return {
    id: qid,
    kind: 'type-to-chart',
    targetTypeId: type.id,
    targetLabel: type.label,
    targetDatasetId: target.id,
    datasetIds: all.map((d) => d.id),
    correctOptionId: `opt-${target.id}`,
    contentVersion: index.pkg.contentVersion,
    difficulty,
    showSummary: difficulty !== 'advanced',
    scale: computeScale(all),
    options,
    explanation: {
      correctLabel: type.label,
      temperatureEvidence: exp.temperatureEvidence,
      precipitationEvidence: exp.precipitationEvidence,
      conclusion: exp.conclusion,
      hints: [...exp.hints] as [string, string, string],
      highlightMonths: {
        temperature: exp.highlightMonths.temperature.slice(),
        precipitation: exp.highlightMonths.precipitation.slice(),
      },
      optionReasons,
      optionChecks,
    },
  };
}

/** 回合內每題的題型：混合時兩種各半後洗牌 */
function planKinds(settings: PracticeSettings, n: number, rng: Rng): QuestionKind[] {
  if (settings.kind !== 'mixed') return Array(n).fill(settings.kind);
  const kinds: QuestionKind[] = [];
  for (let i = 0; i < n; i++) kinds.push(i % 2 === 0 ? 'chart-to-type' : 'type-to-chart');
  return shuffle(kinds, rng);
}

export function generateSession(pkg: ContentPackage, settings: PracticeSettings, seed: number): GenerationResult {
  const rng = createRng(seed);
  const index = new ContentIndex(pkg);
  const notices: string[] = [];
  const problems: { id: string; message: string }[] = [];
  const exclude = new Set(settings.excludeDatasetIds ?? []);

  const targetTypes = (settings.typeIds.length ? index.types.filter((t) => settings.typeIds.includes(t.id)) : index.types).slice();
  const pools = new Map<string, ClimateDataset[]>();
  for (const t of shuffle(targetTypes, rng)) {
    const ds = index.datasets.filter((d) => d.typeId === t.id && d.difficulty.includes(settings.difficulty) && !exclude.has(d.id));
    if (ds.length) pools.set(t.id, shuffle(ds, rng));
  }
  const emptyTypes = targetTypes.filter((t) => !pools.has(t.id));
  if (emptyTypes.length) notices.push(`以下類型在此難度沒有可用資料：${emptyTypes.map((t) => t.label).join('、')}`);

  const candidateIds = new Set([...pools.values()].flat().map((d) => d.id));
  const isTargetCandidate = (d: ClimateDataset) => candidateIds.has(d.id);

  const kinds = planKinds(settings, settings.count, rng);
  const questions: QuestionSnapshot[] = [];
  const seen = new Set<string>();
  let rotation = [...pools.keys()];
  let cursor = 0;

  // 每輪最多嘗試 rotation 長度 × 資料量次，保證終止（Q03）
  while (questions.length < settings.count && rotation.length) {
    const typeId = rotation[cursor % rotation.length];
    const pool = pools.get(typeId)!;
    const kind = kinds[questions.length];
    let built: QuestionSnapshot | null = null;
    while (pool.length && !built) {
      const d = pool.shift()!;
      if (seen.has(d.id)) continue;
      const qid = `q${questions.length + 1}-${d.id}`;
      const r =
        kind === 'chart-to-type'
          ? buildChartToType(index, d, rng, qid, settings.difficulty)
          : buildTypeToChart(index, d, rng, qid, settings.difficulty, seen, isTargetCandidate);
      if ('problem' in r) problems.push({ id: d.id, message: r.problem });
      else built = r;
    }
    // 用完的類型移出輪替；游標停在原位即指向下一個類型
    if (!pool.length) rotation = rotation.filter((id) => id !== typeId);
    else cursor++;
    if (built) {
      questions.push(built);
      for (const id of built.datasetIds) seen.add(id);
      seen.add(built.targetDatasetId);
    }
  }

  if (questions.length < settings.count) {
    notices.push(`目前設定只能組出 ${questions.length} 題（要求 ${settings.count} 題），不會重複湊題。`);
  }
  return { questions, requested: settings.count, available: questions.length, notices, problems };
}

/** 錯題複習：沿用快照資料，重新洗牌選項位置 */
export function reshuffleQuestion(q: QuestionSnapshot, rng: Rng, newId: string): QuestionSnapshot {
  if (q.kind === 'chart-to-type') {
    return { ...q, id: newId, options: shuffle(q.options, rng) };
  }
  const options = shuffle(q.options, rng).map((o, i) => ({ ...o, letter: 'ABCD'[i] }));
  return { ...q, id: newId, options };
}

export function buildReviewQuestions(snapshots: QuestionSnapshot[], seed: number): QuestionSnapshot[] {
  const rng = createRng(seed);
  return shuffle(snapshots, rng).map((q, i) => reshuffleQuestion(q, rng, `r${i + 1}-${q.targetDatasetId}`));
}
