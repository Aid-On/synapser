/**
 * SynapseR - Artifact Reporter
 *
 * Response → Signal (Artifact) 変換
 */
import type { Response, Signal, Artifact, WeatherArtifact, CodeArtifact, CommandArtifact } from "../types";
export type ArtifactConverter<TData = unknown, TArtifact extends Artifact = Artifact> = (data: TData, action: string) => TArtifact | null;
export interface ArtifactReporterOptions {
    /** カスタムコンバーター */
    converters?: Record<string, ArtifactConverter>;
    /** デフォルトメッセージ生成 */
    defaultMessage?: (response: Response) => string | undefined;
}
export declare const weatherConverter: ArtifactConverter<Record<string, string>, WeatherArtifact>;
export declare const codeConverter: ArtifactConverter<{
    code: string;
    language?: string;
    filename?: string;
}, CodeArtifact>;
export declare const commandConverter: ArtifactConverter<{
    command: string;
    output?: string;
    status?: string;
}, CommandArtifact>;
export declare class ArtifactReporter {
    private converters;
    private defaultMessage?;
    constructor(options?: ArtifactReporterOptions);
    /** カスタムコンバーターを登録 */
    register<TData, TArtifact extends Artifact>(action: string, converter: ArtifactConverter<TData, TArtifact>): this;
    /** ResponseをSignalに変換 */
    report<TArtifact extends Artifact = Artifact>(response: Response): Signal<TArtifact>;
}
export declare function createArtifactReporter(options?: ArtifactReporterOptions): ArtifactReporter;
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
export declare function createSignalHandler<TArtifact extends Artifact = Artifact>(options?: ArtifactReporterOptions): (response: Response) => Signal<TArtifact>;
//# sourceMappingURL=artifact.d.ts.map