/**
 * SynapseR - Neural Signal Processing for LLM Agents
 *
 * ⚡ Stimulus → 🧬 Synapse → 💪 Response → 📡 Signal
 *
 * @example
 * ```typescript
 * import { createFlow, runFlow, chatStimulus } from "@aid-on/synapser";
 *
 * const weatherFlow = createFlow<string, WeatherData, WeatherArtifact>()
 *   .stimulus((msg) => chatStimulus(msg))
 *   .synapse(async (stimulus) => {
 *     // LLMが判断
 *     return { action: "get_weather", params: { location: "Tokyo" } };
 *   })
 *   .response(async (decision) => {
 *     // ツール実行
 *     const data = await fetchWeather(decision.params.location);
 *     return { success: true, data, action: decision.action, duration_ms: 100 };
 *   })
 *   .signal((response) => ({
 *     artifact: toWeatherArtifact(response.data),
 *   }))
 *   .build();
 *
 * const result = await runFlow(weatherFlow, "東京の天気は？");
 * console.log(result.signal?.artifact);
 * ```
 *
 * @packageDocumentation
 */

// =============================================================================
// Core Types
// =============================================================================

export type {
  // Stimulus
  Stimulus,
  StimulusType,
  BuiltinStimulusType,
  StimulusContext,
  // Synapse
  SynapseDecision,
  SynapseOptions,
  ActionDefinition,
  ParameterSchema,
  // Response
  Response,
  ResponseError,
  // Signal
  Signal,
  SignalEvent,
  SignalChunk,
  // Flow
  SynapseFlow,
  StimulusHandler,
  SynapseHandler,
  ResponseHandler,
  SignalHandler,
  FlowRunnerOptions,
  // Artifacts (extensible)
  BaseArtifact,
  CustomArtifact,
  Artifact,
  BuiltinArtifact,
  // Built-in artifact types (optional)
  WeatherArtifact,
  CodeArtifact,
  CommandArtifact,
} from "./types";

// =============================================================================
// Core Functions
// =============================================================================

export {
  // Stimulus factories
  createStimulus,
  chatStimulus,
  eventStimulus,
  webhookStimulus,
  // Flow builder
  createFlow,
  SynapseFlowBuilder,
  // Flow runner
  runFlow,
  FlowRunner,
  // Action registry
  createActionRegistry,
  ActionRegistry,
} from "./synapse";

export type { FlowResult, ActionExecutor } from "./synapse";

// =============================================================================
// SSE Reporter
// =============================================================================

export {
  SSEWriter,
  createSSEStream,
  createSSEResponse,
  streamSignal,
  SSE_HEADERS,
} from "./reporters/sse";

export type { SSEOptions, SSEChunk, SSEStreamResult } from "./reporters/sse";

// =============================================================================
// Mastra Adapter (re-export for convenience)
// =============================================================================

export {
  streamMastraAgent,
  createMastraSynapse,
  createMastraSynapseStream,
  actionsToMastraTools,
} from "./adapters/mastra";

export type {
  MastraAgent,
  MastraStreamChunk,
  MastraStreamResult,
  StreamMastraAgentOptions,
  ToolCall,
  ToolResult,
  TextDeltaPayload,
  ToolCallPayload,
  ToolResultPayload,
} from "./adapters/mastra";

// =============================================================================
// Version
// =============================================================================

export const VERSION = "0.1.0";
