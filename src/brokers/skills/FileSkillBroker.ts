import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

import type { Skill } from "../../models/foundations/skills/Skill.js";
import type { SkillBroker } from "./SkillBroker.js";

const FRONTMATTER_FENCE = "---";

// Skills as Markdown files under a folder, recursively; the front matter's name and description
// when present, the relative path as the fallback name. The same shape the reference reads.
export class FileSkillBroker implements SkillBroker {
  private readonly skillsPath: string;
  private readonly extension: string;

  public constructor(skillsPath: string, extension = ".md") {
    this.skillsPath = skillsPath;
    this.extension = extension;
  }

  public async selectSkills(): Promise<readonly Skill[]> {
    const exists = await stat(this.skillsPath).then((info) => info.isDirectory(), () => false);

    if (!exists) {
      return [];
    }

    const skills: Skill[] = [];

    for (const filePath of await this.enumerateFiles(this.skillsPath)) {
      const rawContent = await readFile(filePath, "utf8");
      const relativeName = relative(this.skillsPath, filePath).replace(/\\/g, "/");
      skills.push(buildSkill(relativeName, rawContent));
    }

    return skills;
  }

  private async enumerateFiles(folder: string): Promise<string[]> {
    const entries = await readdir(folder, { withFileTypes: true });
    const files: string[] = [];

    for (const entry of entries) {
      const path = join(folder, entry.name);

      if (entry.isDirectory()) {
        files.push(...(await this.enumerateFiles(path)));
      } else if (entry.name.endsWith(this.extension)) {
        files.push(path);
      }
    }

    return files;
  }
}

function buildSkill(relativeName: string, rawContent: string): Skill {
  const { name, description, body } = parseFrontmatter(rawContent);

  return {
    name: name === null || name.trim().length === 0 ? relativeName : name,
    description: description ?? "",
    content: body,
  };
}

function parseFrontmatter(content: string): { name: string | null; description: string | null; body: string } {
  const lines = content.replace(/\r\n/g, "\n").split("\n");

  if (lines.length === 0 || lines[0]?.trim() !== FRONTMATTER_FENCE) {
    return { name: null, description: null, body: content };
  }

  let closingIndex = -1;

  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index]?.trim() === FRONTMATTER_FENCE) {
      closingIndex = index;
      break;
    }
  }

  if (closingIndex === -1) {
    return { name: null, description: null, body: content };
  }

  const name = readField(lines, 1, closingIndex, "name");
  const description = readField(lines, 1, closingIndex, "description");
  const body = lines.slice(closingIndex + 1).join("\n").replace(/^\n+/, "");

  return { name, description, body };
}

function readField(lines: readonly string[], start: number, end: number, key: string): string | null {
  const prefix = `${key}:`;

  for (let index = start; index < end; index += 1) {
    const trimmedLine = (lines[index] ?? "").trim();

    if (trimmedLine.toLowerCase().startsWith(prefix)) {
      return trimmedLine.slice(prefix.length).trim();
    }
  }

  return null;
}
