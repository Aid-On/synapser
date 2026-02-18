# @aid-on/synapser

<div align="center">

[![npm version](https://img.shields.io/npm/v/@aid-on/synapser.svg?style=flat-square&color=00DC82)](https://www.npmjs.com/package/@aid-on/synapser)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

<br />

<h3>
<b>synapser</b> - Neural Signal Processing for LLM Agents
</h3>

<p align="center">
<b>Not just another agent framework.</b><br/>
A type-safe 4-phase pipeline that gives structure to the chaos of LLM agent processing.
</p>

<br/>

[**日本語**](./README.ja.md) | **English**

<br/>

</div>

## Why synapser

LLM agent code tends to become tangled spaghetti: user input parsing, LLM calls, tool execution, and response formatting all mixed together. synapser separates these concerns into four distinct phases inspired by neural signal processing:

```
Stimulus → Synapse → Response → Signal
(Input)    (LLM Decision)  (Tool Execution)  (UI Output)
```

Zero runtime dependencies. Mastra adapter available as an optional peer dependency.

## Installation

```bash
npm install @aid-on/synapser
```

## Quick Start

```typescript
import { createFlow, runFlow, chatStimulus, createActionRegistry } from "@aid-on/synapser";

// 1. Register tools
const actions = createActionRegistry()
  .register("get_weather", async ({ location }: { location: string }) => {
    const res = await fetch(`https://wttr.in/${location}?format=j1`);
    return res.json();
  });

// 2. Build a flow
const flow = createFlow<string, unknown, unknown>()
  .stimulus((msg) => chatStimulus(msg))
  .synapse(async (stimulus) => {
    // LLM decides what to do (plug in any LLM call here)
    return { action: "get_weather", params: { location: "Tokyo" } };
  })
  .response((decision) => actions.execute(decision.action, decision.params))
  .signal((response) => ({
    message: response.success ? JSON.stringify(response.data) : "Error",
  }))
  .build();

// 3. Run
const result = await runFlow(flow, "What's the weather in Tokyo?");
console.log(result.signal?.message);
```

## SSE Streaming

Stream results from server to client in real time.

```typescript
import { createSSEStream, streamSignal, SSE_HEADERS } from "@aid-on/synapser";

app.post("/api/chat", async (c) => {
  const { message } = await c.req.json();
  const { stream, writer } = createSSEStream();

  (async () => {
    writer.sendStatus("thinking");
    const result = await runFlow(chatFlow, message);

    if (result.success && result.signal) {
      await streamSignal(writer, result.signal);
    } else {
      writer.sendError(result.error?.message || "Unknown error");
    }
    writer.done();
  })();

  return new Response(stream, { headers: SSE_HEADERS });
});
```

### SSEWriter Methods

```typescript
writer.sendStatus("generating");       // Status update
writer.sendText("Hello");              // Text chunk (OpenAI-compatible)
writer.sendArtifact(artifact);         // Send artifact
writer.sendToolCall(id, name, args);   // Tool call info
writer.sendToolResult(id, name, result); // Tool execution result
writer.sendError("Something failed");  // Error
writer.done();                         // Completion signal
```

## Artifact Reporter

Convert tool results into UI-ready artifacts.

```typescript
import { createArtifactReporter } from "@aid-on/synapser/reporters/artifact";

const reporter = createArtifactReporter({
  converters: {
    get_weather: (data) => ({
      type: "weather",
      location: data.location,
      temperature: data.temp_C,
      description: data.weatherDesc,
    }),
    generate_code: (data) => ({
      type: "code",
      language: data.language,
      code: data.code,
    }),
  },
});

// Response -> Signal conversion
const signal = reporter.report(response);
// signal.artifact.type === "weather" | "code"
```

Built-in artifact types: `WeatherArtifact`, `CodeArtifact`, `CommandArtifact`

## Mastra Adapter

Use a Mastra Agent as your Synapse handler.

```typescript
import { createMastraSynapse, streamMastraAgent } from "@aid-on/synapser/adapters/mastra";

// Non-streaming
const synapse = createMastraSynapse(
  { apiKey: process.env.LLM_API_KEY, model: "gpt-4o", locale: "ja" },
  agentFactory
);

const flow = createFlow()
  .stimulus((msg) => chatStimulus(msg))
  .synapse(synapse)
  .response((decision) => actions.execute(decision.action, decision.params))
  .signal((response) => reporter.report(response))
  .build();
```

```typescript
// Streaming (direct SSE output)
import { streamMastraAgent } from "@aid-on/synapser/adapters/mastra";

const { stream, writer } = createSSEStream();
const result = await streamMastraAgent(agent, messages, writer, {
  onToolCall: (call) => console.log("Tool:", call.toolName),
  onText: (text) => console.log("Text:", text),
});
```

### actionsToMastraTools

Convert ActionRegistry definitions to Mastra tool format.

```typescript
import { actionsToMastraTools } from "@aid-on/synapser/adapters/mastra";

const mastraTools = actionsToMastraTools(actions.list());
```

## Action Registry

Type-safe registration and execution of tools (actions).

```typescript
const actions = createActionRegistry()
  .register("search", async ({ query }: { query: string }) => {
    return await searchAPI.search(query);
  })
  .register("translate", async ({ text, to }: { text: string; to: string }) => {
    return await translateAPI.translate(text, to);
  });

// Execute
const result = await actions.execute("search", { query: "TypeScript" });
// result: { success: boolean, data, action: "search", duration_ms: number }

// List registered actions
actions.list(); // ["search", "translate"]
actions.has("search"); // true
```

## Flow Builder

Assemble the 4 phases with full type safety.

```typescript
const flow = createFlow<TInput, TData, TArtifact>()
  .stimulus(handler)   // (input: TInput) => Stimulus
  .synapse(handler)    // (stimulus: Stimulus) => SynapseDecision
  .response(handler)   // (decision: SynapseDecision) => Response<TData>
  .signal(handler)     // (response: Response<TData>) => Signal<TArtifact>
  .build();
```

### runFlow Options

```typescript
const result = await runFlow(flow, input, {
  timeout: 30000,
  debug: true,
  onPhaseComplete: (phase, result) => console.log(phase, result),
  onError: (error, phase) => console.error(phase, error),
});

// result.success
// result.signal?.artifact
// result.phases.stimulus.duration_ms
// result.phases.synapse.duration_ms
// result.total_duration_ms
```

## Types

```typescript
// Stimulus
interface Stimulus<TInput = unknown> {
  type: "chat" | "webhook" | "cron" | "event" | "sensor" | string;
  input: TInput;
  context?: StimulusContext;
  timestamp: number;
  id: string;
}

// Synapse Decision
interface SynapseDecision {
  action: string;
  params: Record<string, unknown>;
  confidence?: number;    // 0-1
  reasoning?: string;
  noAction?: boolean;     // If true, skip Response phase
}

// Response
interface Response<TData = unknown> {
  success: boolean;
  data?: TData;
  error?: { code: string; message: string; details?: unknown };
  duration_ms: number;
  action: string;
}

// Signal
interface Signal<TArtifact = unknown> {
  artifact?: TArtifact;
  message?: string;
  events?: SignalEvent[];
  stream?: AsyncIterable<SignalChunk>;
}
```

## Exports

```typescript
// Main
import {
  createFlow, runFlow, FlowRunner, SynapseFlowBuilder,
  createStimulus, chatStimulus, eventStimulus, webhookStimulus,
  createActionRegistry, ActionRegistry,
  SSEWriter, createSSEStream, createSSEResponse, streamSignal, SSE_HEADERS,
  streamMastraAgent, createMastraSynapse, createMastraSynapseStream, actionsToMastraTools,
} from "@aid-on/synapser";

// Sub-exports
import { createArtifactReporter } from "@aid-on/synapser/reporters/artifact";
import { createSSEStream } from "@aid-on/synapser/reporters/sse";
import { createMastraSynapse } from "@aid-on/synapser/adapters/mastra";
```

## Tests

```
86 tests, 6 test files -- all passing

  synapse.test.ts                 22 tests  (flow builder, runner, action registry)
  sse.test.ts                     19 tests  (SSE writer, streaming)
  sse-stream-signal.test.ts       13 tests  (streamSignal integration)
  artifact-reporter.test.ts       12 tests  (artifact conversion)
  artifact.test.ts                10 tests  (built-in converters)
  action-registry.test.ts         10 tests  (register, execute, list)
```

## License

MIT © Aid-On

---

<div align="center">

**Structure for your agents. Freedom for your code.**

<br/>

[NPM](https://www.npmjs.com/package/@aid-on/synapser) •
[GitHub](https://github.com/Aid-On/aid-on-platform)

</div>
