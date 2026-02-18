# @aid-on/synapser

## 概要

`@aid-on/synapser`は、LLMエージェント向けの神経信号処理ライブラリです。"Stimulus → Synapse → Response → Signal"の4段階フローにより、LLMの思考過程を構造化し、ツール実行とストリーミング出力を統合的に管理します。Mastraエージェントとの完全統合を提供します。

## 主な特徴

- **神経フローパターン**: 生体神経系を模倣した4段階処理フロー
- **Mastra統合**: Mastra Agent Frameworkとの完全統合
- **SSEストリーミング**: Server-Sent Eventsによるリアルタイム出力
- **型安全性**: TypeScriptによる完全な型サポート
- **アーティファクト生成**: 構造化された結果オブジェクト
- **フレキシブル設計**: カスタムアクションとツールの簡易実装
- **エラーハンドリング**: 堅牢な例外処理とリカバリ機能

## アーキテクチャ

### 4段階神経フロー

```
⚡ Stimulus → 🧬 Synapse → 💪 Response → 📡 Signal
   入力刺激    判断・決定    ツール実行    出力信号
```

### フロー詳細

1. **Stimulus (入力刺激)**: ユーザー入力、イベント、Webhookの受信
2. **Synapse (神経判断)**: LLMによるアクション決定とパラメータ抽出
3. **Response (応答実行)**: ツール実行とデータ取得
4. **Signal (信号出力)**: アーティファクト生成とストリーミング出力

### 統合アーキテクチャ

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Input Layer   │    │   Processing    │    │   Output Layer  │
├─────────────────┤    ├─────────────────┤    ├─────────────────┤
│ Chat Messages   │───►│ Mastra Agent    │───►│ SSE Stream      │
│ Webhook Events  │    │ Tool Execution  │    │ Artifacts       │
│ API Requests    │    │ Neural Flow     │    │ JSON Response   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## APIリファレンス

### フロービルダー

```typescript
import { createFlow, runFlow, chatStimulus } from "@aid-on/synapser";

// 天気情報取得フロー
const weatherFlow = createFlow<string, WeatherData, WeatherArtifact>()
  .stimulus((msg) => chatStimulus(msg))
  .synapse(async (stimulus) => {
    // LLMによる判断・パラメータ抽出
    const decision = await llm.analyze(stimulus.input);
    return { 
      action: "get_weather", 
      params: { location: decision.location } 
    };
  })
  .response(async (decision) => {
    // ツール実行
    const weatherData = await fetchWeather(decision.params.location);
    return { 
      success: true, 
      data: weatherData, 
      action: decision.action,
      duration_ms: 150
    };
  })
  .signal((response) => ({
    artifact: {
      type: "weather",
      location: response.data.location,
      temperature: response.data.temperature,
      description: response.data.description
    }
  }))
  .build();

// フロー実行
const result = await runFlow(weatherFlow, "東京の天気は？");
console.log(result.signal?.artifact);
```

### Mastraエージェント統合

```typescript
import { streamMastraAgent, createMastraSynapse } from "@aid-on/synapser/adapters/mastra";

// Mastraエージェントの作成
const agent = new Agent({
  name: "weather-assistant",
  instructions: "天気情報を提供する専門エージェント",
  model: openai.chat("gpt-4"),
  tools: {
    getWeather: weatherTool,
    getLocation: locationTool
  }
});

// SynapseRとの統合
const synapticAgent = createMastraSynapse(agent, {
  maxSteps: 5,
  debug: true
});

// ストリーミング実行
const stream = await streamMastraAgent(agent, {
  messages: [{ role: "user", content: "東京の今日の天気は？" }],
  onToolCall: (call) => console.log("Tool called:", call.name),
  onToolResult: (result) => console.log("Tool result:", result),
  onTextDelta: (delta) => process.stdout.write(delta.textDelta)
});

for await (const chunk of stream) {
  if (chunk.type === 'tool-call') {
    console.log("Calling tool:", chunk.toolName);
  } else if (chunk.type === 'text-delta') {
    console.log("Generated:", chunk.textDelta);
  }
}
```

### SSEストリーミング

```typescript
import { createSSEStream, streamSignal } from "@aid-on/synapser/reporters/sse";

// SSEストリーミングレスポンス
export async function handleSSERequest(request: Request): Promise<Response> {
  const sseStream = createSSEStream();
  
  // フロー実行とストリーミング
  const flowPromise = runFlow(weatherFlow, userMessage);
  
  // 進捗ストリーミング
  sseStream.write({
    event: "progress",
    data: JSON.stringify({ stage: "stimulus", message: "入力を解析中..." })
  });
  
  const result = await flowPromise;
  
  // 結果ストリーミング
  await streamSignal(sseStream, result.signal!);
  
  sseStream.close();
  
  return sseStream.response;
}

// クライアント側受信
const eventSource = new EventSource("/api/chat/stream");
eventSource.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log("Received:", data);
};
```

### アクション登録システム

```typescript
import { createActionRegistry } from "@aid-on/synapser";

// アクション登録
const actions = createActionRegistry()
  .register("get_weather", {
    description: "指定された場所の天気情報を取得",
    parameters: {
      location: { type: "string", description: "場所名" },
      units: { type: "string", enum: ["celsius", "fahrenheit"], default: "celsius" }
    },
    executor: async ({ location, units }) => {
      const weather = await fetchWeather(location, units);
      return { success: true, data: weather };
    }
  })
  .register("get_time", {
    description: "現在時刻を取得",
    parameters: {
      timezone: { type: "string", optional: true }
    },
    executor: async ({ timezone }) => {
      const time = new Date().toLocaleString("ja-JP", { timeZone: timezone });
      return { success: true, data: { time, timezone } };
    }
  })
  .build();

// アクション実行
const result = await actions.execute("get_weather", { 
  location: "東京", 
  units: "celsius" 
});
```

## 使用例

### チャットボットAPI

```typescript
// src/api/chat/route.ts
import { streamMastraAgent } from "@aid-on/synapser/adapters/mastra";
import { createSSEResponse } from "@aid-on/synapser/reporters/sse";

export async function POST(request: Request): Promise<Response> {
  const { messages } = await request.json();
  
  // SSEストリーム作成
  const sseResponse = createSSEResponse();
  
  try {
    // Mastraエージェントストリーミング
    const stream = await streamMastraAgent(agent, {
      messages,
      onTextDelta: (delta) => {
        sseResponse.write({
          event: "text",
          data: JSON.stringify({ delta: delta.textDelta })
        });
      },
      onToolCall: (call) => {
        sseResponse.write({
          event: "tool-call",
          data: JSON.stringify({ 
            name: call.toolName, 
            args: call.args 
          })
        });
      },
      onToolResult: (result) => {
        sseResponse.write({
          event: "tool-result", 
          data: JSON.stringify({
            success: !result.isError,
            result: result.result
          })
        });
      }
    });
    
    // ストリーム完了まで処理
    for await (const chunk of stream) {
      // Mastraが自動的にonTextDelta, onToolCallを呼び出す
    }
    
    sseResponse.write({
      event: "complete",
      data: JSON.stringify({ finished: true })
    });
    
  } catch (error) {
    sseResponse.write({
      event: "error",
      data: JSON.stringify({ error: error.message })
    });
  }
  
  sseResponse.close();
  return sseResponse.response;
}
```

### 複雑なワークフロー

```typescript
// src/workflows/document-analysis.ts
import { createFlow, chatStimulus } from "@aid-on/synapser";

const documentAnalysisFlow = createFlow<string, AnalysisResult, DocumentArtifact>()
  .stimulus((content) => chatStimulus(content, { 
    type: "document_analysis",
    metadata: { timestamp: Date.now() }
  }))
  .synapse(async (stimulus) => {
    // LLMによる文書タイプ判定
    const analysis = await llm.classify(stimulus.input);
    
    return {
      action: "analyze_document",
      params: {
        type: analysis.documentType,
        language: analysis.language,
        complexity: analysis.complexity
      }
    };
  })
  .response(async (decision) => {
    const { type, language, complexity } = decision.params;
    
    // 文書タイプに応じた処理分岐
    let analysisResult;
    
    switch (type) {
      case "academic_paper":
        analysisResult = await analyzeAcademicPaper(decision.params);
        break;
      case "business_report":
        analysisResult = await analyzeBusinessReport(decision.params);
        break;
      case "technical_documentation":
        analysisResult = await analyzeTechnicalDoc(decision.params);
        break;
      default:
        analysisResult = await performGeneralAnalysis(decision.params);
    }
    
    return {
      success: true,
      data: analysisResult,
      action: decision.action,
      duration_ms: Date.now() - startTime,
      metadata: { 
        processingComplexity: complexity,
        language 
      }
    };
  })
  .signal((response) => ({
    artifact: {
      type: "document_analysis",
      summary: response.data.summary,
      keyPoints: response.data.keyPoints,
      sentiment: response.data.sentiment,
      entities: response.data.entities,
      topics: response.data.topics,
      readabilityScore: response.data.readabilityScore,
      processingTime: response.duration_ms
    }
  }))
  .build();

// 使用例
const documentContent = await readFile("report.pdf");
const result = await runFlow(documentAnalysisFlow, documentContent);

console.log("Document Analysis Complete:");
console.log("Summary:", result.signal?.artifact.summary);
console.log("Key Points:", result.signal?.artifact.keyPoints);
console.log("Sentiment:", result.signal?.artifact.sentiment);
```

### Webhook処理システム

```typescript
// src/webhooks/github.ts
import { createFlow, webhookStimulus } from "@aid-on/synapser";

const githubWebhookFlow = createFlow<GitHubWebhook, PRAnalysis, GitHubArtifact>()
  .stimulus((webhook) => webhookStimulus(webhook, {
    type: "github_webhook",
    source: "github",
    metadata: { repository: webhook.repository.name }
  }))
  .synapse(async (stimulus) => {
    const webhook = stimulus.input;
    
    // Webhookタイプによる処理決定
    switch (webhook.action) {
      case "opened":
      case "synchronize":
        return {
          action: "analyze_pr",
          params: {
            prNumber: webhook.pull_request.number,
            repository: webhook.repository.full_name,
            branch: webhook.pull_request.head.ref
          }
        };
      case "closed":
        return {
          action: "cleanup_pr",
          params: {
            prNumber: webhook.pull_request.number,
            merged: webhook.pull_request.merged
          }
        };
      default:
        return {
          action: "log_event",
          params: { event: webhook.action }
        };
    }
  })
  .response(async (decision) => {
    switch (decision.action) {
      case "analyze_pr":
        // PRの変更内容を分析
        const analysis = await analyzePullRequest(decision.params);
        return {
          success: true,
          data: analysis,
          action: decision.action,
          duration_ms: 2500
        };
        
      case "cleanup_pr":
        // PRクローズ後のクリーンアップ
        await cleanupPRResources(decision.params);
        return {
          success: true,
          data: { cleaned: true },
          action: decision.action,
          duration_ms: 500
        };
        
      default:
        // ログ記録のみ
        console.log("GitHub event:", decision.params);
        return {
          success: true,
          data: { logged: true },
          action: decision.action,
          duration_ms: 10
        };
    }
  })
  .signal((response) => {
    if (response.action === "analyze_pr") {
      return {
        artifact: {
          type: "pr_analysis",
          recommendation: response.data.recommendation,
          riskLevel: response.data.riskLevel,
          codeQuality: response.data.codeQuality,
          testCoverage: response.data.testCoverage,
          securityIssues: response.data.securityIssues
        }
      };
    }
    
    return {
      artifact: {
        type: "event_log",
        action: response.action,
        success: response.success
      }
    };
  })
  .build();

// Webhook エンドポイント
export async function handleGitHubWebhook(request: Request): Promise<Response> {
  const webhook = await request.json();
  
  try {
    const result = await runFlow(githubWebhookFlow, webhook);
    
    // Slackに分析結果を通知
    if (result.signal?.artifact.type === "pr_analysis") {
      await notifySlack({
        text: `PR Analysis Complete`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `*Recommendation:* ${result.signal.artifact.recommendation}\n*Risk Level:* ${result.signal.artifact.riskLevel}`
            }
          }
        ]
      });
    }
    
    return Response.json({ success: true, processed: true });
    
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}
```

### マルチエージェント協調システム

```typescript
// src/multi-agent/coordinator.ts
import { createFlow, eventStimulus } from "@aid-on/synapser";

const coordinatorFlow = createFlow<CoordinationRequest, AgentResults, CoordinatedArtifact>()
  .stimulus((request) => eventStimulus(request, {
    type: "multi_agent_coordination",
    metadata: { agentCount: request.agents.length }
  }))
  .synapse(async (stimulus) => {
    const request = stimulus.input;
    
    // タスク分析とエージェント割り当て
    const allocation = await analyzeTaskAllocation(request);
    
    return {
      action: "coordinate_agents",
      params: {
        taskId: request.taskId,
        agentAssignments: allocation.assignments,
        dependencies: allocation.dependencies,
        timeout: allocation.estimatedDuration
      }
    };
  })
  .response(async (decision) => {
    const { agentAssignments, dependencies, timeout } = decision.params;
    
    // 並列エージェント実行
    const agentPromises = agentAssignments.map(async (assignment) => {
      const agent = getAgent(assignment.agentId);
      
      // 依存関係を待機
      await waitForDependencies(assignment.dependencies, dependencies);
      
      // エージェント実行
      const result = await executeAgent(agent, assignment.task);
      
      return {
        agentId: assignment.agentId,
        result,
        completedAt: Date.now()
      };
    });
    
    // タイムアウト付きで全エージェントの完了を待機
    const results = await Promise.allSettled(
      agentPromises.map(p => withTimeout(p, timeout))
    );
    
    // 結果の統合
    const successfulResults = results
      .filter(r => r.status === 'fulfilled')
      .map(r => (r as PromiseFulfilledResult<any>).value);
    
    const failedResults = results
      .filter(r => r.status === 'rejected')
      .map(r => (r as PromiseRejectedResult).reason);
    
    return {
      success: failedResults.length === 0,
      data: {
        successful: successfulResults,
        failed: failedResults,
        totalAgents: agentAssignments.length,
        successRate: successfulResults.length / agentAssignments.length
      },
      action: decision.action,
      duration_ms: Date.now() - startTime
    };
  })
  .signal((response) => ({
    artifact: {
      type: "coordination_result",
      taskId: response.data.taskId,
      agentResults: response.data.successful,
      failureCount: response.data.failed.length,
      successRate: response.data.successRate,
      totalDuration: response.duration_ms,
      recommendations: generateRecommendations(response.data)
    }
  }))
  .build();

// 使用例: 複数エージェントでの記事執筆
const writingTask = {
  taskId: "article-001",
  topic: "AI技術の現状と未来",
  agents: [
    { id: "researcher", role: "research" },
    { id: "writer", role: "writing" },
    { id: "reviewer", role: "review" },
    { id: "editor", role: "editing" }
  ],
  requirements: {
    wordCount: 3000,
    citations: 10,
    readingLevel: "intermediate"
  }
};

const result = await runFlow(coordinatorFlow, writingTask);
console.log("Article collaboration completed:", result.signal?.artifact);
```

## 設定オプション

### フロー設定

```typescript
interface FlowRunnerOptions {
  timeout?: number;           // フロー全体のタイムアウト（ms）
  retries?: number;           // 失敗時の再試行回数
  debug?: boolean;            // デバッグログ有効化
  context?: any;              // カスタムコンテキスト
  metadata?: Record<string, any>; // メタデータ
}

// 使用例
const result = await runFlow(weatherFlow, "東京の天気", {
  timeout: 30000,       // 30秒タイムアウト
  retries: 3,           // 3回まで再試行
  debug: true,          // デバッグログ有効
  metadata: { 
    userId: "user123",
    requestId: "req456"
  }
});
```

### Mastra統合設定

```typescript
interface StreamMastraAgentOptions {
  maxSteps?: number;           // 最大ステップ数
  debug?: boolean;             // デバッグログ
  onTextDelta?: (delta: TextDeltaPayload) => void;
  onToolCall?: (call: ToolCallPayload) => void;
  onToolResult?: (result: ToolResultPayload) => void;
  onStepFinish?: (step: any) => void;
  abortController?: AbortController; // 実行中止制御
}

// 高度な設定例
const stream = await streamMastraAgent(agent, {
  maxSteps: 10,
  debug: process.env.NODE_ENV === 'development',
  onTextDelta: (delta) => {
    // リアルタイム文字出力
    process.stdout.write(delta.textDelta);
  },
  onToolCall: (call) => {
    console.log(`🛠️  Calling ${call.toolName} with:`, call.args);
  },
  onToolResult: (result) => {
    if (result.isError) {
      console.error(`❌ Tool failed:`, result.result);
    } else {
      console.log(`✅ Tool succeeded:`, result.result);
    }
  },
  abortController: new AbortController() // 必要時に中止可能
});
```

### SSE設定

```typescript
interface SSEOptions {
  headers?: Record<string, string>; // カスタムヘッダー
  cors?: boolean;                   // CORS有効化
  keepAlive?: number;               // キープアライブ間隔（ms）
  compression?: boolean;            // gzip圧縮
  maxConnections?: number;          // 最大同時接続数
}

// プロダクション設定例
const sseResponse = createSSEResponse({
  headers: {
    'Cache-Control': 'no-cache',
    'Access-Control-Allow-Origin': 'https://yourdomain.com'
  },
  cors: true,
  keepAlive: 30000,    // 30秒間隔
  compression: true,   // 帯域節約
  maxConnections: 1000 // スケーラビリティ
});
```

## パフォーマンス考慮事項

### フロー最適化

```typescript
// 効率的なフロー設計
const optimizedFlow = createFlow<Input, Output, Artifact>()
  .stimulus((input) => {
    // 軽量な前処理のみ
    return createStimulus("optimized", input);
  })
  .synapse(async (stimulus) => {
    // キャッシュされた判断ロジック
    const cached = await getDecisionCache(stimulus.input);
    if (cached) return cached;
    
    const decision = await llm.quickDecision(stimulus.input);
    await setDecisionCache(stimulus.input, decision);
    return decision;
  })
  .response(async (decision) => {
    // 並列ツール実行
    const results = await Promise.all([
      executeTool1(decision.params),
      executeTool2(decision.params),
      executeTool3(decision.params)
    ]);
    
    return {
      success: true,
      data: combineResults(results),
      duration_ms: performance.now() - startTime
    };
  })
  .signal((response) => ({
    // 最小限のアーティファクト
    artifact: createMinimalArtifact(response.data)
  }))
  .build();
```

### メモリ管理

```typescript
// メモリ効率的な実装
class MemoryEfficientRunner {
  private resultCache = new Map<string, any>();
  private maxCacheSize = 1000;
  
  async runWithMemoryControl<T, R, A>(
    flow: SynapseFlow<T, R, A>, 
    input: T
  ): Promise<FlowResult<R, A>> {
    
    // キャッシュサイズ制限
    if (this.resultCache.size > this.maxCacheSize) {
      const keysToDelete = Array.from(this.resultCache.keys())
        .slice(0, this.maxCacheSize / 2);
      keysToDelete.forEach(key => this.resultCache.delete(key));
    }
    
    // WeakMapを使用した一時オブジェクト管理
    const tempObjects = new WeakMap();
    
    try {
      const result = await runFlow(flow, input);
      
      // 必要な部分のみキャッシュ
      const cacheKey = this.generateCacheKey(input);
      this.resultCache.set(cacheKey, {
        signal: result.signal,
        timestamp: Date.now()
      });
      
      return result;
      
    } finally {
      // 明示的なクリーンアップ
      tempObjects = null;
    }
  }
}
```

### ストリーミング最適化

```typescript
// 効率的なSSEストリーミング
class OptimizedSSEWriter {
  private buffer: string[] = [];
  private flushTimer?: NodeJS.Timeout;
  
  write(chunk: SSEChunk) {
    this.buffer.push(this.formatSSEChunk(chunk));
    
    // バッファリングによる効率化
    if (!this.flushTimer) {
      this.flushTimer = setTimeout(() => {
        this.flush();
      }, 16); // 60fps相当
    }
  }
  
  private flush() {
    if (this.buffer.length > 0) {
      const combined = this.buffer.join('');
      this.sendToClient(combined);
      this.buffer = [];
    }
    this.flushTimer = undefined;
  }
  
  // バックプレッシャー対応
  private async sendToClient(data: string) {
    if (this.clientBuffer.isFull()) {
      await this.waitForDrain();
    }
    this.clientBuffer.write(data);
  }
}
```