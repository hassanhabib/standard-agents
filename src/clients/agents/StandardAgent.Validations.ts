import type { GeneratorBroker } from "../../brokers/generators/GeneratorBroker.js";
import type { AgentConfiguration } from "../../models/clients/agents/AgentConfiguration.js";
import { InvalidAgentApiUrlException } from "../../models/clients/agents/exceptions/InvalidAgentApiUrlException.js";
import { InvalidAgentBudgetException } from "../../models/clients/agents/exceptions/InvalidAgentBudgetException.js";
import { InvalidAgentCompositionException } from "../../models/clients/agents/exceptions/InvalidAgentCompositionException.js";
import type { AgentBudget } from "../../models/coordinations/agents/AgentBudget.js";

// The validation partial: what the client refuses before any run starts. A composition with no
// way to think, an endpoint that is not a base, a cost bound that can never trip.
export function requireBrain(configuration: AgentConfiguration): GeneratorBroker {
  if (configuration.generatorBroker === null) {
    throw new InvalidAgentCompositionException(
      "Agent has no brain. Call brain(apiUrl, apiKey, model), useGenerator(broker) or onBrain(generate) before processing a prompt.",
    );
  }

  return configuration.generatorBroker;
}

// An endpoint is the base the route is appended to, so its shape is load-bearing: an absolute
// http(s) URL ending with '/', that does not name chat/completions itself, because the broker
// owns the route and a base that carries it would reach it twice.
export function validateApiUrl(apiUrl: string): void {
  let endpoint: URL | null;

  try {
    endpoint = new URL(apiUrl);
  } catch {
    endpoint = null;
  }

  const isAbsoluteHttp = endpoint !== null && (endpoint.protocol === "http:" || endpoint.protocol === "https:");
  const namesTheRoute = apiUrl.replace(/\/+$/, "").toLowerCase().endsWith("/chat/completions");

  if (!isAbsoluteHttp || !apiUrl.endsWith("/") || namesTheRoute) {
    throw new InvalidAgentApiUrlException(
      "Invalid agent API URL. An endpoint is the base the route is appended to: an absolute http(s) URL ending with '/', such as https://api.example.com/v1/, that does not name chat/completions itself.",
    );
  }
}

// Spend is the token count times the rate, so a cost bound with no positive rate computes zero
// forever and never trips. The framework cannot know what a model costs; it can refuse the
// contradiction of a dollar bound on a model declared free.
export function validateBudget(budget: AgentBudget): void {
  if (budget.maxCostUsd !== null && budget.costPerThousandTokens <= 0) {
    throw new InvalidAgentBudgetException(
      "Invalid agent budget: a cost bound (maxCostUsd) needs a positive costPerThousandTokens. Cost is the token count times that rate, so at zero the bound can never trip. Pass your model's rate, or bound by maxTokens instead.",
    );
  }
}
