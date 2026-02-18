/**
 * SynapseR - SSE Reporter
 *
 * Server-Sent Events ストリーミング出力
 */
import type { Signal, Artifact } from "../types";
export interface SSEOptions {
    /** フラッシュ間隔 (ms) */
    flushInterval?: number;
}
export interface SSEChunk {
    type: "status" | "artifact" | "tool-call" | "tool-result" | "text" | "error" | "done";
    data: unknown;
}
export declare class SSEWriter {
    private controller;
    private encoder;
    private buffer;
    private lastFlush;
    private flushInterval;
    constructor(controller: ReadableStreamDefaultController<Uint8Array>, options?: SSEOptions);
    /** Send data immediately */
    send(data: string): void;
    /** Send JSON data */
    sendJson(data: unknown): void;
    /** Send status update */
    sendStatus(status: string, extra?: Record<string, unknown>): void;
    /** Send artifact */
    sendArtifact(artifact: Artifact): void;
    /** Send tool call */
    sendToolCall(toolCallId: string, toolName: string, args: Record<string, unknown>): void;
    /** Send tool result */
    sendToolResult(toolCallId: string, toolName: string, result: unknown): void;
    /** Send text chunk (for streaming) */
    sendText(text: string, chunkId?: string, model?: string): void;
    /** Buffer text chunk (for throttled sending) */
    bufferText(text: string, chunkId?: string, model?: string): void;
    /** Flush buffer if interval has passed */
    flushIfNeeded(): boolean;
    /** Force flush remaining buffer */
    flush(): void;
    /** Send error */
    sendError(error: string): void;
    /** Send done signal */
    done(): void;
}
export interface SSEStreamResult {
    stream: ReadableStream<Uint8Array>;
    writer: SSEWriter;
}
/**
 * SSEストリームを作成
 *
 * @example
 * ```typescript
 * const { stream, writer } = createSSEStream();
 *
 * writer.sendStatus("generating");
 * writer.sendArtifact(weatherArtifact);
 * writer.sendText("Here's the weather...");
 * writer.done();
 *
 * return new Response(stream, {
 *   headers: { "Content-Type": "text/event-stream" }
 * });
 * ```
 */
export declare function createSSEStream(options?: SSEOptions): SSEStreamResult;
/**
 * Signalをストリーミングで送信
 */
export declare function streamSignal(writer: SSEWriter, signal: Signal, options?: {
    model?: string;
    chunkId?: string;
}): Promise<void>;
export declare const SSE_HEADERS: {
    readonly "Content-Type": "text/event-stream";
    readonly "Cache-Control": "no-cache";
    readonly Connection: "keep-alive";
};
/**
 * SSE Response を作成
 */
export declare function createSSEResponse(stream: ReadableStream<Uint8Array>, extraHeaders?: Record<string, string>): Response;
//# sourceMappingURL=sse.d.ts.map