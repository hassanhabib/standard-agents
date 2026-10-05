import type { McpTool } from "../../models/brokers/mcps/McpTool.js";
import type { McpBroker } from "./McpBroker.js";

// Many remote tool servers behind one seam (SPEC.md 4.8, plural integrations): each server's own
// catalog says what it holds, a call routes to the server that holds the name, and the first
// registered wins a name two of them claim. A server that cannot list its tools at discovery
// keeps only its own slot empty and is asked again on the next call: its outage must not take
// the other servers' tools with it, and must not be cached as "has no tools".
export class CompositeMcpBroker implements McpBroker {
  private readonly brokers: readonly McpBroker[];
  private readonly catalogs: (readonly McpTool[] | null)[];
  private discovery: Promise<void> | null = null;

  public constructor(brokers: readonly McpBroker[]) {
    this.brokers = [...brokers];
    this.catalogs = this.brokers.map(() => null);
  }

  public async call(name: string, argumentsJson: string, signal?: AbortSignal): Promise<string> {
    const owner = await this.resolve(name);

    return owner === null
      ? `[external '${name}' not configured]`
      : await owner.call(name, argumentsJson, signal);
  }

  public async listTools(): Promise<readonly McpTool[]> {
    await this.discover();

    const seen = new Set<string>();
    const union: McpTool[] = [];

    for (const tool of this.catalogs.flatMap((catalog) => catalog ?? [])) {
      if (seen.has(tool.name) === false) {
        seen.add(tool.name);
        union.push(tool);
      }
    }

    return union;
  }

  private async resolve(name: string): Promise<McpBroker | null> {
    await this.discover();

    const ownerIndex = this.catalogs.findIndex((catalog) => catalog?.some((tool) => tool.name === name) === true);

    return ownerIndex < 0 ? null : (this.brokers[ownerIndex] ?? null);
  }

  private async discover(): Promise<void> {
    if (this.catalogs.every((catalog) => catalog !== null)) {
      return;
    }

    this.discovery ??= this.discoverMissing().finally(() => {
      this.discovery = null;
    });

    await this.discovery;
  }

  private async discoverMissing(): Promise<void> {
    await Promise.all(
      this.brokers.map(async (broker, index) => {
        if (this.catalogs[index] !== null) {
          return;
        }

        try {
          this.catalogs[index] = await broker.listTools();
        } catch {
          this.catalogs[index] = null;
        }
      }),
    );
  }
}
