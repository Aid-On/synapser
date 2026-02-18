import { describe, it, expect, vi, beforeEach } from "vitest";
import { SSEWriter, streamSignal, SSE_HEADERS, createSSEResponse, } from "./sse";
// =============================================================================
// Mock Controller
// =============================================================================
function createMockController() {
    const chunks = [];
    return {
        enqueue: vi.fn((chunk) => chunks.push(chunk)),
        close: vi.fn(),
        error: vi.fn(),
        chunks,
        getOutput: () => {
            const decoder = new TextDecoder();
            return chunks.map((c) => decoder.decode(c)).join("");
        },
    };
}
// =============================================================================
// streamSignal Tests
// =============================================================================
describe("streamSignal", () => {
    let controller;
    let writer;
    beforeEach(() => {
        controller = createMockController();
        writer = new SSEWriter(controller);
    });
    it("should stream artifact if present", async () => {
        const signal = {
            artifact: { type: "weather", location: "Tokyo" },
        };
        await streamSignal(writer, signal);
        const output = controller.getOutput();
        expect(output).toContain('"type":"artifact"');
        expect(output).toContain('"weather"');
    });
    it("should stream message as text", async () => {
        const signal = {
            message: "Here is the weather information",
        };
        await streamSignal(writer, signal);
        const output = controller.getOutput();
        expect(output).toContain("Here is the weather information");
    });
    it("should stream both artifact and message", async () => {
        const signal = {
            artifact: { type: "weather" },
            message: "Weather loaded",
        };
        await streamSignal(writer, signal);
        const output = controller.getOutput();
        expect(output).toContain("artifact");
        expect(output).toContain("Weather loaded");
    });
    it("should process async stream chunks", async () => {
        async function* createChunks() {
            yield { type: "text", data: "Hello " };
            yield { type: "text", data: "World" };
            yield { type: "artifact", data: { type: "test" } };
        }
        const signal = {
            stream: createChunks(),
        };
        await streamSignal(writer, signal);
        const output = controller.getOutput();
        expect(output).toContain("Hello ");
        expect(output).toContain("World");
        expect(output).toContain("artifact");
    });
    it("should handle status chunks in stream", async () => {
        async function* createChunks() {
            yield { type: "status", data: { status: "processing" } };
        }
        const signal = { stream: createChunks() };
        await streamSignal(writer, signal);
        const output = controller.getOutput();
        expect(output).toContain("status");
        expect(output).toContain("processing");
    });
    it("should handle error chunks in stream", async () => {
        async function* createChunks() {
            yield { type: "error", data: "Something failed" };
        }
        const signal = { stream: createChunks() };
        await streamSignal(writer, signal);
        const output = controller.getOutput();
        expect(output).toContain("error");
        expect(output).toContain("Something failed");
    });
    it("should fire events if present", async () => {
        const signal = {
            events: [
                { type: "update", payload: { key: "value" } },
                { type: "notify", payload: "done" },
            ],
        };
        await streamSignal(writer, signal);
        const output = controller.getOutput();
        expect(output).toContain('"type":"event"');
        expect(output).toContain("update");
        expect(output).toContain("notify");
    });
    it("should pass model and chunkId options", async () => {
        const signal = { message: "test" };
        await streamSignal(writer, signal, {
            model: "gpt-4-turbo",
            chunkId: "custom-id",
        });
        const output = controller.getOutput();
        expect(output).toContain("gpt-4-turbo");
        expect(output).toContain("custom-id");
    });
});
// =============================================================================
// SSE_HEADERS Tests
// =============================================================================
describe("SSE_HEADERS", () => {
    it("should have correct content type", () => {
        expect(SSE_HEADERS["Content-Type"]).toBe("text/event-stream");
    });
    it("should have no-cache directive", () => {
        expect(SSE_HEADERS["Cache-Control"]).toBe("no-cache");
    });
    it("should have keep-alive connection", () => {
        expect(SSE_HEADERS.Connection).toBe("keep-alive");
    });
});
// =============================================================================
// createSSEResponse Tests
// =============================================================================
describe("createSSEResponse", () => {
    it("should create a Response with SSE headers", () => {
        const stream = new ReadableStream();
        const response = createSSEResponse(stream);
        expect(response.headers.get("Content-Type")).toBe("text/event-stream");
        expect(response.headers.get("Cache-Control")).toBe("no-cache");
    });
    it("should merge extra headers", () => {
        const stream = new ReadableStream();
        const response = createSSEResponse(stream, {
            "X-Custom-Header": "custom-value",
        });
        expect(response.headers.get("X-Custom-Header")).toBe("custom-value");
        expect(response.headers.get("Content-Type")).toBe("text/event-stream");
    });
});
//# sourceMappingURL=sse-stream-signal.test.js.map