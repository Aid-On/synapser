import { describe, it, expect, beforeEach } from "vitest";
import { chatStimulus, createFlow, runFlow, createActionRegistry, } from "./synapse";
// =============================================================================
// Action Registry Tests
// =============================================================================
describe("ActionRegistry", () => {
    let registry;
    beforeEach(() => {
        registry = createActionRegistry();
    });
    describe("register", () => {
        it("should register an action", () => {
            registry.register("get_weather", async () => ({ temp: 25 }));
            expect(registry.has("get_weather")).toBe(true);
        });
        it("should support method chaining", () => {
            const result = registry
                .register("action1", async () => undefined)
                .register("action2", async () => undefined);
            expect(result).toBe(registry);
            expect(registry.list()).toEqual(["action1", "action2"]);
        });
    });
    describe("execute", () => {
        it("should execute registered action", async () => {
            registry.register("get_weather", async (params) => ({
                temp: 25,
                location: params.location,
            }));
            const result = await registry.execute("get_weather", { location: "Tokyo" });
            expect(result.success).toBe(true);
            expect(result.action).toBe("get_weather");
            expect(result.data).toEqual({ temp: 25, location: "Tokyo" });
            expect(result.duration_ms).toBeGreaterThanOrEqual(0);
        });
        it("should return error for unregistered action", async () => {
            const result = await registry.execute("unknown_action", {});
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe("ACTION_NOT_FOUND");
            expect(result.error?.message).toContain("unknown_action");
        });
        it("should handle action execution errors", async () => {
            registry.register("failing_action", async () => {
                throw new Error("Something went wrong");
            });
            const result = await registry.execute("failing_action", {});
            expect(result.success).toBe(false);
            expect(result.error?.code).toBe("ACTION_FAILED");
            expect(result.error?.message).toBe("Something went wrong");
        });
    });
    describe("has", () => {
        it("should return true for registered actions", () => {
            registry.register("test", async () => undefined);
            expect(registry.has("test")).toBe(true);
            expect(registry.has("other")).toBe(false);
        });
    });
    describe("list", () => {
        it("should return all registered action names", () => {
            registry
                .register("weather", async () => undefined)
                .register("search", async () => undefined)
                .register("translate", async () => undefined);
            expect(registry.list()).toEqual(["weather", "search", "translate"]);
        });
        it("should return empty array when no actions registered", () => {
            expect(registry.list()).toEqual([]);
        });
    });
});
// =============================================================================
// Integration Tests
// =============================================================================
describe("Integration", () => {
    it("should work with ActionRegistry as response handler", async () => {
        const registry = createActionRegistry().register("get_weather", async (params) => {
            const location = params.location;
            return {
                location,
                temp: 25,
                condition: "sunny",
            };
        });
        const flow = createFlow()
            .stimulus((input) => chatStimulus(input))
            .synapse(async () => ({
            action: "get_weather",
            params: { location: "Tokyo" },
        }))
            .response((decision) => registry.execute(decision.action, decision.params))
            .signal((response) => ({
            artifact: { type: "weather" },
            message: response.success
                ? `${response.data?.location}: ${response.data?.temp}C, ${response.data?.condition}`
                : response.error?.message,
        }))
            .build();
        const result = await runFlow(flow, "東京の天気は？");
        expect(result.success).toBe(true);
        expect(result.signal?.message).toBe("Tokyo: 25C, sunny");
    });
    it("should type-check generics correctly", async () => {
        const flow = createFlow()
            .stimulus((msg) => chatStimulus(msg))
            .synapse(async () => ({ action: "weather", params: {} }))
            .response(async () => ({
            success: true,
            data: { temp: 20, humidity: 60 },
            action: "weather",
            duration_ms: 100,
        }))
            .signal((response) => ({
            artifact: {
                type: "weather",
                display: `${response.data?.temp}C / ${response.data?.humidity}%`,
            },
        }))
            .build();
        const result = await runFlow(flow, "Weather?");
        expect(result.signal?.artifact?.type).toBe("weather");
        expect(result.signal?.artifact?.display).toBe("20C / 60%");
    });
});
//# sourceMappingURL=action-registry.test.js.map