export type Tier = "opus" | "sonnet" | "haiku" | "fable";

/** Map a stored agent model id to the Task-tool subagent tier. Unknown/null → "sonnet". */
export function modelToTier(modelId: string | null | undefined): Tier {
  if (!modelId) return "sonnet";
  if (modelId.startsWith("claude-fable")) return "fable";
  if (modelId.startsWith("claude-opus")) return "opus";
  if (modelId.startsWith("claude-haiku")) return "haiku";
  return "sonnet";
}

/**
 * Build the "Model routing" directive appended to a ticket's context. Tells the
 * session to implement the ticket by spawning a subagent at the assigned tier.
 * Routing is tier-level (opus/sonnet/haiku); the exact minor version is not pinned.
 */
export function formatModelRouting(role: string, modelId: string | null | undefined): string {
  const tier = modelToTier(modelId);
  return [
    "## Model routing",
    `This ticket is assigned to **${role}** (model \`${modelId ?? "default"}\` → tier \`${tier}\`).`,
    `Implement it by spawning a subagent: **Task tool with \`model: "${tier}"\`**. Give the subagent the ticket's title, description, and acceptance criteria (for \`fe-engineer\`, also load the frontend playbook). Have it implement and report back; then run the QA gate and mark the ticket DONE.`,
  ].join("\n");
}
