/**
 * SynapseR - SSE Reporter
 *
 * Server-Sent Events ストリーミング出力
 */

import type { Signal, Artifact, SignalChunk } from "../types";

// =============================================================================
// Types
// =============================================================================

export interface SSEOptions {
  /** フラッシュ間隔 (ms) */
  flushInterval?: number;
}

export interface SSEChunk {
  type: "status" | "artifact" | "tool-call" | "tool-result" | "text" | "error" | "done";
  data: unknown;
}

// =============================================================================
// SSE Writer
// =============================================================================

export class SSEWriter {
  private encoder = new TextEncoder();
  private buffer = "";
  private lastFlush = Date.now();
  private flushInterval: number;

  constructor(
    private controller: ReadableStreamDefaultController<Uint8Array>,
    options: SSEOptions = {}
  ) {
    this.flushInterval = options.flushInterval ?? 16;
  }

  /** Send data immediately */
  send(data: string): void {
    this.controller.enqueue(this.encoder.encode(`data: ${data}\n\n`));
  }

  /** Send JSON data */
  sendJson(data: unknown): void {
    this.send(JSON.stringify(data));
  }

  /** Send status update */
  sendStatus(status: string, extra?: Record<string, unknown>): void {
    this.sendJson({ type: "status", status, ...extra });
  }

  /** Send artifact */
  sendArtifact(artifact: Artifact): void {
    this.sendJson({ type: "artifact", artifact });
  }

  /** Send tool call */
  sendToolCall(toolCallId: string, toolName: string, args: Record<string, unknown>): void {
    this.sendJson({ type: "tool-call", toolCallId, toolName, args });
  }

  /** Send tool result */
  sendToolResult(toolCallId: string, toolName: string, result: unknown): void {
    this.sendJson({ type: "tool-result", toolCallId, toolName, result });
  }

  /** Send text chunk (for streaming) */
  sendText(text: string, chunkId?: string, model?: string): void {
    const chunk = {
      id: chunkId || `chunk-${Date.now()}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: model || "unknown",
      choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
    };
    this.send(JSON.stringify(chunk));
  }

  /** Buffer text chunk (for throttled sending) */
  bufferText(text: string, chunkId?: string, model?: string): void {
    const chunk = {
      id: chunkId || `chunk-${Date.now()}`,
      object: "chat.completion.chunk",
      created: Math.floor(Date.now() / 1000),
      model: model || "unknown",
      choices: [{ index: 0, delta: { content: text }, finish_reason: null }],
    };
    this.buffer += `data: ${JSON.stringify(chunk)}\n\n`;
  }

  /** Flush buffer if interval has passed */
  flushIfNeeded(): boolean {
    const now = Date.now();
    if (now - this.lastFlush >= this.flushInterval && this.buffer) {
      this.controller.enqueue(this.encoder.encode(this.buffer));
      this.buffer = "";
      this.lastFlush = now;
      return true;
    }
    return false;
  }

  /** Force flush remaining buffer */
  flush(): void {
    if (this.buffer) {
      this.controller.enqueue(this.encoder.encode(this.buffer));
      this.buffer = "";
    }
  }

  /** Send error */
  sendError(error: string): void {
    this.sendJson({ type: "error", error });
  }

  /** Send done signal */
  done(): void {
    this.flush();
    this.send("[DONE]");
  }
}

// =============================================================================
// SSE Stream Factory
// =============================================================================

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
export function createSSEStream(options?: SSEOptions): SSEStreamResult {
  let writer: SSEWriter;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      writer = new SSEWriter(controller, options);
    },
  });

  return {
    stream,
    get writer() {
      return writer;
    },
  };
}

// =============================================================================
// Signal to SSE Converter
// =============================================================================

function writeSignalChunk(
  writer: SSEWriter,
  chunk: SignalChunk,
  chunkId?: string,
  model?: string
): void {
  switch (chunk.type) {
    case "text":
      writer.sendText(String(chunk.data), chunkId, model);
      break;
    case "artifact":
      writer.sendArtifact(chunk.data as Artifact);
      break;
    case "status":
      writer.sendJson({ type: "status", ...(chunk.data as Record<string, unknown>) });
      break;
    case "error":
      writer.sendError(String(chunk.data));
      break;
  }
}

/**
 * Signalをストリーミングで送信
 */
export async function streamSignal(
  writer: SSEWriter,
  signal: Signal,
  options?: { model?: string; chunkId?: string }
): Promise<void> {
  const { model, chunkId } = options || {};

  if (signal.artifact) {
    writer.sendArtifact(signal.artifact as Artifact);
  }

  if (signal.message) {
    writer.sendText(signal.message, chunkId, model);
  }

  if (signal.stream) {
    for await (const chunk of signal.stream) {
      writeSignalChunk(writer, chunk, chunkId, model);
    }
  }

  if (signal.events) {
    for (const event of signal.events) {
      writer.sendJson({ type: "event", event });
    }
  }
}

// =============================================================================
// Response Headers
// =============================================================================

export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;

/**
 * SSE Response を作成
 */
export function createSSEResponse(
  stream: ReadableStream<Uint8Array>,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(stream, {
    headers: {
      ...SSE_HEADERS,
      ...extraHeaders,
    },
  });
}
