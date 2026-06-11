import fs from "node:fs";
import path from "node:path";
import type { AxigenConfig } from "./types.ts";
import { parseOpenAPIFile, extractEndpoints } from "./parser/openapi";
import { generateTypesFile } from "./generator/types";
import { generateClientFile } from "./generator/axios";

export interface GenerateResult {
  clientPath: string;
  typesPath?: string;
  endpointCount: number;
}

export async function generate(config: AxigenConfig, cwd: string): Promise<GenerateResult> {
  // ─── 1. Parse spec ──────────────────────────────────────────────────────────
  const specPath = path.resolve(cwd, config.input);
  const spec = parseOpenAPIFile(specPath);

  // ─── 2. Extract endpoints ───────────────────────────────────────────────────
  const endpoints = extractEndpoints(spec, config.tags);

  if (endpoints.length === 0) {
    throw new Error("No endpoints found in the OpenAPI spec. Check your input file or tags filter.");
  }

  // ─── 3. Resolve output paths ────────────────────────────────────────────────
  const clientPath = path.resolve(cwd, config.output.client);
  const typesPath = config.output.types ? path.resolve(cwd, config.output.types) : undefined;

  let typesRelativePath: string | undefined;
  if (typesPath) {
    typesRelativePath = toRelativeImportPath(path.dirname(clientPath), typesPath);
  }

  // ─── 4. Generate files ──────────────────────────────────────────────────────
  const schemas = spec.components?.schemas ?? {};

  // types.ts
  let typesContent: string | undefined;
  if (config.language !== "js" && typesPath) {
    typesContent = generateTypesFile(endpoints, schemas);
  }

  // client.ts / client.js
  const clientContent = generateClientFile({
    endpoints,
    config,
    typesRelativePath,
  });

  // ─── 5. Write to disk ───────────────────────────────────────────────────────
  ensureDir(path.dirname(clientPath));
  fs.writeFileSync(clientPath, clientContent, "utf-8");

  if (typesPath && typesContent) {
    ensureDir(path.dirname(typesPath));
    fs.writeFileSync(typesPath, typesContent, "utf-8");
  }

  return {
    clientPath,
    typesPath,
    endpointCount: endpoints.length,
  };
}

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function toRelativeImportPath(fromDir: string, toFile: string): string {
  let rel = path.relative(fromDir, toFile);

  rel = rel.replace(/\.(ts|js|d\.ts)$/, "");

  if (!rel.startsWith(".")) {
    rel = "./" + rel;
  }

  return rel.replace(/\\/g, "/");
}
