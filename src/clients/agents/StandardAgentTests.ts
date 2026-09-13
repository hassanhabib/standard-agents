import { randomUUID } from "node:crypto";

import type { Skill } from "../../models/foundations/skills/Skill.js";
import type { Tool } from "../../tools/Tool.js";

export function createRandomString(): string {
  return randomUUID();
}

export interface BrainCall {
  readonly systemPrompt: string;
  readonly userPrompt: string;
}

export interface ScriptedBrain {
  readonly calls: BrainCall[];
  generate(systemPrompt: string, userPrompt: string): Promise<string>;
}

// Replies in order, repeating the last, exactly as the conformance runner scripts a Brain.
export function createScriptedBrain(replies: readonly string[]): ScriptedBrain {
  const calls: BrainCall[] = [];

  return {
    calls,
    generate: async (systemPrompt, userPrompt) => {
      calls.push({ systemPrompt, userPrompt });

      return replies[Math.min(calls.length, replies.length) - 1] ?? "";
    },
  };
}

export interface StubTool extends Tool {
  readonly inputs: string[];
}

// A tool that records what it was called with and answers with one fixed output. A description
// is the advertisement opt-in, so a stub without one is callable but never listed.
export function createStubTool(name: string, output: string, description = ""): StubTool {
  const inputs: string[] = [];

  return {
    name,
    description,
    inputs,
    execute: async (input: string) => {
      inputs.push(input);

      return output;
    },
  };
}

export function createSkillSource(content: string): () => Promise<readonly Skill[]> {
  return async () => [{ name: "test", description: "", content }];
}
