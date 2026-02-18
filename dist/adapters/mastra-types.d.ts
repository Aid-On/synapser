/**
 * SynapseR - Mastra Adapter Types
 *
 * Mastra/AI SDK adapter type definitions
 */
import type { SynapseOptions } from "../types";
export interface MastraAdapterOptions extends SynapseOptions {
    /** LLM API Key (OpenAI, Anthropic, Groq, etc.) */
    apiKey: string;
    /** Model ID */
    model?: string;
    /** Locale */
    locale?: "ja" | "en";
}
export interface MastraAgent {
    stream: (messages: Array<{
        role: string;
        content: string;
    }>, options?: Record<string, unknown>) => Promise<{
        fullStream: AsyncIterable<MastraStreamChunk>;
        text: Promise<string>;
    }>;
    generate: (messages: Array<{
        role: string;
        content: string;
    }>, options?: Record<string, unknown>) => Promise<{
        text: string;
        toolCalls?: Array<{
            toolCallId: string;
            toolName: string;
            args: Record<string, unknown>;
        }>;
    }>;
}
/** Mastra Agent stream chunk types */
export interface MastraStreamChunk {
    type: string;
    payload?: unknown;
}
/** Text delta payload from Mastra stream */
export interface TextDeltaPayload {
    id: string;
    text: string;
    providerMetadata?: Record<string, unknown>;
}
/** Tool call payload from Mastra stream */
export interface ToolCallPayload {
    toolCallId: string;
    toolName: string;
    args?: Record<string, unknown>;
    providerExecuted?: boolean;
    providerMetadata?: Record<string, unknown>;
    output?: unknown;
    dynamic?: boolean;
}
/** Tool result payload from Mastra stream */
export interface ToolResultPayload {
    toolCallId: string;
    toolName: string;
    result: unknown;
    isError?: boolean;
    providerExecuted?: boolean;
    providerMetadata?: Record<string, unknown>;
    args?: Record<string, unknown>;
    dynamic?: boolean;
}
/** Tool call info */
export interface ToolCall {
    toolCallId: string;
    toolName: string;
    args: Record<string, unknown>;
}
/** Tool result info */
export interface ToolResult {
    toolCallId: string;
    toolName: string;
    result: unknown;
    isError?: boolean;
}
/** Result from streaming Mastra Agent */
export interface MastraStreamResult {
    /** Full response text */
    text: string;
    /** Tool calls made during streaming */
    toolCalls: ToolCall[];
    /** Tool results received */
    toolResults: ToolResult[];
    /** Duration in ms */
    durationMs: number;
}
/** Options for streamMastraAgent */
export interface StreamMastraAgentOptions {
    /** Model name for SSE chunks */
    model?: string;
}
//# sourceMappingURL=mastra-types.d.ts.map