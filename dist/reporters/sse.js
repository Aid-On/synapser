/**
 * SynapseR - SSE Reporter
 *
 * Server-Sent Events ストリーミング出力
 */
// =============================================================================
// SSE Writer
// =============================================================================
export class SSEWriter {
    controller;
    encoder = new TextEncoder();
    buffer = "";
    lastFlush = Date.now();
    flushInterval;
    constructor(controller, options = {}) {
        this.controller = controller;
        this.flushInterval = options.flushInterval ?? 16;
    }
    /** Send data immediately */
    send(data) {
        this.controller.enqueue(this.encoder.encode(`data: ${data}\n\n`));
    }
    /** Send JSON data */
    sendJson(data) {
        this.send(JSON.stringify(data));
    }
    /** Send status update */
    sendStatus(status, extra) {
        this.sendJson({ type: "status", status, ...extra });
    }
    /** Send artifact */
    sendArtifact(artifact) {
        this.sendJson({ type: "artifact", artifact });
    }
    /** Send tool call */
    sendToolCall(toolCallId, toolName, args) {
        this.sendJson({ type: "tool-call", toolCallId, toolName, args });
    }
    /** Send tool result */
    sendToolResult(toolCallId, toolName, result) {
        this.sendJson({ type: "tool-result", toolCallId, toolName, result });
    }
    /** Send text chunk (for streaming) */
    sendText(text, chunkId, model) {
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
    bufferText(text, chunkId, model) {
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
    flushIfNeeded() {
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
    flush() {
        if (this.buffer) {
            this.controller.enqueue(this.encoder.encode(this.buffer));
            this.buffer = "";
        }
    }
    /** Send error */
    sendError(error) {
        this.sendJson({ type: "error", error });
    }
    /** Send done signal */
    done() {
        this.flush();
        this.send("[DONE]");
    }
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
export function createSSEStream(options) {
    let writer;
    const stream = new ReadableStream({
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
function writeSignalChunk(writer, chunk, chunkId, model) {
    switch (chunk.type) {
        case "text":
            writer.sendText(String(chunk.data), chunkId, model);
            break;
        case "artifact":
            writer.sendArtifact(chunk.data);
            break;
        case "status":
            writer.sendJson({ type: "status", ...chunk.data });
            break;
        case "error":
            writer.sendError(String(chunk.data));
            break;
    }
}
/**
 * Signalをストリーミングで送信
 */
export async function streamSignal(writer, signal, options) {
    const { model, chunkId } = options || {};
    if (signal.artifact) {
        writer.sendArtifact(signal.artifact);
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
};
/**
 * SSE Response を作成
 */
export function createSSEResponse(stream, extraHeaders) {
    return new Response(stream, {
        headers: {
            ...SSE_HEADERS,
            ...extraHeaders,
        },
    });
}
//# sourceMappingURL=sse.js.map