import type { UsageBroker } from "./UsageBroker.js";

// The reference's estimate: every word costs at least one token and one more per four characters.
export class RatioUsageBroker implements UsageBroker {
  private readonly charactersPerToken: number;

  public constructor(charactersPerToken = 4) {
    if (charactersPerToken <= 0) {
      throw new RangeError("Characters per token must be greater than zero.");
    }

    this.charactersPerToken = charactersPerToken;
  }

  public async countTokens(text: string): Promise<number> {
    if (text.trim().length === 0) {
      return 0;
    }

    return text
      .split(/\s+/)
      .filter((word) => word.length > 0)
      .reduce((tokens, word) => tokens + Math.max(1, Math.ceil(word.length / this.charactersPerToken)), 0);
  }
}
