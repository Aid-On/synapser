# @aid-on/synapser

<div align="center">

[![npm version](https://img.shields.io/npm/v/@aid-on/synapser.svg?style=flat-square&color=00DC82)](https://www.npmjs.com/package/@aid-on/synapser)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)

<br />

<h3>
<b>synapser</b> - LLMエージェントのための神経信号処理
</h3>

<p align="center">
<b>ただのエージェントフレームワークではありません。</b><br/>
LLMエージェント処理の混沌に構造を与える、型安全な4フェーズパイプライン。
</p>

<br/>

**日本語** | [**English**](./README.md)

<br/>

</div>

## synapserを使う理由

LLMエージェントのコードは、ユーザー入力の解析、LLM呼び出し、ツール実行、レスポンスのフォーマットがすべて混在し、スパゲッティコードになりがちです。synapserは神経信号処理にインスパイアされた4つのフェーズに関心事を分離します:

```
Stimulus → Synapse → Response → Signal
(入力)    (LLM判断)  (ツール実行)  (UI出力)
```

ゼロ依存。Mastraアダプターはオプショナルなpeer dependencyとして利用可能。

## インストール

```bash
npm install @aid-on/synapser
```

## クイックスタート

```typescript
import { createFlow, runFlow, chatStimulus, createActionRegistry } from "@aid-on/synapser";

// 1. ツールを登録
const actions = createActionRegistry()
  .register("get_weather", async ({ location }: { location: string }) => {
    const res = await fetch(`https://wttr.in/${location}?format=j1`);
    return res.json();
  });

// 2. フローを構築
const flow = createFlow<string, unknown, unknown>()
  .stimulus((msg) => chatStimulus(msg))
  .synapse(async (stimulus) => {
    // LLMが判断（ここに任意のLLM呼び出し）
    return { action: "get_weather", params: { location: "Tokyo" } };
  })
  .response((decision) => actions.execute(decision.action, decision.params))
  .signal((response) => ({
    message: response.success ? JSON.stringify(response.data) : "Error",
  }))
  .build();

// 3. 実行
const result = await runFlow(flow, "東京の天気は？");
console.log(result.signal?.message);
```

## SSEストリーミング

サーバーからクライアントへリアルタイムにストリーミング。

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

### SSEWriterメソッド

```typescript
writer.sendStatus("generating");       // ステータス更新
writer.sendText("Hello");              // テキストチャンク（OpenAI互換）
writer.sendArtifact(artifact);         // Artifact送信
writer.sendToolCall(id, name, args);   // ツール呼び出し情報
writer.sendToolResult(id, name, result); // ツール実行結果
writer.sendError("Something failed");  // エラー
writer.done();                         // 完了シグナル
```

## Artifactレポーター

ツール結果をUIコンポーネント向けのArtifactに変換。

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

// Response → Signal変換
const signal = reporter.report(response);
// signal.artifact.type === "weather" | "code"
```

組み込みArtifact型: `WeatherArtifact`, `CodeArtifact`, `CommandArtifact`

## Mastraアダプター

Mastra AgentをSynapseハンドラーとして使用。

```typescript
import { createMastraSynapse, streamMastraAgent } from "@aid-on/synapser/adapters/mastra";

// 非ストリーミング
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
// ストリーミング（SSE直接出力）
import { streamMastraAgent } from "@aid-on/synapser/adapters/mastra";

const { stream, writer } = createSSEStream();
const result = await streamMastraAgent(agent, messages, writer, {
  onToolCall: (call) => console.log("Tool:", call.toolName),
  onText: (text) => console.log("Text:", text),
});
```

### actionsToMastraTools

ActionRegistryのアクション定義をMastraツール形式に変換。

```typescript
import { actionsToMastraTools } from "@aid-on/synapser/adapters/mastra";

const mastraTools = actionsToMastraTools(actions.list());
```

## アクションレジストリ

ツール（アクション）の登録・実行を型安全に管理。

```typescript
const actions = createActionRegistry()
  .register("search", async ({ query }: { query: string }) => {
    return await searchAPI.search(query);
  })
  .register("translate", async ({ text, to }: { text: string; to: string }) => {
    return await translateAPI.translate(text, to);
  });

// 実行
const result = await actions.execute("search", { query: "TypeScript" });
// result: { success: boolean, data, action: "search", duration_ms: number }

// 登録済みアクション一覧
actions.list(); // ["search", "translate"]
actions.has("search"); // true
```

## フロービルダー

4フェーズを型安全に組み立てる。

```typescript
const flow = createFlow<TInput, TData, TArtifact>()
  .stimulus(handler)   // (input: TInput) => Stimulus
  .synapse(handler)    // (stimulus: Stimulus) => SynapseDecision
  .response(handler)   // (decision: SynapseDecision) => Response<TData>
  .signal(handler)     // (response: Response<TData>) => Signal<TArtifact>
  .build();
```

### runFlowオプション

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

## 型定義

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
  noAction?: boolean;     // trueならResponseフェーズをスキップ
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

## エクスポート

```typescript
// メイン
import {
  createFlow, runFlow, FlowRunner, SynapseFlowBuilder,
  createStimulus, chatStimulus, eventStimulus, webhookStimulus,
  createActionRegistry, ActionRegistry,
  SSEWriter, createSSEStream, createSSEResponse, streamSignal, SSE_HEADERS,
  streamMastraAgent, createMastraSynapse, createMastraSynapseStream, actionsToMastraTools,
} from "@aid-on/synapser";

// サブエクスポート
import { createArtifactReporter } from "@aid-on/synapser/reporters/artifact";
import { createSSEStream } from "@aid-on/synapser/reporters/sse";
import { createMastraSynapse } from "@aid-on/synapser/adapters/mastra";
```

## テスト

```
86テスト、6テストファイル -- 全パス

  synapse.test.ts                 22テスト (フロービルダー、ランナー、アクションレジストリ)
  sse.test.ts                     19テスト (SSEライター、ストリーミング)
  sse-stream-signal.test.ts       13テスト (streamSignal統合テスト)
  artifact-reporter.test.ts       12テスト (Artifact変換)
  artifact.test.ts                10テスト (組み込みコンバーター)
  action-registry.test.ts         10テスト (登録、実行、一覧)
```

## ライセンス

MIT © Aid-On

---

<div align="center">

**エージェントに構造を。コードに自由を。**

<br/>

[NPM](https://www.npmjs.com/package/@aid-on/synapser) •
[GitHub](https://github.com/Aid-On/aid-on-platform)

</div>
