import { describe, expect, it } from "vitest";

import {
  acceptedReply,
  createHttpMcpBrokerTests,
  errorReply,
  INITIALIZE_RESULT,
  jsonReply,
  methodOf,
  type RecordedMcpRequest,
} from "./HttpMcpBrokerTests.js";

function serverAnsweringCallsWith(answer: (request: RecordedMcpRequest) => Response): (request: RecordedMcpRequest) => Response {
  return (request) => {
    switch (methodOf(request)) {
      case "initialize":
        return jsonReply(INITIALIZE_RESULT);
      case "notifications/initialized":
        return acceptedReply();
      default:
        return answer(request);
    }
  };
}

describe("HttpMcpBroker call logic", () => {
  it("ShouldCallAToolWithItsArgumentsAndReadEveryKindOfContentAsync", async () => {
    // given — a tool answering with more than text: an embedded resource, a link, an image
    const { requests, mcpBroker } = createHttpMcpBrokerTests(
      serverAnsweringCallsWith(() =>
        jsonReply({
          content: [
            { type: "text", text: "student: " },
            { type: "resource", resource: { uri: "students://1", mimeType: "text/plain", text: "Hassan" } },
            { type: "resource_link", uri: "file:///1.json", name: "record" },
            { type: "image", data: "iVBORw0KGgo=", mimeType: "image/png" },
          ],
        }),
      ),
    );

    // when
    const actualText = await mcpBroker.call("find_student", JSON.stringify({ id: 1, deep: { n: 2 } }));

    // then — the arguments travel as the object the model wrote, and nothing returned is dropped
    const call = requests.at(-1);
    expect(call?.body["method"]).toBe("tools/call");
    expect(call?.body["params"]).toEqual({ name: "find_student", arguments: { id: 1, deep: { n: 2 } } });
    expect(actualText).toBe("student: Hassan[resource_link record: file:///1.json][image image/png]");
  });

  it("ShouldReadStructuredContentWhenATextBlockIsAbsentAsync", async () => {
    // given — a tool answering only with structured content
    const { mcpBroker } = createHttpMcpBrokerTests(
      serverAnsweringCallsWith(() => jsonReply({ content: [], structuredContent: { account: "42", owed: 12 } })),
    );

    // when
    const actualText = await mcpBroker.call("lookup", "{}");

    // then
    expect(actualText).toBe(JSON.stringify({ account: "42", owed: 12 }));
  });

  it("ShouldThrowTheServersOwnWordsOnAJsonRpcErrorAsync", async () => {
    // given — a server that refuses the call with a protocol error
    const { mcpBroker } = createHttpMcpBrokerTests(serverAnsweringCallsWith(() => errorReply(-32602, "unknown tool")));

    // when
    const callAsync = mcpBroker.call("nope", "{}");

    // then — raised for the foundation to localize, never answered as if it were the tool's result
    await expect(callAsync).rejects.toThrow("unknown tool");
  });
});
