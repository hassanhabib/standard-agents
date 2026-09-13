import type { ResolvedInference } from "../../models/brokers/generators/ResolvedInference.js";
import { HttpResponseException } from "../../models/brokers/https/HttpResponseException.js";
import type { GeneratorBroker } from "./GeneratorBroker.js";

interface ChatCompletionResponse {
  readonly choices?: ReadonlyArray<{ readonly message?: { readonly content?: string | null } }>;
}

// An OpenAI-compatible chat completion over HTTP: the External mode of the brain (SPEC.md 4.8).
// The base URL is the /v1/ root; the broker owns the route. A single straight pass to the wire.
export class HttpGeneratorBroker implements GeneratorBroker {
  public readonly honorsRequest = true;
  private readonly apiUrl: string;
  private readonly apiKey: string;
  private readonly model: string;

  public constructor(apiUrl: string, apiKey: string, model: string) {
    this.apiUrl = apiUrl.endsWith("/") ? apiUrl : `${apiUrl}/`;
    this.apiKey = apiKey;
    this.model = model;
  }

  public async generate(systemPrompt: string, userPrompt: string, inference?: ResolvedInference): Promise<string> {
    const response = await fetch(`${this.apiUrl}chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: this.model,
        stream: false,
        temperature: inference?.temperature,
        max_tokens: inference?.maxTokens,
        seed: inference?.seed ?? undefined,
        stop: inference !== undefined && inference.stop.length > 0 ? inference.stop : undefined,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    const body = await response.text();

    if (!response.ok) {
      throw new HttpResponseException(response.status, body);
    }

    const completion = JSON.parse(body) as ChatCompletionResponse;

    return completion.choices?.[0]?.message?.content ?? "";
  }
}
