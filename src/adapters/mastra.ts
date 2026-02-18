/**
 * SynapseR - Mastra Adapter
 *
 * Mastra/AI SDK を使用した Synapse (LLM判断) 実装
 */

import type { Stimulus, SynapseDecision, ActionDefinition } from "../types";
import type { SSEWriter } from "../reporters/sse";
import type {
  MastraAdapterOptions,
  MastraAgent,
  TextDeltaPayload,
  ToolCallPayload,
  ToolResultPayload,
  ToolCall,
  ToolResult,
  MastraStreamResult,
  StreamMastraAgentOptions,
} from "./mastra-types";

export type {
  MastraAdapterOptions,
  MastraAgent,
  MastraStreamChunk,
  TextDeltaPayload,
  ToolCallPayload,
  ToolResultPayload,
  ToolCall,
  ToolResult,
  MastraStreamResult,
  StreamMastraAgentOptions,
} from "./mastra-types";

// =============================================================================
// Mastra Synapse Handler Factory
// =============================================================================

/** Mastraを使用したSynapseハンドラーを作成 */
export function createMastraSynapse(
  options: MastraAdapterOptions,
  agentFactory: (apiKey: string, model: string, locale: "ja" | "en") => { chatAgent: MastraAgent }
) {
  const {
    apiKey,
    model = "openai/gpt-oss-120b",
    locale = "ja",
    timeout = 30000,
  } = options;

  return async (stimulus: Stimulus): Promise<SynapseDecision> => {
    const { chatAgent } = agentFactory(apiKey, model, locale);

    // Build messages from stimulus
    const messages = buildMessages(stimulus);

    // Generate with timeout
    const result = await Promise.race([
      chatAgent.generate(messages),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Synapse timeout")), timeout)
      ),
    ]);

    // Parse tool calls from result
    if (result.toolCalls && result.toolCalls.length > 0) {
      const toolCall = result.toolCalls[0];
      return {
        action: toolCall.toolName,
        params: toolCall.args,
        confidence: 1.0,
        raw: result,
      };
    }

    // No tool call - return no-action
    return {
      action: "none",
      params: {},
      noAction: true,
      reasoning: result.text,
      raw: result,
    };
  };
}

/**
 * ストリーミング対応のSynapseハンドラーを作成
 */
export function createMastraSynapseStream(
  options: MastraAdapterOptions,
  agentFactory: (apiKey: string, model: string, locale: "ja" | "en") => { chatAgent: MastraAgent }
) {
  const {
    apiKey,
    model = "openai/gpt-oss-120b",
    locale = "ja",
  } = options;

  return async function* (stimulus: Stimulus): AsyncGenerator<{
    type: "status" | "tool-call" | "tool-result" | "text" | "done";
    data: unknown;
  }> {
    const { chatAgent } = agentFactory(apiKey, model, locale);
    const messages = buildMessages(stimulus);

    yield { type: "status", data: { status: "generating" } };

    const result = await chatAgent.stream(messages);

    for await (const chunk of result.fullStream) {
      switch (chunk.type) {
        case "text-delta":
          yield { type: "text", data: (chunk.payload as { text: string })?.text };
          break;
        case "tool-call":
          yield { type: "status", data: { status: "fetching", tool: (chunk.payload as { toolName: string })?.toolName } };
          yield { type: "tool-call", data: chunk.payload };
          break;
        case "tool-result":
          yield { type: "tool-result", data: chunk.payload };
          break;
      }
    }

    yield { type: "done", data: null };
  };
}

// =============================================================================
// Helpers
// =============================================================================

function buildMessages(stimulus: Stimulus): Array<{ role: string; content: string }> {
  const messages: Array<{ role: string; content: string }> = [];

  // Add history from context if available
  if (stimulus.context?.session?.history) {
    messages.push(...stimulus.context.session.history);
  }

  // Add current input
  if (typeof stimulus.input === "string") {
    messages.push({ role: "user", content: stimulus.input });
  } else {
    messages.push({ role: "user", content: JSON.stringify(stimulus.input) });
  }

  return messages;
}

/**
 * Action定義からMastraツール形式に変換
 */
export function actionsToMastraTools(actions: ActionDefinition[]): Record<string, unknown> {
  const tools: Record<string, unknown> = {};

  for (const action of actions) {
    tools[action.name] = {
      description: action.description,
      parameters: action.parameters
        ? {
            type: "object",
            properties: Object.fromEntries(
              Object.entries(action.parameters).map(([key, schema]) => [
                key,
                {
                  type: schema.type,
                  description: schema.description,
                },
              ])
            ),
            required: Object.entries(action.parameters)
              .filter(([, schema]) => schema.required)
              .map(([key]) => key),
          }
        : undefined,
    };
  }

  return tools;
}

// =============================================================================
// Mastra Agent Streaming
// =============================================================================

interface StreamAccumulator {
  fullText: string;
  toolCalls: ToolCall[];
  toolResults: ToolResult[];
}

function handleTextDelta(
  payload: TextDeltaPayload,
  acc: StreamAccumulator,
  writer: SSEWriter,
  model: string
): void {
  if (!payload.text) return;
  acc.fullText += payload.text;
  writer.sendText(payload.text, `chunk-${Date.now()}`, model);
}

function handleToolCall(
  payload: ToolCallPayload,
  acc: StreamAccumulator,
  writer: SSEWriter
): void {
  if (!payload.toolCallId || !payload.toolName) return;
  const toolCall: ToolCall = {
    toolCallId: payload.toolCallId,
    toolName: payload.toolName,
    args: (payload.args || {}) as Record<string, unknown>,
  };
  acc.toolCalls.push(toolCall);
  writer.sendToolCall(payload.toolCallId, payload.toolName, toolCall.args);
  writer.sendStatus("fetching", { tool: payload.toolName });
}

function handleToolResult(
  payload: ToolResultPayload,
  acc: StreamAccumulator,
  writer: SSEWriter
): void {
  if (!payload.toolCallId || !payload.toolName || payload.result === undefined) return;
  const toolResult: ToolResult = {
    toolCallId: payload.toolCallId,
    toolName: payload.toolName,
    result: payload.result,
    isError: payload.isError,
  };
  acc.toolResults.push(toolResult);
  writer.sendToolResult(payload.toolCallId, payload.toolName, payload.result);
}

/**
 * Stream Mastra Agent response to SSEWriter.
 * Handles text-delta, tool-call, tool-result chunks and writes them for real-time streaming.
 */
export async function streamMastraAgent(
  agent: MastraAgent,
  messages: Array<{ role: string; content: string }>,
  writer: SSEWriter,
  options: StreamMastraAgentOptions = {}
): Promise<MastraStreamResult> {
  const startTime = Date.now();
  const { model = "unknown" } = options;
  const acc: StreamAccumulator = { fullText: "", toolCalls: [], toolResults: [] };

  writer.sendStatus("generating", { elapsed_ms: 0 });
  const result = await agent.stream(messages, {});

  for await (const chunk of result.fullStream) {
    if (!("payload" in chunk)) continue;

    switch (chunk.type) {
      case "text-delta":
        handleTextDelta(chunk.payload as TextDeltaPayload, acc, writer, model);
        break;
      case "tool-call":
        handleToolCall(chunk.payload as ToolCallPayload, acc, writer);
        break;
      case "tool-result":
        handleToolResult(chunk.payload as ToolResultPayload, acc, writer);
        break;
    }
  }

  return {
    text: acc.fullText,
    toolCalls: acc.toolCalls,
    toolResults: acc.toolResults,
    durationMs: Date.now() - startTime,
  };
}
