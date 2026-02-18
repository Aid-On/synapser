/**
 * SynapseR - Neural Signal Processing for LLM Agents
 *
 * 神経伝達モデルに基づくLLMエージェント処理フロー
 *
 * ⚡ Stimulus → 🧬 Synapse → 💪 Response → 📡 Signal
 */

// =============================================================================
// Stimulus (刺激) - 処理のトリガー
// =============================================================================

/** Built-in stimulus types */
export type BuiltinStimulusType = "chat" | "webhook" | "cron" | "event" | "sensor";

/** Extensible stimulus type - use string for custom types */
export type StimulusType = BuiltinStimulusType | (string & {});

export interface Stimulus<TInput = unknown> {
  /** 刺激の種類 */
  type: StimulusType;
  /** 入力データ */
  input: TInput;
  /** コンテキスト情報 */
  context?: StimulusContext;
  /** タイムスタンプ */
  timestamp: number;
  /** 一意識別子 */
  id: string;
}

export interface StimulusContext {
  /** ユーザー情報 */
  user?: {
    id: string;
    name?: string;
    [key: string]: unknown;
  };
  /** セッション情報 */
  session?: {
    id: string;
    history?: Array<{ role: string; content: string }>;
    [key: string]: unknown;
  };
  /** 環境情報 */
  environment?: Record<string, unknown>;
  /** カスタムデータ */
  [key: string]: unknown;
}

// =============================================================================
// Synapse (シナプス) - LLMによる判断
// =============================================================================

export interface SynapseDecision {
  /** 実行するアクション名 */
  action: string;
  /** アクションのパラメータ */
  params: Record<string, unknown>;
  /** 信頼度 (0-1) */
  confidence?: number;
  /** 判断の理由 (デバッグ用) */
  reasoning?: string;
  /** アクション不要の場合 */
  noAction?: boolean;
  /** 生のLLM出力 */
  raw?: unknown;
}

export interface SynapseOptions {
  /** 使用するモデル */
  model?: string;
  /** システムプロンプト */
  systemPrompt?: string;
  /** 利用可能なアクション定義 */
  actions?: ActionDefinition[];
  /** タイムアウト (ms) */
  timeout?: number;
  /** 最大リトライ回数 */
  maxRetries?: number;
}

export interface ActionDefinition {
  /** アクション名 */
  name: string;
  /** 説明 */
  description: string;
  /** パラメータスキーマ */
  parameters?: Record<string, ParameterSchema>;
}

export interface ParameterSchema {
  type: "string" | "number" | "boolean" | "object" | "array";
  description?: string;
  required?: boolean;
  default?: unknown;
}

// =============================================================================
// Response (反応) - アクション実行結果
// =============================================================================

export interface Response<TData = unknown> {
  /** 成功/失敗 */
  success: boolean;
  /** 結果データ */
  data?: TData;
  /** エラー情報 */
  error?: ResponseError;
  /** 実行時間 (ms) */
  duration_ms: number;
  /** アクション名 */
  action: string;
  /** メタデータ */
  meta?: Record<string, unknown>;
}

export interface ResponseError {
  code: string;
  message: string;
  details?: unknown;
}

// =============================================================================
// Signal (信号) - 出力
// =============================================================================

export interface Signal<TArtifact = unknown> {
  /** Artifact (UI表示用の構造化データ) */
  artifact?: TArtifact;
  /** テキストメッセージ */
  message?: string;
  /** 後続イベント */
  events?: SignalEvent[];
  /** ストリーミングチャンク */
  stream?: AsyncIterable<SignalChunk>;
  /** メタデータ */
  meta?: Record<string, unknown>;
}

export interface SignalEvent {
  type: string;
  payload: unknown;
  delay?: number;
}

export interface SignalChunk {
  type: "text" | "artifact" | "status" | "error" | "done";
  data: unknown;
}

// =============================================================================
// Synapse Flow (フロー全体)
// =============================================================================

export interface SynapseFlow<
  TInput = unknown,
  TData = unknown,
  TArtifact = unknown
> {
  /** Stimulus生成 */
  stimulus: StimulusHandler<TInput>;
  /** Synapse処理 (LLM判断) */
  synapse: SynapseHandler;
  /** Response処理 (アクション実行) */
  response: ResponseHandler<TData>;
  /** Signal生成 (出力変換) */
  signal: SignalHandler<TData, TArtifact>;
}

export type StimulusHandler<TInput> = (input: TInput) => Stimulus<TInput> | Promise<Stimulus<TInput>>;
export type SynapseHandler = (stimulus: Stimulus) => Promise<SynapseDecision>;
export type ResponseHandler<TData> = (decision: SynapseDecision) => Promise<Response<TData>>;
export type SignalHandler<TData, TArtifact> = (response: Response<TData>) => Signal<TArtifact> | Promise<Signal<TArtifact>>;

// =============================================================================
// Flow Runner Options
// =============================================================================

export interface FlowRunnerOptions {
  /** エラー時のハンドラー */
  onError?: (error: Error, phase: "stimulus" | "synapse" | "response" | "signal") => void;
  /** 各フェーズ完了時のフック */
  onPhaseComplete?: (phase: string, result: unknown) => void;
  /** タイムアウト (ms) */
  timeout?: number;
  /** デバッグモード */
  debug?: boolean;
}

// =============================================================================
// Artifact Types (Extensible)
// =============================================================================

/**
 * Base artifact interface - extend this for custom artifacts
 *
 * @example
 * ```typescript
 * interface MinecraftArtifact extends BaseArtifact {
 *   type: "minecraft";
 *   action: "build" | "destroy" | "teleport";
 *   coordinates?: [number, number, number];
 *   result: string;
 * }
 * ```
 */
export interface BaseArtifact {
  type: string;
  cached?: boolean;
}

/** Custom artifact - any object with a type field */
export type CustomArtifact<T extends string = string> = BaseArtifact & {
  type: T;
  [key: string]: unknown;
};

// -----------------------------------------------------------------------------
// Built-in Artifacts (examples, not required to use)
// -----------------------------------------------------------------------------

export interface WeatherArtifact extends BaseArtifact {
  type: "weather";
  location: string;
  country?: string;
  temperature: string;
  feels_like: string;
  description: string;
  humidity: string;
  wind: string;
  icon: string;
}

export interface CodeArtifact extends BaseArtifact {
  type: "code";
  language: string;
  code: string;
  filename?: string;
}

export interface CommandArtifact extends BaseArtifact {
  type: "command";
  command: string;
  output?: string;
  status: "pending" | "running" | "success" | "error";
}

/**
 * Built-in artifact union - for convenience
 * Use CustomArtifact<T> or your own interface for custom types
 */
export type BuiltinArtifact =
  | WeatherArtifact
  | CodeArtifact
  | CommandArtifact;

/**
 * Any artifact - built-in or custom
 * Flows are generic over TArtifact, so you can use your own types
 */
export type Artifact = BuiltinArtifact | CustomArtifact;
