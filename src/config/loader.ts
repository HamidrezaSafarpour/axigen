import path from "node:path";
import fs from "node:fs";
import type { AxigenConfig } from "../types.js";

const CONFIG_FILES = ["axigen.config.js", "axigen.config.cjs", "axigen.config.mjs", "axigen.config.ts"];

export async function loadConfig(cwd: string, configPath?: string): Promise<AxigenConfig> {
  if (configPath) {
    const abs = path.resolve(cwd, configPath);
    if (!fs.existsSync(abs)) {
      throw new Error(`Config file not found: ${abs}`);
    }
    return importConfig(abs);
  }

  for (const filename of CONFIG_FILES) {
    const abs = path.join(cwd, filename);
    if (fs.existsSync(abs)) {
      return importConfig(abs);
    }
  }

  throw new Error(`No config file found. Create one of: ${CONFIG_FILES.join(", ")}\n` + `Or run: axigen init`);
}

async function importConfig(filePath: string): Promise<AxigenConfig> {
  let raw: unknown;

  try {
    const mod = await import(filePath);
    raw = mod.default ?? mod;
  } catch {
    throw new Error(`Failed to load config: ${filePath}`);
  }

  return validateConfig(raw, filePath);
}

function validateConfig(raw: unknown, filePath: string): AxigenConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid config in ${filePath}: must export an object`);
  }

  const cfg = raw as Record<string, unknown>;

  if (!cfg.input || typeof cfg.input !== "string") {
    throw new Error(`Config error: "input" must be a string path to your OpenAPI file`);
  }

  if (!cfg.output || typeof cfg.output !== "object") {
    throw new Error(`Config error: "output" must be an object with at least "client" path`);
  }

  const output = cfg.output as Record<string, unknown>;
  if (!output.client || typeof output.client !== "string") {
    throw new Error(`Config error: "output.client" is required`);
  }

  if (!cfg.axiosInstancePath || typeof cfg.axiosInstancePath !== "string") {
    throw new Error(`Config error: "axiosInstancePath" is required (path to your axios instance)`);
  }

  return {
    input: cfg.input,
    output: {
      client: output.client,
      types: typeof output.types === "string" ? output.types : undefined,
    },
    axiosInstancePath: cfg.axiosInstancePath as string,
    axiosInstanceExport: typeof cfg.axiosInstanceExport === "string" ? cfg.axiosInstanceExport : "axiosInstance",
    language: cfg.language === "js" ? "js" : "ts",
    jsdoc: cfg.jsdoc !== false,
    tags: Array.isArray(cfg.tags) ? (cfg.tags as string[]) : undefined,
  };
}
