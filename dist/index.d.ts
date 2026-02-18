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
export type { Stimulus, StimulusType, BuiltinStimulusType, StimulusContext, SynapseDecision, SynapseOptions, ActionDefinition, ParameterSchema, Response, ResponseError, Signal, SignalEvent, SignalChunk, SynapseFlow, StimulusHandler, SynapseHandler, ResponseHandler, SignalHandler, FlowRunnerOptions, BaseArtifact, CustomArtifact, Artifact, BuiltinArtifact, WeatherArtifact, CodeArtifact, CommandArtifact, } from "./types";
export { createStimulus, chatStimulus, eventStimulus, webhookStimulus, createFlow, SynapseFlowBuilder, runFlow, FlowRunner, createActionRegistry, ActionRegistry, } from "./synapse";
export type { FlowResult, ActionExecutor } from "./synapse";
export { SSEWriter, createSSEStream, createSSEResponse, streamSignal, SSE_HEADERS, } from "./reporters/sse";
export type { SSEOptions, SSEChunk, SSEStreamResult } from "./reporters/sse";
export { streamMastraAgent, createMastraSynapse, createMastraSynapseStream, actionsToMastraTools, } from "./adapters/mastra";
export type { MastraAgent, MastraStreamChunk, MastraStreamResult, StreamMastraAgentOptions, ToolCall, ToolResult, TextDeltaPayload, ToolCallPayload, ToolResultPayload, } from "./adapters/mastra";
export declare const VERSION = "0.1.0";
//# sourceMappingURL=index.d.ts.map