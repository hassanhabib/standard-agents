// A skill as Data holds it (SPEC.md 4.2): its name, the description that is the catalog opt-in,
// and the instructions it contributes to the system prompt.
export interface Skill {
  readonly name: string;
  readonly description: string;
  readonly content: string;
}
