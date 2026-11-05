// 領域型別：不依賴任何 UI 框架。對應規格 §9 資料契約。
import type { DistractorCheck, TypeCriteria } from './criteria';
export type { DistractorCheck, TypeCriteria } from './criteria';

export type ReviewStatus = 'draft' | 'reviewed' | 'published' | 'retired';
export type QuestionKind = 'chart-to-type' | 'type-to-chart' | 'chart-to-location' | 'cause';
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
  /** 結構化判讀條件（#2）：可命題類型必填 */
  criteria?: TypeCriteria;
  /** 和容易混淆類型的分辨方法（#3 總複習用） */
  compareNotes?: Record<string, string>;
  curriculumRefs: string[];
}

export interface TypeGroup {
  id: string;
  label: string;
}

/** 成因因子（#16）：成因選擇題的選項 */
export interface CauseFactor {
  id: string;
  /** 選項文字 */
  label: string;
  /** 通常造成的現象（解析用） */
  effect: string;
  /** 和此因子常同時成立、不可當作錯誤選項的因子 */
  coOccurring: string[];
}

export interface Taxonomy {
  frameworks: ClassificationFramework[];
  groups: TypeGroup[];
  types: ClimateType[];
  causeFactors?: CauseFactor[];
}

/** 測站氣候的主要成因（#15 延伸說明、#16 成因題） */
export interface StationCause {
  factorId: string;
  /** 成因題題幹，例如「這裡為什麼全年多雨？」 */
  stem: string;
  /** 成因說明 */
  text: string;
  /** 小地圖要畫的風帶、氣壓帶、洋流 ID */
  overlays: string[];
  /** 此測站也成立、不可當作錯誤選項的因子 */
  alsoTrue?: string[];
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

export interface StationLocation {
  /** 原始資料的測站名稱（英文） */
  name: string;
  /** 中文顯示名稱 */
  nameZh: string;
  lat: number;
  lon: number;
  elev: number;
  wigosId?: string;
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
  /** 測站位置（地圖與資料說明用；題目畫面不顯示） */
  location?: StationLocation;
  /** 柯本代碼與所標類型不一致時，必須寫明保留理由 */
  koppenException?: string;
  /** 主要成因（延伸內容，待依課本核對） */
  cause?: StationCause;
  regionIds?: string[];
}

export interface Explanation {
  id: string;
  temperatureEvidence: string;
  precipitationEvidence: string;
  conclusion: string;
  hints: [string, string, string];
  /** climateTypeId → 此圖為何不符該類型（總結句） */
  distractorReasons: Record<string, string>;
  /** climateTypeId → 逐項判斷（#2）：氣溫條件與降水條件是否符合 */
  distractorChecks?: Record<string, DistractorCheck>;
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
  /** 作答後才顯示；舊回合快照可能沒有 */
  location?: StationLocation;
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
  /** optionId → 逐項判斷（#2；舊回合快照可能沒有） */
  optionChecks?: Record<string, DistractorCheck & { typeLabel: string }>;
  /** 延伸說明：為什麼會這樣（#15；舊回合可能沒有） */
  cause?: { text: string; overlays: string[] };
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

export interface ChartToLocationQuestion extends QuestionBase {
  kind: 'chart-to-location';
  chart: ChartSnapshot;
  options: { id: string; letter: string; typeId: string; datasetId: string; location: StationLocation }[];
}

export interface CauseQuestion extends QuestionBase {
  kind: 'cause';
  chart: ChartSnapshot;
  stem: string;
  options: { id: string; factorId: string; label: string }[];
}

export type QuestionSnapshot = ChartToTypeQuestion | TypeToChartQuestion | ChartToLocationQuestion | CauseQuestion;

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
