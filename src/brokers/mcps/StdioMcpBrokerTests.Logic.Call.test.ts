import { describe, expect, it } from "vitest";

import { StdioMcpBroker } from "./StdioMcpBroker.js";
import { answer, createScriptedStdioServer, INITIALIZE_RESULT, methodOf } from "./StdioMcpBrokerTests.js";

describe("StdioMcpBroker call logic", () => {
  it("ShouldSkipWhatIsNotItsAnswerAndAnswerThePingsOfTheServerAsync", async () => {
    // given — a server that, before answering, logs a line to its output, sends a notification,
    // and pings the client with an id that collides with the client's own
    const server = createScriptedStdioServer((message) => {
      switch (methodOf(message)) {
        case "initialize":
          return [answer(message, INITIALIZE_RESULT)];
        case "tools/call":
          return [
            "server ready on stdio",
            JSON.stringify({ jsonrpc: "2.0", method: "notifications/message", params: { level: "info" } }),
            JSON.stringify({ jsonrpc: "2.0", id: message["id"], method: "ping" }),
            answer(message, { content: [{ type: "text", text: "pong received" }] }),
          ];
        default:
          return [];
      }
    });

    const mcpBroker = new StdioMcpBroker({ output: server.output, input: server.input });

    // when
    const actualText = await mcpBroker.call("lookup", "{}");

    // then — the answer is found past the noise, and the ping was answered, not taken as the answer
    expect(actualText).toBe("pong received");

    const pong = server.lines.at(-1);
    expect(pong?.["id"]).toBe(2);
    expect(pong?.["result"]).toEqual({});
    expect(pong?.["method"]).toBeUndefined();
  });

  it("ShouldCallAToolWithItsArgumentsAndReadEveryKindOfContentAsync", async () => {
    // given — a tool that answers with text, an embedded resource and a link
    const server = createScriptedStdioServer((message) =>
      methodOf(message) === "initialize"
        ? [answer(message, INITIALIZE_RESULT)]
        : methodOf(message) === "tools/call"
          ? [
              answer(message, {
                content: [
                  { type: "text", text: "student: " },
                  { type: "resource", resource: { uri: "students://1", text: "Hassan" } },
                  { type: "resource_link", uri: "file:///1.json", name: "record" },
                ],
              }),
            ]
          : [],
    );

    const mcpBroker = new StdioMcpBroker({ output: server.output, input: server.input });

    // when
    const actualText = await mcpBroker.call("find_student", JSON.stringify({ id: 1, deep: { n: 2 } }));

    // then — the arguments travel as the object the model wrote, and nothing returned is dropped
    expect(server.lines.at(-1)?.["params"]).toEqual({ name: "find_student", arguments: { id: 1, deep: { n: 2 } } });
    expect(actualText).toBe("student: Hassan[resource_link record: file:///1.json]");
  });

  it("ShouldThrowTheServersOwnWordsOnAJsonRpcErrorAsync", async () => {
    // given — a server that refuses the call with a protocol error
    const server = createScriptedStdioServer((message) =>
      methodOf(message) === "initialize"
        ? [answer(message, INITIALIZE_RESULT)]
        : methodOf(message) === "tools/call"
          ? [JSON.stringify({ jsonrpc: "2.0", id: message["id"], error: { code: -32602, message: "unknown tool" } })]
          : [],
    );

    const mcpBroker = new StdioMcpBroker({ output: server.output, input: server.input });

    // when
    const callAsync = mcpBroker.call("nope", "{}");

    // then
    await expect(callAsync).rejects.toThrow("unknown tool");
  });
});
