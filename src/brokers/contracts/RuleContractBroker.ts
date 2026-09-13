import type { ContractBroker } from "./ContractBroker.js";

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

// A deterministic JSON Schema check over the subset a contract needs: the root type, required
// members and member types. No library; the same rules the reference applies.
export class RuleContractBroker implements ContractBroker {
  public async validate(answer: string, schema: string): Promise<string | null> {
    if (schema.trim().length === 0) {
      return null;
    }

    let schemaRoot: JsonValue;

    try {
      schemaRoot = JSON.parse(schema) as JsonValue;
    } catch {
      throw new SyntaxError("The contract schema is not valid JSON.");
    }

    let answerRoot: JsonValue;

    try {
      answerRoot = JSON.parse(answer) as JsonValue;
    } catch {
      return "the answer is not valid JSON; reply with JSON only and no surrounding prose";
    }

    return check(answerRoot, schemaRoot);
  }
}

function check(answer: JsonValue, schema: JsonValue): string | null {
  if (!isObject(schema)) {
    return null;
  }

  const expectedType = schema["type"];

  if (typeof expectedType === "string" && !matches(answer, expectedType)) {
    return `expected ${expectedType} but the answer was ${describe(answer)}`;
  }

  if (!isObject(answer)) {
    return null;
  }

  const required = schema["required"];

  if (Array.isArray(required)) {
    for (const member of required) {
      if (typeof member === "string" && member.length > 0 && !(member in answer)) {
        return `the required member '${member}' is missing`;
      }
    }
  }

  const properties = schema["properties"];

  if (isObject(properties)) {
    for (const [name, property] of Object.entries(properties)) {
      const memberType = isObject(property) ? property["type"] : undefined;
      const value = answer[name];

      if (value !== undefined && typeof memberType === "string" && !matches(value, memberType)) {
        return `member '${name}' should be ${memberType} but was ${describe(value)}`;
      }
    }
  }

  return null;
}

function isObject(value: JsonValue | undefined): value is { [key: string]: JsonValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function matches(value: JsonValue, expectedType: string): boolean {
  switch (expectedType) {
    case "object":
      return isObject(value);
    case "array":
      return Array.isArray(value);
    case "string":
      return typeof value === "string";
    case "number":
      return typeof value === "number";
    case "integer":
      return typeof value === "number" && Number.isInteger(value);
    case "boolean":
      return typeof value === "boolean";
    case "null":
      return value === null;
    default:
      return true;
  }
}

function describe(value: JsonValue): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "an array";
  if (typeof value === "object") return "an object";
  return `a ${typeof value}`;
}
