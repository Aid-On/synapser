/**
 * SynapseR - Artifact Reporter
 *
 * Response → Signal (Artifact) 変換
 */
// =============================================================================
// Built-in Converters
// =============================================================================
function formatWind(data) {
    if (!data.wind_speed_kmh)
        return "N/A";
    return `${data.wind_speed_kmh} km/h ${data.wind_direction || ""}`.trim();
}
export const weatherConverter = (data) => {
    if (!data.location || !data.temperature_c)
        return null;
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
export const codeConverter = (data) => {
    if (!data.code)
        return null;
    return {
        type: "code",
        code: data.code,
        language: data.language || "plaintext",
        filename: data.filename,
    };
};
export const commandConverter = (data) => {
    if (!data.command)
        return null;
    return {
        type: "command",
        command: data.command,
        output: data.output,
        status: data.status || "success",
    };
};
// =============================================================================
// Artifact Reporter
// =============================================================================
export class ArtifactReporter {
    converters;
    defaultMessage;
    constructor(options = {}) {
        this.converters = new Map(Object.entries(options.converters || {}));
        this.defaultMessage = options.defaultMessage;
        // Register built-in converters
        if (!this.converters.has("get_weather")) {
            this.converters.set("get_weather", weatherConverter);
        }
        if (!this.converters.has("execute_code")) {
            this.converters.set("execute_code", codeConverter);
        }
        if (!this.converters.has("run_command")) {
            this.converters.set("run_command", commandConverter);
        }
    }
    /** カスタムコンバーターを登録 */
    register(action, converter) {
        this.converters.set(action, converter);
        return this;
    }
    /** ResponseをSignalに変換 */
    report(response) {
        // Error case
        if (!response.success) {
            return {
                message: response.error?.message || "Action failed",
                meta: { error: response.error },
            };
        }
        // Try to convert to artifact
        const converter = this.converters.get(response.action);
        let artifact = null;
        if (converter && response.data) {
            artifact = converter(response.data, response.action);
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
export function createArtifactReporter(options) {
    return new ArtifactReporter(options);
}
// =============================================================================
// Helpers
// =============================================================================
const WEATHER_ICON_PATTERNS = [
    [["sun", "clear"], "sunny"],
    [["partly"], "partly-cloudy"],
    [["cloud", "overcast"], "cloudy"],
    [["rain", "drizzle"], "rain"],
    [["storm", "thunder"], "storm"],
    [["snow"], "snow"],
    [["fog", "mist"], "fog"],
];
function mapWeatherIcon(description) {
    const desc = description.toLowerCase();
    const match = WEATHER_ICON_PATTERNS.find(([keywords]) => keywords.some((kw) => desc.includes(kw)));
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
export function createSignalHandler(options) {
    const reporter = createArtifactReporter(options);
    return (response) => reporter.report(response);
}
//# sourceMappingURL=artifact.js.map