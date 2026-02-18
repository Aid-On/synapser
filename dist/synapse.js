/**
 * SynapseR - Flow Runner
 *
 * 神経伝達フローを実行するランナー
 */
// =============================================================================
// Stimulus Factory
// =============================================================================
export function createStimulus(type, input, context) {
    return {
        type,
        input,
        context,
        timestamp: Date.now(),
        id: crypto.randomUUID(),
    };
}
/** Chat stimulus helper */
export function chatStimulus(message, context) {
    return createStimulus("chat", message, context);
}
/** Event stimulus helper */
export function eventStimulus(event, context) {
    return createStimulus("event", event, context);
}
/** Webhook stimulus helper */
export function webhookStimulus(payload, context) {
    return createStimulus("webhook", payload, context);
}
// =============================================================================
// Flow Builder
// =============================================================================
export class SynapseFlowBuilder {
    _stimulus;
    _synapse;
    _response;
    _signal;
    /** Stimulusハンドラーを設定 */
    stimulus(handler) {
        this._stimulus = handler;
        return this;
    }
    /** Synapseハンドラーを設定 */
    synapse(handler) {
        this._synapse = handler;
        return this;
    }
    /** Responseハンドラーを設定 */
    response(handler) {
        this._response = handler;
        return this;
    }
    /** Signalハンドラーを設定 */
    signal(handler) {
        this._signal = handler;
        return this;
    }
    /** Flowをビルド */
    build() {
        if (!this._stimulus)
            throw new Error("Stimulus handler is required");
        if (!this._synapse)
            throw new Error("Synapse handler is required");
        if (!this._response)
            throw new Error("Response handler is required");
        if (!this._signal)
            throw new Error("Signal handler is required");
        return {
            stimulus: this._stimulus,
            synapse: this._synapse,
            response: this._response,
            signal: this._signal,
        };
    }
}
export function createFlow() {
    return new SynapseFlowBuilder();
}
export class FlowRunner {
    flow;
    options;
    constructor(flow, options = {}) {
        this.flow = flow;
        this.options = options;
        // Parameter properties are initialized by TypeScript
    }
    async run(input) {
        const startTime = Date.now();
        const phases = {};
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
                const signal = { message: decision.reasoning };
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
        }
        catch (error) {
            const phase = this.detectFailedPhase(phases);
            this.options.onError?.(error, phase);
            return {
                success: false,
                error: error,
                phases,
                total_duration_ms: Date.now() - startTime,
            };
        }
    }
    detectFailedPhase(phases) {
        if (!phases.stimulus)
            return "stimulus";
        if (!phases.synapse)
            return "synapse";
        if (!phases.response)
            return "response";
        return "signal";
    }
}
export function runFlow(flow, input, options) {
    return new FlowRunner(flow, options).run(input);
}
export class ActionRegistry {
    actions = new Map();
    register(name, executor) {
        this.actions.set(name, executor);
        return this;
    }
    async execute(action, params) {
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
                data: data,
                duration_ms: Date.now() - startTime,
            };
        }
        catch (error) {
            return {
                success: false,
                action,
                error: {
                    code: "ACTION_FAILED",
                    message: error.message,
                    details: error,
                },
                duration_ms: Date.now() - startTime,
            };
        }
    }
    has(action) {
        return this.actions.has(action);
    }
    list() {
        return Array.from(this.actions.keys());
    }
}
export function createActionRegistry() {
    return new ActionRegistry();
}
//# sourceMappingURL=synapse.js.map