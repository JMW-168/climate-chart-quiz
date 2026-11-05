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
  ChartToLocationQuestion,
  CauseQuestion,
  CauseFactor,
  ExplanationSnapshot,
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
  readonly factorById: Map<string, CauseFactor>;

  constructor(readonly pkg: ContentPackage) {
    const mode = pkg.mode;
    this.types = pkg.taxonomy.types.filter(
      (t) => t.frameworkId === pkg.frameworkId && t.graphIdentifiable && isEligibleStatus(t.status, mode),
    );
    this.typeById = new Map(this.types.map((t) => [t.id, t]));
    this.explById = new Map(pkg.explanations.map((e) => [e.id, e]));
    this.factorById = new Map((pkg.taxonomy.causeFactors ?? []).map((f) => [f.id, f]));
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

function explanationOf(
  target: ClimateDataset,
  exp: Explanation,
  correctLabel: string,
  optionReasons: Record<string, string>,
  optionChecks: NonNullable<ExplanationSnapshot['optionChecks']>,
): ExplanationSnapshot {
  return {
    correctLabel,
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
    ...(target.cause ? { cause: { text: target.cause.text, overlays: target.cause.overlays.slice() } } : {}),
  };
}

/** 兩點的大圓距離（公里） */
function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = Math.PI / 180;
  const h =
    Math.sin(((b.lat - a.lat) * r) / 2) ** 2 +
    Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

function chartOf(d: ClimateDataset): ChartSnapshot {
  return {
    datasetId: d.id,
    temperatureC: d.temperatureC.slice(),
    precipitationMm: d.precipitationMm.slice(),
    hemisphere: d.hemisphere,
    ...(d.location ? { location: { ...d.location } } : {}),
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
    explanation: explanationOf(target, exp, type.label, optionReasons, optionChecks),
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
    explanation: explanationOf(target, exp, type.label, optionReasons, optionChecks),
  };
}

/** 看圖找地點（#14）：地圖上 A～D 四個測站，選出這張氣候圖的位置 */
export function buildChartToLocation(
  index: ContentIndex,
  target: ClimateDataset,
  rng: Rng,
  qid: string,
  difficulty: Difficulty,
): ChartToLocationQuestion | { problem: string } {
  if (!target.location) return { problem: `資料 ${target.id} 沒有測站位置` };
  const type = index.typeById.get(target.typeId)!;
  const exp = index.explanationOf(target);
  const order = orderedDistractorTypes(index, type, rng).filter((t) => !!exp.distractorChecks?.[t.id]);
  const chosen: ClimateDataset[] = [];
  for (const t of order) {
    if (chosen.length >= 3) break;
    const pool = shuffle(
      index.datasets.filter((d) => d.typeId === t.id && d.location),
      rng,
    );
    // 地點彼此至少相距 1500 公里，避免在小地圖上重疊
    const pick = pool.find((d) => [target, ...chosen].every((x) => distanceKm(x.location!, d.location!) > 1500));
    if (pick) chosen.push(pick);
  }
  if (chosen.length < 3) return { problem: `資料 ${target.id} 找不到 3 個合適的錯誤地點` };

  const all = shuffle([target, ...chosen], rng);
  const options = all.map((d, i) => ({
    id: `loc-${d.id}`,
    letter: 'ABCD'[i],
    typeId: d.typeId,
    datasetId: d.id,
    location: { ...d.location! },
  }));
  const optionReasons: Record<string, string> = {};
  const optionChecks: NonNullable<ExplanationSnapshot['optionChecks']> = {};
  for (const d of chosen) {
    const dt = index.typeById.get(d.typeId)!;
    const c = exp.distractorChecks![dt.id];
    const letter = options.find((o) => o.datasetId === d.id)!.letter;
    optionReasons[`loc-${d.id}`] = `地點 ${letter}（${d.location!.nameZh}）是「${dt.label}」：${exp.distractorReasons[dt.id]}`;
    optionChecks[`loc-${d.id}`] = { ...structuredClone(c), typeLabel: dt.label };
  }
  return {
    id: qid,
    kind: 'chart-to-location',
    targetTypeId: type.id,
    targetLabel: type.label,
    targetDatasetId: target.id,
    datasetIds: [target.id],
    correctOptionId: `loc-${target.id}`,
    contentVersion: index.pkg.contentVersion,
    difficulty,
    showSummary: difficulty !== 'advanced',
    scale: computeScale([target]),
    chart: chartOf(target),
    options,
    explanation: explanationOf(target, exp, `地點 ${options.find((o) => o.datasetId === target.id)!.letter}（${target.location.nameZh}）`, optionReasons, optionChecks),
  };
}

/** 成因選擇題（#16）：已知氣候圖與地點，選出主要成因 */
export function buildCause(
  index: ContentIndex,
  target: ClimateDataset,
  rng: Rng,
  qid: string,
  difficulty: Difficulty,
): CauseQuestion | { problem: string } {
  const cause = target.cause;
  if (!cause || !target.location) return { problem: `資料 ${target.id} 沒有成因內容` };
  const main = index.factorById.get(cause.factorId);
  if (!main) return { problem: `資料 ${target.id} 的成因因子不存在` };
  const type = index.typeById.get(target.typeId)!;
  const exp = index.explanationOf(target);
  const excluded = new Set([main.id, ...(cause.alsoTrue ?? []), ...main.coOccurring]);
  const distractors = shuffle(
    [...index.factorById.values()].filter((f) => !excluded.has(f.id)),
    rng,
  ).slice(0, 3);
  if (distractors.length < 3) return { problem: `資料 ${target.id} 的錯誤成因不足 3 個` };
  const options = shuffle([main, ...distractors], rng).map((f) => ({ id: `cause-${f.id}`, factorId: f.id, label: f.label }));
  const optionReasons: Record<string, string> = {};
  for (const f of distractors) {
    optionReasons[`cause-${f.id}`] = `「${f.label}」通常造成「${f.effect}」，不是這裡的主要原因；這裡的主因是「${main.label}」。`;
  }
  return {
    id: qid,
    kind: 'cause',
    targetTypeId: type.id,
    targetLabel: type.label,
    targetDatasetId: target.id,
    datasetIds: [target.id],
    correctOptionId: `cause-${main.id}`,
    contentVersion: index.pkg.contentVersion,
    difficulty,
    showSummary: difficulty !== 'advanced',
    scale: computeScale([target]),
    chart: chartOf(target),
    stem: cause.stem,
    options,
    explanation: explanationOf(target, exp, main.label, optionReasons, {}),
  };
}

const MIXED_KINDS: QuestionKind[] = ['chart-to-type', 'type-to-chart', 'chart-to-location', 'cause'];

/** 回合內每題的題型：混合時四種輪流後洗牌 */
function planKinds(settings: PracticeSettings, n: number, rng: Rng): QuestionKind[] {
  if (settings.kind !== 'mixed') return Array(n).fill(settings.kind);
  const kinds: QuestionKind[] = [];
  for (let i = 0; i < n; i++) kinds.push(MIXED_KINDS[i % MIXED_KINDS.length]);
  return shuffle(kinds, rng);
}

function buildOne(
  kind: QuestionKind,
  index: ContentIndex,
  d: ClimateDataset,
  rng: Rng,
  qid: string,
  settings: PracticeSettings,
  seen: Set<string>,
  isTargetCandidate: (d: ClimateDataset) => boolean,
): QuestionSnapshot | { problem: string } {
  switch (kind) {
    case 'chart-to-type':
      return buildChartToType(index, d, rng, qid, settings.difficulty);
    case 'type-to-chart':
      return buildTypeToChart(index, d, rng, qid, settings.difficulty, seen, isTargetCandidate);
    case 'chart-to-location':
      return buildChartToLocation(index, d, rng, qid, settings.difficulty);
    case 'cause':
      return buildCause(index, d, rng, qid, settings.difficulty);
  }
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
      let r = buildOne(kind, index, d, rng, qid, settings, seen, isTargetCandidate);
      // 混合題型時，資料缺少成因或位置就改出看圖選氣候；指定題型則略過此資料
      if ('problem' in r && settings.kind === 'mixed' && (kind === 'cause' || kind === 'chart-to-location')) {
        r = buildChartToType(index, d, rng, qid, settings.difficulty);
      }
      if ('problem' in r) {
        if (kind !== 'cause' && kind !== 'chart-to-location') problems.push({ id: d.id, message: r.problem });
      } else built = r;
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
  switch (q.kind) {
    case 'chart-to-type':
      return { ...q, id: newId, options: shuffle(q.options, rng) };
    case 'cause':
      return { ...q, id: newId, options: shuffle(q.options, rng) };
    case 'type-to-chart':
      return { ...q, id: newId, options: shuffle(q.options, rng).map((o, i) => ({ ...o, letter: 'ABCD'[i] })) };
    case 'chart-to-location': {
      const options = shuffle(q.options, rng).map((o, i) => ({ ...o, letter: 'ABCD'[i] }));
      // 解析文字中的地點字母要跟著更新
      const letterOf = new Map(options.map((o) => [o.id, o.letter]));
      const optionReasons = Object.fromEntries(
        Object.entries(q.explanation.optionReasons).map(([id, t]) => [id, t.replace(/^地點 [A-D]/, `地點 ${letterOf.get(id) ?? ''}`)]),
      );
      const correct = options.find((o) => o.id === q.correctOptionId)!;
      return {
        ...q,
        id: newId,
        options,
        explanation: { ...q.explanation, optionReasons, correctLabel: `地點 ${correct.letter}（${correct.location.nameZh}）` },
      };
    }
  }
}

export function buildReviewQuestions(snapshots: QuestionSnapshot[], seed: number): QuestionSnapshot[] {
  const rng = createRng(seed);
  return shuffle(snapshots, rng).map((q, i) => reshuffleQuestion(q, rng, `r${i + 1}-${q.targetDatasetId}`));
}
