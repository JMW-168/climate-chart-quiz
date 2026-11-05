// 領域型別：不依賴任何 UI 框架。對應規格 §9 資料契約。

export type ReviewStatus = 'draft' | 'reviewed' | 'published' | 'retired';
export type QuestionKind = 'chart-to-type' | 'type-to-chart';
export type Difficulty = 'beginner' | 'standard' | 'advanced';
export type Hemisphere = 'north' | 'south' | 'equatorial';

/** 內容包模式：demo 允許 draft／reviewed 示範資料出題並在畫面標示；production 只用 published。 */
export type ContentMode = 'demo' | 'production';

export interface ClassificationFramework {
  id: string;
  label: string;
  description: string;
}

export interface ClimateType {
  /** 穩定ID，名稱變動不重建ID */
  id: string;
  label: string;
  /** 僅限已確認同義 */
  aliases: string[];
  frameworkId: string;
  /** 教學分組（熱帶、乾燥…），只作設定頁分組顯示 */
  groupId: string;
  status: ReviewStatus;
  graphIdentifiable: boolean;
  /** 未能單憑氣候圖命題的原因（graphIdentifiable=false 時必填） */
  notIdentifiableReason?: string;
  confusableTypeIds: string[];
  /** 語義重疊、不可同時出現在同一題選項中的類型 */
  overlapTypeIds: string[];
  /** 判讀重點：用於「為何不符」的解析 */
  keyFeature: string;
  /** 可接受的柯本代碼（前綴比對，如 "Cs" 涵蓋 Csa/Csb），作為資料交叉檢查 */
  koppenCodes: string[];
  curriculumRefs: string[];
}

export interface TypeGroup {
  id: string;
  label: string;
}

export interface Taxonomy {
  frameworks: ClassificationFramework[];
  groups: TypeGroup[];
  types: ClimateType[];
}

export interface DatasetSource {
  title: string;
  url?: string;
  period?: string;
  license: string;
}

export interface DatasetReview {
  reviewer: string;
  reviewedAt: string;
  notes: string;
}

export interface ClimateDataset {
  id: string;
  revision: number;
  typeId: string;
  /** 恰12項，1月至12月 */
  temperatureC: number[];
  /** 恰12項 */
  precipitationMm: number[];
  difficulty: Difficulty[];
  hemisphere: Hemisphere;
  status: ReviewStatus;
  origin: 'observed-normal' | 'teaching-synthetic';
  source: DatasetSource;
  review: DatasetReview | null;
  explanationId: string;
  /** 柯本代碼與所標類型不一致時，必須寫明保留理由 */
  koppenException?: string;
  regionIds?: string[];
}

export interface Explanation {
  id: string;
  temperatureEvidence: string;
  precipitationEvidence: string;
  conclusion: string;
  hints: [string, string, string];
  /** climateTypeId → 此圖為何不符該類型 */
  distractorReasons: Record<string, string>;
  /** 月份為 1–12 */
  highlightMonths: { temperature: number[]; precipitation: number[] };
}

export interface CurriculumEntry {
  typeId: string;
  /** 教材版本／學年／冊別／頁碼；示範資料留空並標記待補 */
  references: { publisher: string; schoolYear: string; volume: string; page: string }[];
  coverage: 'question-ready' | 'teaching-only' | 'pending';
  reason: string;
  reviewer: string | null;
  reviewedAt: string | null;
}

export interface CurriculumMapping {
  status: ReviewStatus;
  note: string;
  entries: CurriculumEntry[];
}

export interface ContentManifestFile {
  name: 'taxonomy' | 'datasets' | 'explanations' | 'curriculum-mapping';
  path: string;
  size: number;
  sha256: string;
}

export interface ContentManifest {
  contentVersion: string;
  mode: ContentMode;
  frameworkId: string;
  generatedAt: string;
  files: ContentManifestFile[];
}

export interface ContentPackage {
  contentVersion: string;
  mode: ContentMode;
  frameworkId: string;
  taxonomy: Taxonomy;
  datasets: ClimateDataset[];
  explanations: Explanation[];
  curriculum: CurriculumMapping;
}

// ───────────── 題目快照 ─────────────

export interface ChartSnapshot {
  datasetId: string;
  temperatureC: number[];
  precipitationMm: number[];
  hemisphere: Hemisphere;
}

export interface ExplanationSnapshot {
  correctLabel: string;
  temperatureEvidence: string;
  precipitationEvidence: string;
  conclusion: string;
  hints: [string, string, string];
  highlightMonths: { temperature: number[]; precipitation: number[] };
  /** optionId → 為何不符 */
  optionReasons: Record<string, string>;
}

export interface ChartScale {
  tempMin: number;
  tempMax: number;
  precipMax: number;
}

interface QuestionBase {
  id: string;
  targetTypeId: string;
  targetLabel: string;
  /** 正確答案所用的資料集 */
  targetDatasetId: string;
  datasetIds: string[];
  correctOptionId: string;
  contentVersion: string;
  difficulty: Difficulty;
  showSummary: boolean;
  scale: ChartScale;
  explanation: ExplanationSnapshot;
}

export interface ChartToTypeQuestion extends QuestionBase {
  kind: 'chart-to-type';
  chart: ChartSnapshot;
  options: { id: string; typeId: string; label: string }[];
}

export interface TypeToChartQuestion extends QuestionBase {
  kind: 'type-to-chart';
  options: { id: string; letter: string; typeId: string; chart: ChartSnapshot }[];
}

export type QuestionSnapshot = ChartToTypeQuestion | TypeToChartQuestion;

// ───────────── 練習回合 ─────────────

export type KindSetting = QuestionKind | 'mixed';

export interface PracticeSettings {
  kind: KindSetting;
  /** 空陣列＝全部可命題類型 */
  typeIds: string[];
  difficulty: Difficulty;
  count: number;
  /** 不作為正確答案的資料集（同類新圖練習用） */
  excludeDatasetIds?: string[];
}

export type SessionMode = 'practice' | 'review';
export type SessionStatus = 'active' | 'completed' | 'ended' | 'abandoned';

export interface QuestionProgress {
  selectedOptionId: string | null;
  hintsShown: number;
  submitted: boolean;
}

export interface Session {
  id: string;
  mode: SessionMode;
  settings: PracticeSettings;
  seed: number;
  contentVersion: string;
  contentMode: ContentMode;
  questions: QuestionSnapshot[];
  progress: Record<string, QuestionProgress>;
  currentIndex: number;
  status: SessionStatus;
  createdAt: string;
  updatedAt: string;
  /** 每次寫入遞增，多分頁衝突檢查用 */
  revision: number;
}

export interface Attempt {
  sessionId: string;
  questionId: string;
  selectedOptionId: string;
  correct: boolean;
  hintCount: number;
  /** ISO 8601 */
  submittedAt: string;
}

export interface MistakeRecord {
  /** datasetId|targetTypeId|questionKind */
  key: string;
  datasetId: string;
  targetTypeId: string;
  targetLabel: string;
  kind: QuestionKind;
  wrongCount: number;
  pending: boolean;
  firstWrongAt: string;
  lastWrongAt: string;
  lastReviewedAt: string | null;
  /** 最近一次的題目快照，複習時重新洗牌使用 */
  question: QuestionSnapshot;
  history: { at: string; correct: boolean; mode: SessionMode }[];
}

export type FontScale = 'normal' | 'large' | 'xlarge';

export interface AppSettings {
  fontScale: FontScale;
}
