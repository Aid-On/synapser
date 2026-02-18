import { describe, it, expect } from "vitest";
import { createArtifactReporter, createSignalHandler, } from "./artifact";
// =============================================================================
// ArtifactReporter Tests
// =============================================================================
describe("ArtifactReporter", () => {
    describe("constructor", () => {
        it("should register built-in converters by default", () => {
            const reporter = createArtifactReporter();
            const weatherResponse = {
                success: true,
                action: "get_weather",
                data: { location: "Tokyo", temperature_c: "25", description: "Clear" },
                duration_ms: 100,
            };
            const signal = reporter.report(weatherResponse);
            expect(signal.artifact?.type).toBe("weather");
        });
        it("should allow custom converters to override built-ins", () => {
            const customWeatherConverter = () => ({
                type: "weather",
                location: "Custom",
                temperature: "0",
                feels_like: "0",
                description: "Custom weather",
                humidity: "0",
                wind: "0",
                icon: "custom",
            });
            const reporter = createArtifactReporter({
                converters: { get_weather: customWeatherConverter },
            });
            const response = {
                success: true,
                action: "get_weather",
                data: { location: "Tokyo", temperature_c: "25" },
                duration_ms: 100,
            };
            const signal = reporter.report(response);
            expect(signal.artifact?.location).toBe("Custom");
        });
    });
    describe("register", () => {
        it("should register custom converter", () => {
            const reporter = createArtifactReporter();
            reporter.register("minecraft_build", (data) => ({
                type: "minecraft",
                structure: data.structure,
                status: "built",
            }));
            const response = {
                success: true,
                action: "minecraft_build",
                data: { structure: "house" },
                duration_ms: 50,
            };
            const signal = reporter.report(response);
            expect(signal.artifact).toEqual({
                type: "minecraft",
                structure: "house",
                status: "built",
            });
        });
        it("should support method chaining", () => {
            const reporter = createArtifactReporter();
            const result = reporter
                .register("action1", () => ({ type: "test1" }))
                .register("action2", () => ({ type: "test2" }));
            expect(result).toBe(reporter);
        });
    });
    describe("report", () => {
        it("should handle error responses", () => {
            const reporter = createArtifactReporter();
            const response = {
                success: false,
                action: "get_weather",
                error: { code: "API_ERROR", message: "Failed to fetch weather" },
                duration_ms: 100,
            };
            const signal = reporter.report(response);
            expect(signal.message).toBe("Failed to fetch weather");
            expect(signal.meta?.error).toEqual(response.error);
            expect(signal.artifact).toBeUndefined();
        });
        it("should handle missing converter gracefully", () => {
            const reporter = createArtifactReporter();
            const response = {
                success: true,
                action: "unknown_action",
                data: { some: "data" },
                duration_ms: 50,
            };
            const signal = reporter.report(response);
            expect(signal.artifact).toBeUndefined();
            expect(signal.meta?.action).toBe("unknown_action");
        });
        it("should include duration in meta", () => {
            const reporter = createArtifactReporter();
            const response = {
                success: true,
                action: "get_weather",
                data: { location: "Tokyo", temperature_c: "25" },
                duration_ms: 150,
            };
            const signal = reporter.report(response);
            expect(signal.meta?.duration_ms).toBe(150);
        });
        it("should use defaultMessage function", () => {
            const reporter = createArtifactReporter({
                defaultMessage: (response) => response.success
                    ? `Action ${response.action} completed`
                    : `Action ${response.action} failed`,
            });
            const response = {
                success: true,
                action: "test_action",
                data: {},
                duration_ms: 10,
            };
            const signal = reporter.report(response);
            expect(signal.message).toBe("Action test_action completed");
        });
        it("should handle converter returning null", () => {
            const reporter = createArtifactReporter();
            reporter.register("maybe_artifact", (data) => {
                const d = data;
                return d.valid ? { type: "valid" } : null;
            });
            const response = {
                success: true,
                action: "maybe_artifact",
                data: { valid: false },
                duration_ms: 10,
            };
            const signal = reporter.report(response);
            expect(signal.artifact).toBeUndefined();
        });
    });
});
// =============================================================================
// Signal Handler Factory Tests
// =============================================================================
describe("createSignalHandler", () => {
    it("should create a signal handler function", () => {
        const handler = createSignalHandler();
        const response = {
            success: true,
            action: "get_weather",
            data: { location: "Tokyo", temperature_c: "20" },
            duration_ms: 100,
        };
        const signal = handler(response);
        expect(signal.artifact?.type).toBe("weather");
    });
    it("should accept custom options", () => {
        const handler = createSignalHandler({
            converters: {
                minecraft_action: (data) => {
                    const d = data;
                    return {
                        type: "minecraft",
                        action: d.action,
                    };
                },
            },
        });
        const response = {
            success: true,
            action: "minecraft_action",
            data: { action: "build" },
            duration_ms: 50,
        };
        const signal = handler(response);
        expect(signal.artifact?.type).toBe("minecraft");
        expect(signal.artifact?.action).toBe("build");
    });
});
// =============================================================================
// Type Safety Tests
// =============================================================================
describe("Type Safety", () => {
    it("should work with CustomArtifact type", () => {
        const reporter = createArtifactReporter();
        reporter.register("game_result", (data) => {
            const d = data;
            return {
                type: "game",
                score: d.score,
                level: d.level,
            };
        });
        const response = {
            success: true,
            action: "game_result",
            data: { score: 1000, level: "hard" },
            duration_ms: 10,
        };
        const signal = reporter.report(response);
        expect(signal.artifact?.type).toBe("game");
    });
});
//# sourceMappingURL=artifact-reporter.test.js.map