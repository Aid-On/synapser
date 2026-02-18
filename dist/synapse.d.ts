/**
 * SynapseR - Flow Runner
 *
 * 神経伝達フローを実行するランナー
 */
import type { Stimulus, StimulusType, StimulusContext, SynapseDecision, Response, Signal, SynapseFlow, StimulusHandler, SynapseHandler, ResponseHandler, SignalHandler, FlowRunnerOptions } from "./types";
export declare function createStimulus<TInput>(type: StimulusType, input: TInput, context?: StimulusContext): Stimulus<TInput>;
/** Chat stimulus helper */
export declare function chatStimulus(message: string, context?: StimulusContext): Stimulus<string>;
/** Event stimulus helper */
export declare function eventStimulus<T>(event: T, context?: StimulusContext): Stimulus<T>;
/** Webhook stimulus helper */
export declare function webhookStimulus<T>(payload: T, context?: StimulusContext): Stimulus<T>;
export declare class SynapseFlowBuilder<TInput = unknown, TData = unknown, TArtifact = unknown> {
    private _stimulus?;
    private _synapse?;
    private _response?;
    private _signal?;
    /** Stimulusハンドラーを設定 */
    stimulus(handler: StimulusHandler<TInput>): this;
    /** Synapseハンドラーを設定 */
    synapse(handler: SynapseHandler): this;
    /** Responseハンドラーを設定 */
    response(handler: ResponseHandler<TData>): this;
    /** Signalハンドラーを設定 */
    signal(handler: SignalHandler<TData, TArtifact>): this;
    /** Flowをビルド */
    build(): SynapseFlow<TInput, TData, TArtifact>;
}
export declare function createFlow<TInput = unknown, TData = unknown, TArtifact = unknown>(): SynapseFlowBuilder<TInput, TData, TArtifact>;
export interface FlowResult<TArtifact = unknown> {
    success: boolean;
    signal?: Signal<TArtifact>;
    error?: Error;
    phases: {
        stimulus?: {
            duration_ms: number;
            result: Stimulus;
        };
        synapse?: {
            duration_ms: number;
            result: SynapseDecision;
        };
        response?: {
            duration_ms: number;
            result: Response;
        };
        signal?: {
            duration_ms: number;
            result: Signal<TArtifact>;
        };
    };
    total_duration_ms: number;
}
export declare class FlowRunner<TInput = unknown, TData = unknown, TArtifact = unknown> {
    private flow;
    private options;
    constructor(flow: SynapseFlow<TInput, TData, TArtifact>, options?: FlowRunnerOptions);
    run(input: TInput): Promise<FlowResult<TArtifact>>;
    private detectFailedPhase;
}
export declare function runFlow<TInput, TData, TArtifact>(flow: SynapseFlow<TInput, TData, TArtifact>, input: TInput, options?: FlowRunnerOptions): Promise<FlowResult<TArtifact>>;
export type ActionExecutor<TParams = Record<string, unknown>, TResult = unknown> = (params: TParams) => Promise<TResult>;
export declare class ActionRegistry {
    private actions;
    register<TParams, TResult>(name: string, executor: ActionExecutor<TParams, TResult>): this;
    execute<TResult = unknown>(action: string, params: Record<string, unknown>): Promise<Response<TResult>>;
    has(action: string): boolean;
    list(): string[];
}
export declare function createActionRegistry(): ActionRegistry;
//# sourceMappingURL=synapse.d.ts.map