import { describe, it, expect, vi } from "vitest";
import { createStimulus, chatStimulus, eventStimulus, webhookStimulus, createFlow, SynapseFlowBuilder, runFlow, FlowRunner, } from "./synapse";
describe("Stimulus Factory", () => {
    describe("createStimulus", () => {
        it("should create a stimulus with correct type and input", () => {
            const stimulus = createStimulus("chat", "Hello world");
            expect(stimulus.type).toBe("chat");
            expect(stimulus.input).toBe("Hello world");
            expect(stimulus.timestamp).toBeDefined();
            expect(stimulus.id).toBeDefined();
        });
        it("should include context when provided", () => {
            const context = { user: { id: "user-123", name: "Test User" } };
            const stimulus = createStimulus("chat", "Hello", context);
            expect(stimulus.context).toEqual(context);
        });
        it("should generate unique IDs", () => {
            const s1 = createStimulus("chat", "a");
            const s2 = createStimulus("chat", "b");
            expect(s1.id).not.toBe(s2.id);
        });
        it("should support custom stimulus types", () => {
            const stimulus = createStimulus("minecraft-event", { action: "build" });
            expect(stimulus.type).toBe("minecraft-event");
        });
    });
    describe("chatStimulus", () => {
        it("should create a chat type stimulus", () => {
            const stimulus = chatStimulus("東京の天気は？");
            expect(stimulus.type).toBe("chat");
            expect(stimulus.input).toBe("東京の天気は？");
        });
        it("should include session history in context", () => {
            const stimulus = chatStimulus("Follow up", {
                session: {
                    id: "session-1",
                    history: [{ role: "user", content: "Previous message" }],
                },
            });
            expect(stimulus.context?.session?.history).toHaveLength(1);
        });
    });
    describe("eventStimulus", () => {
        it("should create an event type stimulus", () => {
            const event = { type: "player_join", player: "Steve" };
            const stimulus = eventStimulus(event);
            expect(stimulus.type).toBe("event");
            expect(stimulus.input).toEqual(event);
        });
    });
    describe("webhookStimulus", () => {
        it("should create a webhook type stimulus", () => {
            const payload = { action: "push", repository: "test-repo" };
            const stimulus = webhookStimulus(payload);
            expect(stimulus.type).toBe("webhook");
            expect(stimulus.input).toEqual(payload);
        });
    });
});
describe("SynapseFlowBuilder", () => {
    it("should build a complete flow", () => {
        const flow = createFlow()
            .stimulus((input) => chatStimulus(input))
            .synapse(async () => ({ action: "test", params: {} }))
            .response(async () => ({
            success: true,
            data: { result: "ok" },
            action: "test",
            duration_ms: 10,
        }))
            .signal(() => ({ artifact: { type: "test" } }))
            .build();
        expect(flow.stimulus).toBeDefined();
        expect(flow.synapse).toBeDefined();
        expect(flow.response).toBeDefined();
        expect(flow.signal).toBeDefined();
    });
    it("should throw if stimulus handler is missing", () => {
        const builder = createFlow()
            .synapse(async () => ({ action: "test", params: {} }))
            .response(async () => ({
            success: true,
            action: "test",
            duration_ms: 0,
        }))
            .signal(() => ({}));
        expect(() => builder.build()).toThrow("Stimulus handler is required");
    });
    it("should throw if synapse handler is missing", () => {
        const builder = createFlow()
            .stimulus((input) => chatStimulus(String(input)))
            .response(async () => ({
            success: true,
            action: "test",
            duration_ms: 0,
        }))
            .signal(() => ({}));
        expect(() => builder.build()).toThrow("Synapse handler is required");
    });
    it("should throw if response handler is missing", () => {
        const builder = createFlow()
            .stimulus((input) => chatStimulus(String(input)))
            .synapse(async () => ({ action: "test", params: {} }))
            .signal(() => ({}));
        expect(() => builder.build()).toThrow("Response handler is required");
    });
    it("should throw if signal handler is missing", () => {
        const builder = createFlow()
            .stimulus((input) => chatStimulus(String(input)))
            .synapse(async () => ({ action: "test", params: {} }))
            .response(async () => ({
            success: true,
            action: "test",
            duration_ms: 0,
        }));
        expect(() => builder.build()).toThrow("Signal handler is required");
    });
    it("should support method chaining", () => {
        const builder = new SynapseFlowBuilder();
        const result = builder.stimulus((input) => chatStimulus(String(input)));
        expect(result).toBe(builder);
    });
});
describe("FlowRunner", () => {
    const createTestFlow = () => createFlow()
        .stimulus((input) => chatStimulus(input))
        .synapse(async () => ({
        action: "get_weather",
        params: { location: "Tokyo" },
    }))
        .response(async () => ({
        success: true,
        data: { weather: "sunny" },
        action: "get_weather",
        duration_ms: 50,
    }))
        .signal((response) => ({
        artifact: { type: "weather", temp: "25" },
        message: `Weather: ${response.data?.weather}`,
    }))
        .build();
    describe("runFlow", () => {
        it("should execute all phases successfully", async () => {
            const flow = createTestFlow();
            const result = await runFlow(flow, "東京の天気は？");
            expect(result.success).toBe(true);
            expect(result.signal?.artifact?.type).toBe("weather");
            expect(result.signal?.message).toBe("Weather: sunny");
        });
        it("should track phase durations", async () => {
            const flow = createTestFlow();
            const result = await runFlow(flow, "test");
            expect(result.phases.stimulus?.duration_ms).toBeDefined();
            expect(result.phases.synapse?.duration_ms).toBeDefined();
            expect(result.phases.response?.duration_ms).toBeDefined();
            expect(result.phases.signal?.duration_ms).toBeDefined();
            // total_duration_ms can be 0 on fast systems, just check it's defined
            expect(result.total_duration_ms).toBeGreaterThanOrEqual(0);
        });
        it("should handle noAction decision", async () => {
            const flow = createFlow()
                .stimulus((input) => chatStimulus(input))
                .synapse(async () => ({
                action: "none",
                params: {},
                noAction: true,
                reasoning: "No action needed for greeting",
            }))
                .response(async () => ({
                success: true,
                action: "none",
                duration_ms: 0,
            }))
                .signal(() => ({}))
                .build();
            const result = await runFlow(flow, "Hello!");
            expect(result.success).toBe(true);
            expect(result.signal?.message).toBe("No action needed for greeting");
            expect(result.phases.response).toBeUndefined();
        });
        it("should call onPhaseComplete callbacks", async () => {
            const flow = createTestFlow();
            const phases = [];
            await runFlow(flow, "test", {
                onPhaseComplete: (phase) => phases.push(phase),
            });
            expect(phases).toEqual(["stimulus", "synapse", "response", "signal"]);
        });
        it("should handle errors and call onError", async () => {
            const errorFlow = createFlow()
                .stimulus((input) => chatStimulus(input))
                .synapse(async () => {
                throw new Error("LLM API error");
            })
                .response(async () => ({
                success: true,
                action: "test",
                duration_ms: 0,
            }))
                .signal(() => ({}))
                .build();
            const onError = vi.fn();
            const result = await runFlow(errorFlow, "test", { onError });
            expect(result.success).toBe(false);
            expect(result.error?.message).toBe("LLM API error");
            expect(onError).toHaveBeenCalledWith(expect.any(Error), "synapse");
        });
        it("should detect correct failed phase", async () => {
            const responseErrorFlow = createFlow()
                .stimulus((input) => chatStimulus(input))
                .synapse(async () => ({ action: "test", params: {} }))
                .response(async () => {
                throw new Error("Tool execution failed");
            })
                .signal(() => ({}))
                .build();
            const onError = vi.fn();
            await runFlow(responseErrorFlow, "test", { onError });
            expect(onError).toHaveBeenCalledWith(expect.any(Error), "response");
        });
    });
    describe("FlowRunner class", () => {
        it("should be instantiable directly", async () => {
            const flow = createTestFlow();
            const runner = new FlowRunner(flow);
            const result = await runner.run("test");
            expect(result.success).toBe(true);
        });
        it("should accept debug option without error", async () => {
            const flow = createTestFlow();
            const result = await runFlow(flow, "test", { debug: true });
            expect(result.success).toBe(true);
        });
    });
});
//# sourceMappingURL=synapse.test.js.map