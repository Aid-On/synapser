/**
 * SynapseR - Flow Runner
 *
 * 神経伝達フローを実行するランナー
 */

import type {
  Stimulus,
  StimulusType,
  StimulusContext,
  SynapseDecision,
  Response,
  Signal,
  SynapseFlow,
  StimulusHandler,
  SynapseHandler,
  ResponseHandler,
  SignalHandler,
  FlowRunnerOptions,
} from "./types";

// =============================================================================
// Stimulus Factory
// =============================================================================

export function createStimulus<TInput>(
  type: StimulusType,
  input: TInput,
  context?: StimulusContext
): Stimulus<TInput> {
  return {
    type,
    input,
    context,
    timestamp: Date.now(),
    id: crypto.randomUUID(),
  };
}

/** Chat stimulus helper */
export function chatStimulus(message: string, context?: StimulusContext): Stimulus<string> {
  return createStimulus("chat", message, context);
}

/** Event stimulus helper */
export function eventStimulus<T>(event: T, context?: StimulusContext): Stimulus<T> {
  return createStimulus("event", event, context);
}

/** Webhook stimulus helper */
export function webhookStimulus<T>(payload: T, context?: StimulusContext): Stimulus<T> {
  return createStimulus("webhook", payload, context);
}

// =============================================================================
// Flow Builder
// =============================================================================

export class SynapseFlowBuilder<TInput = unknown, TData = unknown, TArtifact = unknown> {
  private _stimulus?: StimulusHandler<TInput>;
  private _synapse?: SynapseHandler;
  private _response?: ResponseHandler<TData>;
  private _signal?: SignalHandler<TData, TArtifact>;

  /** Stimulusハンドラーを設定 */
  stimulus(handler: StimulusHandler<TInput>): this {
    this._stimulus = handler;
    return this;
  }

  /** Synapseハンドラーを設定 */
  synapse(handler: SynapseHandler): this {
    this._synapse = handler;
    return this;
  }

  /** Responseハンドラーを設定 */
  response(handler: ResponseHandler<TData>): this {
    this._response = handler;
    return this;
  }

  /** Signalハンドラーを設定 */
  signal(handler: SignalHandler<TData, TArtifact>): this {
    this._signal = handler;
    return this;
  }

  /** Flowをビルド */
  build(): SynapseFlow<TInput, TData, TArtifact> {
    if (!this._stimulus) throw new Error("Stimulus handler is required");
    if (!this._synapse) throw new Error("Synapse handler is required");
    if (!this._response) throw new Error("Response handler is required");
    if (!this._signal) throw new Error("Signal handler is required");

    return {
      stimulus: this._stimulus,
      synapse: this._synapse,
      response: this._response,
      signal: this._signal,
    };
  }
}

export function createFlow<TInput = unknown, TData = unknown, TArtifact = unknown>() {
  return new SynapseFlowBuilder<TInput, TData, TArtifact>();
}

// =============================================================================
// Flow Runner
// =============================================================================

export interface FlowResult<TArtifact = unknown> {
  success: boolean;
  signal?: Signal<TArtifact>;
  error?: Error;
  phases: {
    stimulus?: { duration_ms: number; result: Stimulus };
    synapse?: { duration_ms: number; result: SynapseDecision };
    response?: { duration_ms: number; result: Response };
    signal?: { duration_ms: number; result: Signal<TArtifact> };
  };
  total_duration_ms: number;
}

export class FlowRunner<TInput = unknown, TData = unknown, TArtifact = unknown> {
  constructor(
    private flow: SynapseFlow<TInput, TData, TArtifact>,
    private options: FlowRunnerOptions = {}
  ) {
    // Parameter properties are initialized by TypeScript
  }

  async run(input: TInput): Promise<FlowResult<TArtifact>> {
    const startTime = Date.now();
    const phases: FlowResult<TArtifact>["phases"] = {};

    try {
      // Phase 1: Stimulus
      const stimulusStart = Date.now();
      const stimulus = await this.flow.stimulus(input);
      phases.stimulus = {
        duration_ms: Date.now() - stimulusStart,
        result: stimulus,
      };
      this.options.onPhaseComplete?.("stimulus", stimulus);

      // Phase 2: Synapse (LLM Decision)
      const synapseStart = Date.now();
      const decision = await this.flow.synapse(stimulus);
      phases.synapse = {
        duration_ms: Date.now() - synapseStart,
        result: decision,
      };
      this.options.onPhaseComplete?.("synapse", decision);

      // Check for no-action
      if (decision.noAction) {
        const signal: Signal<TArtifact> = { message: decision.reasoning };
        return {
          success: true,
          signal,
          phases,
          total_duration_ms: Date.now() - startTime,
        };
      }

      // Phase 3: Response (Action Execution)
      const responseStart = Date.now();
      const response = await this.flow.response(decision);
      phases.response = {
        duration_ms: Date.now() - responseStart,
        result: response,
      };
      this.options.onPhaseComplete?.("response", response);

      // Phase 4: Signal (Output)
      const signalStart = Date.now();
      const signal = await this.flow.signal(response);
      phases.signal = {
        duration_ms: Date.now() - signalStart,
        result: signal,
      };
      this.options.onPhaseComplete?.("signal", signal);

      return {
        success: true,
        signal,
        phases,
        total_duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      const phase = this.detectFailedPhase(phases);
      this.options.onError?.(error as Error, phase);

      return {
        success: false,
        error: error as Error,
        phases,
        total_duration_ms: Date.now() - startTime,
      };
    }
  }

  private detectFailedPhase(phases: FlowResult<TArtifact>["phases"]): "stimulus" | "synapse" | "response" | "signal" {
    if (!phases.stimulus) return "stimulus";
    if (!phases.synapse) return "synapse";
    if (!phases.response) return "response";
    return "signal";
  }
}

export function runFlow<TInput, TData, TArtifact>(
  flow: SynapseFlow<TInput, TData, TArtifact>,
  input: TInput,
  options?: FlowRunnerOptions
): Promise<FlowResult<TArtifact>> {
  return new FlowRunner(flow, options).run(input);
}

// =============================================================================
// Utility: Action Registry
// =============================================================================

export type ActionExecutor<TParams = Record<string, unknown>, TResult = unknown> = (
  params: TParams
) => Promise<TResult>;

export class ActionRegistry {
  private actions = new Map<string, ActionExecutor>();

  register<TParams, TResult>(
    name: string,
    executor: ActionExecutor<TParams, TResult>
  ): this {
    this.actions.set(name, executor as ActionExecutor);
    return this;
  }

  async execute<TResult = unknown>(
    action: string,
    params: Record<string, unknown>
  ): Promise<Response<TResult>> {
    const executor = this.actions.get(action);
    const startTime = Date.now();

    if (!executor) {
      return {
        success: false,
        action,
        error: { code: "ACTION_NOT_FOUND", message: `Action "${action}" not registered` },
        duration_ms: Date.now() - startTime,
      };
    }

    try {
      const data = await executor(params);
      return {
        success: true,
        action,
        data: data as TResult,
        duration_ms: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        action,
        error: {
          code: "ACTION_FAILED",
          message: (error as Error).message,
          details: error,
        },
        duration_ms: Date.now() - startTime,
      };
    }
  }

  has(action: string): boolean {
    return this.actions.has(action);
  }

  list(): string[] {
    return Array.from(this.actions.keys());
  }
}

export function createActionRegistry(): ActionRegistry {
  return new ActionRegistry();
}
