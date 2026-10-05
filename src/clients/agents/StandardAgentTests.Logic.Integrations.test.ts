import { describe, expect, it } from "vitest";

import type { McpBroker } from "../../brokers/mcps/McpBroker.js";
import type { McpTool } from "../../models/brokers/mcps/McpTool.js";
import { StandardAgent } from "./StandardAgent.js";
import { createRandomString, createScriptedBrain } from "./StandardAgentTests.js";

// The integration rule (SPEC.md 4.8, plural integrations): a second remote tool server adds, and
// never silently discards the first. Calls route to the server whose own catalog owns the name,
// the first registered winning a name two of them claim.

interface RecordingServer extends McpBroker {
  readonly calls: string[];
}

function createServer(tools: readonly string[], answer: string): RecordingServer {
  const calls: string[] = [];

  return {
    calls,
    call: async (name) => {
      calls.push(name);

      return answer;
    },
    listTools: async (): Promise<readonly McpTool[]> =>
      tools.map((name) => ({ name, description: `${name} tool`, inputSchemaJson: "{}" })),
  };
}

describe("StandardAgent integration logic", () => {
  it("ShouldRouteAcrossMultipleMcpServersByToolNameAsync", async () => {
    // given — two servers, the first owning 'alpha', both claiming 'shared'
    const firstServer = createServer(["alpha", "shared"], "from the first server");
    const secondServer = createServer(["beta", "shared"], "from the second server");
    const brain = createScriptedBrain(["ACTION: alpha: ping", "ACTION: shared: ping", "FINAL: done"]);

    const agent = new StandardAgent().onBrain(brain.generate).useMcp(firstServer).useMcp(secondServer);

    // when
    await agent.processPrompt(createRandomString());

    // then — the owner of each name answered it, and the first registered won the shared name
    expect(firstServer.calls).toEqual(["alpha", "shared"]);
    expect(secondServer.calls).toEqual([]);
  });

  it("ShouldKeepTheOtherServersWhenOneIsDownAtDiscoveryAsync", async () => {
    // given — a server that can list its tools, and one registered after it that cannot
    const downServer: McpBroker = {
      call: async () => "never",
      listTools: async () => {
        throw new Error("connection refused");
      },
    };

    const upServer = createServer(["beta"], "from the server that is up");
    const brain = createScriptedBrain(["ACTION: beta: ping", "FINAL: done"]);
    const agent = new StandardAgent().onBrain(brain.generate).useMcp(upServer).useMcp(downServer);

    // when
    await agent.processPrompt(createRandomString());

    // then — one server's outage did not take the other's tools with it
    expect(upServer.calls).toEqual(["beta"]);
    expect(brain.calls[1]?.userPrompt).toContain("from the server that is up");
  });
});
