import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  SSEWriter,
  createSSEStream,
} from "./sse";
import type { Artifact } from "../types";

// =============================================================================
// Mock Controller
// =============================================================================

function createMockController() {
  const chunks: Uint8Array[] = [];
  return {
    enqueue: vi.fn((chunk: Uint8Array) => chunks.push(chunk)),
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
// SSEWriter Tests
// =============================================================================

describe("SSEWriter", () => {
  let controller: ReturnType<typeof createMockController>;
  let writer: SSEWriter;

  beforeEach(() => {
    controller = createMockController();
    writer = new SSEWriter(controller as unknown as ReadableStreamDefaultController<Uint8Array>);
  });

  describe("send", () => {
    it("should send data in SSE format", () => {
      writer.send("hello");

      expect(controller.getOutput()).toBe("data: hello\n\n");
    });

    it("should send multiple messages", () => {
      writer.send("first");
      writer.send("second");

      expect(controller.getOutput()).toBe("data: first\n\ndata: second\n\n");
    });
  });

  describe("sendJson", () => {
    it("should send JSON stringified data", () => {
      writer.sendJson({ type: "test", value: 123 });

      expect(controller.getOutput()).toBe(
        'data: {"type":"test","value":123}\n\n'
      );
    });
  });

  describe("sendStatus", () => {
    it("should send status message", () => {
      writer.sendStatus("generating");

      const output = JSON.parse(
        controller.getOutput().replace("data: ", "").trim()
      );
      expect(output.type).toBe("status");
      expect(output.status).toBe("generating");
    });

    it("should include extra fields", () => {
      writer.sendStatus("fetching", { tool: "weather" });

      const output = JSON.parse(
        controller.getOutput().replace("data: ", "").trim()
      );
      expect(output.status).toBe("fetching");
      expect(output.tool).toBe("weather");
    });
  });

  describe("sendArtifact", () => {
    it("should send artifact", () => {
      const artifact = { type: "weather", location: "Tokyo" } as unknown as Artifact;
      writer.sendArtifact(artifact);

      const output = JSON.parse(
        controller.getOutput().replace("data: ", "").trim()
      );
      expect(output.type).toBe("artifact");
      expect(output.artifact.type).toBe("weather");
    });
  });

  describe("sendToolCall", () => {
    it("should send tool call info", () => {
      writer.sendToolCall("call-123", "get_weather", { location: "Tokyo" });

      const output = JSON.parse(
        controller.getOutput().replace("data: ", "").trim()
      );
      expect(output.type).toBe("tool-call");
      expect(output.toolCallId).toBe("call-123");
      expect(output.toolName).toBe("get_weather");
      expect(output.args).toEqual({ location: "Tokyo" });
    });
  });

  describe("sendToolResult", () => {
    it("should send tool result", () => {
      writer.sendToolResult("call-123", "get_weather", { temp: 25 });

      const output = JSON.parse(
        controller.getOutput().replace("data: ", "").trim()
      );
      expect(output.type).toBe("tool-result");
      expect(output.toolCallId).toBe("call-123");
      expect(output.result).toEqual({ temp: 25 });
    });
  });

  describe("sendText", () => {
    it("should send text in OpenAI-compatible chunk format", () => {
      writer.sendText("Hello", "chunk-1", "gpt-4");

      const output = JSON.parse(
        controller.getOutput().replace("data: ", "").trim()
      );
      expect(output.id).toBe("chunk-1");
      expect(output.object).toBe("chat.completion.chunk");
      expect(output.model).toBe("gpt-4");
      expect(output.choices[0].delta.content).toBe("Hello");
    });

    it("should generate default chunk id and model", () => {
      writer.sendText("Test");

      const output = JSON.parse(
        controller.getOutput().replace("data: ", "").trim()
      );
      expect(output.id).toMatch(/^chunk-/);
      expect(output.model).toBe("unknown");
    });
  });

  describe("bufferText and flush", () => {
    it("should buffer text without sending immediately", () => {
      writer.bufferText("buffered");

      expect(controller.enqueue).not.toHaveBeenCalled();
    });

    it("should flush buffer on demand", () => {
      writer.bufferText("chunk1");
      writer.bufferText("chunk2");

      expect(controller.enqueue).not.toHaveBeenCalled();

      writer.flush();

      expect(controller.enqueue).toHaveBeenCalled();
      const output = controller.getOutput();
      expect(output).toContain("chunk1");
      expect(output).toContain("chunk2");
    });

    it("should not flush empty buffer", () => {
      writer.flush();

      expect(controller.enqueue).not.toHaveBeenCalled();
    });
  });

  describe("flushIfNeeded", () => {
    it("should not flush if interval not passed", () => {
      const writer = new SSEWriter(controller as unknown as ReadableStreamDefaultController<Uint8Array>, { flushInterval: 1000 });

      writer.bufferText("test");
      const flushed = writer.flushIfNeeded();

      expect(flushed).toBe(false);
    });

    it("should flush after interval", async () => {
      const writer = new SSEWriter(controller as unknown as ReadableStreamDefaultController<Uint8Array>, { flushInterval: 10 });

      writer.bufferText("test");
      await new Promise((resolve) => setTimeout(resolve, 20));
      const flushed = writer.flushIfNeeded();

      expect(flushed).toBe(true);
    });
  });

  describe("sendError", () => {
    it("should send error message", () => {
      writer.sendError("Something went wrong");

      const output = JSON.parse(
        controller.getOutput().replace("data: ", "").trim()
      );
      expect(output.type).toBe("error");
      expect(output.error).toBe("Something went wrong");
    });
  });

  describe("done", () => {
    it("should flush buffer and send done signal", () => {
      writer.bufferText("remaining");
      writer.done();

      const output = controller.getOutput();
      expect(output).toContain("remaining");
      expect(output).toContain("data: [DONE]");
    });
  });
});

// =============================================================================
// createSSEStream Tests
// =============================================================================

describe("createSSEStream", () => {
  it("should create a readable stream and writer", () => {
    const { stream, writer } = createSSEStream();

    expect(stream).toBeInstanceOf(ReadableStream);
    expect(writer).toBeDefined();
  });

  it("should allow writing through the writer", async () => {
    const { stream, writer } = createSSEStream();

    // Start reading in background
    const reader = stream.getReader();
    const readPromise = reader.read();

    // Give time for stream to initialize
    await new Promise((resolve) => setTimeout(resolve, 10));

    // Write data
    writer.send("test message");

    const { value } = await readPromise;
    const text = new TextDecoder().decode(value);

    expect(text).toBe("data: test message\n\n");

    reader.releaseLock();
  });
});

