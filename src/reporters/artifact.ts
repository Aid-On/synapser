/**
 * SynapseR - Artifact Reporter
 *
 * Response → Signal (Artifact) 変換
 */

import type { Response, Signal, Artifact, WeatherArtifact, CodeArtifact, CommandArtifact } from "../types";

// =============================================================================
// Types
// =============================================================================

export type ArtifactConverter<TData = unknown, TArtifact extends Artifact = Artifact> = (
  data: TData,
  action: string
) => TArtifact | null;

export interface ArtifactReporterOptions {
  /** カスタムコンバーター */
  converters?: Record<string, ArtifactConverter>;
  /** デフォルトメッセージ生成 */
  defaultMessage?: (response: Response) => string | undefined;
}

// =============================================================================
// Built-in Converters
// =============================================================================

function formatWind(data: Record<string, string>): string {
  if (!data.wind_speed_kmh) return "N/A";
  return `${data.wind_speed_kmh} km/h ${data.wind_direction || ""}`.trim();
}

export const weatherConverter: ArtifactConverter<Record<string, string>, WeatherArtifact> = (data) => {
  if (!data.location || !data.temperature_c) return null;

  const descriptionText = data.description || data.condition || "Unknown";

  return {
    type: "weather",
    location: data.location,
    country: data.country,
    temperature: data.temperature_c,
    feels_like: data.feels_like_c || data.temperature_c,
    description: descriptionText,
    humidity: data.humidity || "N/A",
    wind: formatWind(data),
    icon: mapWeatherIcon(descriptionText),
  };
};

export const codeConverter: ArtifactConverter<{ code: string; language?: string; filename?: string }, CodeArtifact> = (data) => {
  if (!data.code) return null;

  return {
    type: "code",
    code: data.code,
    language: data.language || "plaintext",
    filename: data.filename,
  };
};

export const commandConverter: ArtifactConverter<{ command: string; output?: string; status?: string }, CommandArtifact> = (data) => {
  if (!data.command) return null;

  return {
    type: "command",
    command: data.command,
    output: data.output,
    status: (data.status as CommandArtifact["status"]) || "success",
  };
};

// =============================================================================
// Artifact Reporter
// =============================================================================

export class ArtifactReporter {
  private converters: Map<string, ArtifactConverter>;
  private defaultMessage?: (response: Response) => string | undefined;

  constructor(options: ArtifactReporterOptions = {}) {
    this.converters = new Map(Object.entries(options.converters || {}));
    this.defaultMessage = options.defaultMessage;

    // Register built-in converters
    if (!this.converters.has("get_weather")) {
      this.converters.set("get_weather", weatherConverter as ArtifactConverter);
    }
    if (!this.converters.has("execute_code")) {
      this.converters.set("execute_code", codeConverter as ArtifactConverter);
    }
    if (!this.converters.has("run_command")) {
      this.converters.set("run_command", commandConverter as ArtifactConverter);
    }
  }

  /** カスタムコンバーターを登録 */
  register<TData, TArtifact extends Artifact>(
    action: string,
    converter: ArtifactConverter<TData, TArtifact>
  ): this {
    this.converters.set(action, converter as ArtifactConverter);
    return this;
  }

  /** ResponseをSignalに変換 */
  report<TArtifact extends Artifact = Artifact>(response: Response): Signal<TArtifact> {
    // Error case
    if (!response.success) {
      return {
        message: response.error?.message || "Action failed",
        meta: { error: response.error },
      };
    }

    // Try to convert to artifact
    const converter = this.converters.get(response.action);
    let artifact: TArtifact | null = null;

    if (converter && response.data) {
      artifact = converter(response.data, response.action) as TArtifact | null;
    }

    // Build signal
    return {
      artifact: artifact || undefined,
      message: this.defaultMessage?.(response),
      meta: {
        action: response.action,
        duration_ms: response.duration_ms,
      },
    };
  }
}

export function createArtifactReporter(options?: ArtifactReporterOptions): ArtifactReporter {
  return new ArtifactReporter(options);
}

// =============================================================================
// Helpers
// =============================================================================

const WEATHER_ICON_PATTERNS: ReadonlyArray<[readonly string[], string]> = [
  [["sun", "clear"], "sunny"],
  [["partly"], "partly-cloudy"],
  [["cloud", "overcast"], "cloudy"],
  [["rain", "drizzle"], "rain"],
  [["storm", "thunder"], "storm"],
  [["snow"], "snow"],
  [["fog", "mist"], "fog"],
];

function mapWeatherIcon(description: string): string {
  const desc = description.toLowerCase();
  const match = WEATHER_ICON_PATTERNS.find(([keywords]) =>
    keywords.some((kw) => desc.includes(kw))
  );
  return match ? match[1] : "partly-cloudy";
}

// =============================================================================
// Signal Handler Factory
// =============================================================================

/**
 * ArtifactReporterを使用したSignalハンドラーを作成
 *
 * @example
 * ```typescript
 * const signalHandler = createSignalHandler({
 *   converters: {
 *     "minecraft_build": (data) => ({
 *       type: "minecraft",
 *       action: "build",
 *       result: data
 *     })
 *   }
 * });
 * ```
 */
export function createSignalHandler<TArtifact extends Artifact = Artifact>(
  options?: ArtifactReporterOptions
): (response: Response) => Signal<TArtifact> {
  const reporter = createArtifactReporter(options);
  return (response) => reporter.report<TArtifact>(response);
}
