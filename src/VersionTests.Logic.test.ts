import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { STANDARD_AGENTS_VERSION } from "./Version.js";

// The version the package names itself by on the wire (the User-Agent of every model request, the
// clientInfo of every MCP session) is the version that was published, or a server operator
// reading their logs is told a release that never shipped.
describe("Version logic", () => {
  it("ShouldNameItselfByThePublishedVersion", () => {
    // given
    const packagePath = join(dirname(fileURLToPath(import.meta.url)), "..", "package.json");
    const publishedVersion = (JSON.parse(readFileSync(packagePath, "utf8")) as { version: string }).version;

    // when
    const actualVersion = STANDARD_AGENTS_VERSION;

    // then
    expect(actualVersion).toBe(publishedVersion);
  });
});
