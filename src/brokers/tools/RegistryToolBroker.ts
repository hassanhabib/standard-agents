import type { Tool } from "../../tools/Tool.js";
import type { ToolBroker } from "./ToolBroker.js";

// The tool registry as a broker: a map by case-insensitive name, and straight passes to the
// tool. A name nobody registered is the registry's own fault to raise; the foundation localises it.
export class RegistryToolBroker implements ToolBroker {
  private readonly tools: ReadonlyMap<string, Tool>;

  public constructor(tools: readonly Tool[]) {
    this.tools = new Map(tools.map((tool) => [tool.name.toLowerCase(), tool]));
  }

  public async has(name: string): Promise<boolean> {
    return this.tools.has(name.toLowerCase());
  }

  public async run(name: string, input: string): Promise<string> {
    return await this.select(name).execute(input);
  }

  public async compensate(name: string, input: string, outcome: string): Promise<string> {
    const tool = this.select(name);

    return (await tool.compensate?.(input, outcome)) ?? "";
  }

  private select(name: string): Tool {
    const tool = this.tools.get(name.toLowerCase());

    if (tool === undefined) {
      throw new RangeError(`no tool named '${name}' is registered`);
    }

    return tool;
  }
}
