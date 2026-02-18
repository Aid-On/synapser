import { describe, it, expect } from "vitest";
import {
  weatherConverter,
  codeConverter,
  commandConverter,
} from "./artifact";

// =============================================================================
// Built-in Converters Tests
// =============================================================================

describe("weatherConverter", () => {
  it("should convert valid weather data", () => {
    const data = {
      location: "Tokyo",
      country: "Japan",
      temperature_c: "25",
      feels_like_c: "27",
      description: "Sunny",
      humidity: "60%",
      wind_speed_kmh: "10",
      wind_direction: "NE",
    };

    const result = weatherConverter(data, "get_weather");

    expect(result).toEqual({
      type: "weather",
      location: "Tokyo",
      country: "Japan",
      temperature: "25",
      feels_like: "27",
      description: "Sunny",
      humidity: "60%",
      wind: "10 km/h NE",
      icon: "sunny",
    });
  });

  it("should return null for invalid data", () => {
    const result = weatherConverter({}, "get_weather");
    expect(result).toBeNull();
  });

  it("should use temperature as feels_like if not provided", () => {
    const data = {
      location: "Tokyo",
      temperature_c: "20",
    };

    const result = weatherConverter(data, "get_weather");

    expect(result?.feels_like).toBe("20");
  });

  it("should map weather descriptions to icons", () => {
    const testCases = [
      { description: "Clear sky", expected: "sunny" },
      { description: "Partly cloudy", expected: "partly-cloudy" },
      { description: "Overcast", expected: "cloudy" },
      { description: "Light rain", expected: "rain" },
      { description: "Thunderstorm", expected: "storm" },
      { description: "Heavy snow", expected: "snow" },
      { description: "Foggy", expected: "fog" },
      { description: "Unknown condition", expected: "partly-cloudy" },
    ];

    testCases.forEach(({ description, expected }) => {
      const result = weatherConverter(
        { location: "Test", temperature_c: "20", description },
        "get_weather"
      );
      expect(result?.icon).toBe(expected);
    });
  });
});

describe("codeConverter", () => {
  it("should convert valid code data", () => {
    const data = {
      code: "console.log('hello')",
      language: "javascript",
      filename: "test.js",
    };

    const result = codeConverter(data, "execute_code");

    expect(result).toEqual({
      type: "code",
      code: "console.log('hello')",
      language: "javascript",
      filename: "test.js",
    });
  });

  it("should use plaintext as default language", () => {
    const data = { code: "some text" };

    const result = codeConverter(data, "execute_code");

    expect(result?.language).toBe("plaintext");
  });

  it("should return null if code is missing", () => {
    const result = codeConverter({} as unknown as { code: string; language?: string; filename?: string }, "execute_code");
    expect(result).toBeNull();
  });
});

describe("commandConverter", () => {
  it("should convert valid command data", () => {
    const data = {
      command: "ls -la",
      output: "file1.txt\nfile2.txt",
      status: "success",
    };

    const result = commandConverter(data, "run_command");

    expect(result).toEqual({
      type: "command",
      command: "ls -la",
      output: "file1.txt\nfile2.txt",
      status: "success",
    });
  });

  it("should default to success status", () => {
    const data = { command: "echo hello" };

    const result = commandConverter(data, "run_command");

    expect(result?.status).toBe("success");
  });

  it("should return null if command is missing", () => {
    const result = commandConverter({} as unknown as { command: string; output?: string; status?: string }, "run_command");
    expect(result).toBeNull();
  });
});

