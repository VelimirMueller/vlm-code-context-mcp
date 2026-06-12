import { describe, it, expect } from "vitest";
import { modelToTier, formatModelRouting } from "../src/scrum/agent-model.js";

describe("modelToTier", () => {
  it("maps fable/opus/sonnet/haiku ids to Task-tool tiers", () => {
    expect(modelToTier("claude-fable-5")).toBe("fable");
    expect(modelToTier("claude-opus-4-8")).toBe("opus");
    expect(modelToTier("claude-sonnet-4-6")).toBe("sonnet");
    expect(modelToTier("claude-haiku-4-5")).toBe("haiku");
  });
  it("defaults unknown/null/undefined to sonnet", () => {
    expect(modelToTier(null)).toBe("sonnet");
    expect(modelToTier(undefined)).toBe("sonnet");
    expect(modelToTier("gpt-9")).toBe("sonnet");
  });
});

describe("formatModelRouting", () => {
  it("includes the role, the tier, and the Task-tool instruction", () => {
    const md = formatModelRouting("fe-engineer", "claude-fable-5");
    expect(md).toContain("## Model routing");
    expect(md).toContain("fe-engineer");
    expect(md).toContain('model: "fable"');
    expect(md).toContain("Task tool");
  });
  it("renders the tier even when the model id is null", () => {
    expect(formatModelRouting("qa", null)).toContain('model: "sonnet"');
  });
});
