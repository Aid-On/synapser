/**
 * SynapseR - Mastra Adapter
 *
 * Mastra/AI SDK を使用した Synapse (LLM判断) 実装
 */
import type { Stimulus, SynapseDecision, ActionDefinition } from "../types";
import type { SSEWriter } from "../reporters/sse";
import type { MastraAdapterOptions, MastraAgent, MastraStreamResult, StreamMastraAgentOptions } from "./mastra-types";
export type { MastraAdapterOptions, MastraAgent, MastraStreamChunk, TextDeltaPayload, ToolCallPayload, ToolResultPayload, ToolCall, ToolResult, MastraStreamResult, StreamMastraAgentOptions, } from "./mastra-types";
/** Mastraを使用したSynapseハンドラーを作成 */
export declare function createMastraSynapse(options: MastraAdapterOptions, agentFactory: (apiKey: string, model: string, locale: "ja" | "en") => {
    chatAgent: MastraAgent;
}): (stimulus: Stimulus) => Promise<SynapseDecision>;
/**
 * ストリーミング対応のSynapseハンドラーを作成
 */
export declare function createMastraSynapseStream(options: MastraAdapterOptions, agentFactory: (apiKey: string, model: string, locale: "ja" | "en") => {
    chatAgent: MastraAgent;
}): (stimulus: Stimulus) => AsyncGenerator<{
    type: "status" | "tool-call" | "tool-result" | "text" | "done";
    data: unknown;
}>;
/**
 * Action定義からMastraツール形式に変換
 */
export declare function actionsToMastraTools(actions: ActionDefinition[]): Record<string, unknown>;
/**
 * Stream Mastra Agent response to SSEWriter.
 * Handles text-delta, tool-call, tool-result chunks and writes them for real-time streaming.
 */
export declare function streamMastraAgent(agent: MastraAgent, messages: Array<{
    role: string;
    content: string;
}>, writer: SSEWriter, options?: StreamMastraAgentOptions): Promise<MastraStreamResult>;
//# sourceMappingURL=mastra.d.ts.map