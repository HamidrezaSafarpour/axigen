import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";
import type { OpenAPISpec, ParsedEndpoint, ParameterObject, SchemaObject } from "../types.js";

export function parseOpenAPIFile(filePath: string): OpenAPISpec {
  if (!fs.existsSync(filePath)) {
    throw new Error(`OpenAPI file not found: ${filePath}`);
  }

  const content = fs.readFileSync(filePath, "utf-8");
  const ext = path.extname(filePath).toLowerCase();

  let spec: unknown;
  if (ext === ".json") {
    spec = JSON.parse(content);
  } else {
    spec = yaml.load(content);
  }

  return validateSpec(spec, filePath);
}

function validateSpec(raw: unknown, filePath: string): OpenAPISpec {
  if (!raw || typeof raw !== "object") {
    throw new Error(`Invalid OpenAPI file: ${filePath}`);
  }

  const s = raw as Record<string, unknown>;

  const isOpenAPI3 = typeof s.openapi === "string" && s.openapi.startsWith("3.");
  const isSwagger2 = typeof s.swagger === "string" && s.swagger.startsWith("2.");

  if (!isOpenAPI3 && !isSwagger2) {
    throw new Error(`Unsupported spec format in ${filePath}.\n` + `Expected OpenAPI 3.x or Swagger 2.x`);
  }

  if (!s.paths || typeof s.paths !== "object") {
    throw new Error(`OpenAPI spec has no "paths" defined: ${filePath}`);
  }

  return raw as OpenAPISpec;
}

// ─── Convert spec to internal endpoints list ────────────────────────────────────

export function extractEndpoints(spec: OpenAPISpec, filterTags?: string[]): ParsedEndpoint[] {
  const endpoints: ParsedEndpoint[] = [];

  for (const [urlPath, pathItem] of Object.entries(spec.paths)) {
    const methods = ["get", "post", "put", "patch", "delete", "head", "options"] as const;

    for (const method of methods) {
      const operation = pathItem[method];
      if (!operation) continue;

      const tags = operation.tags ?? [];

      // Filter by tags
      if (filterTags && filterTags.length > 0) {
        if (!tags.some((t) => filterTags.includes(t))) continue;
      }

      // Build operationId if not present
      const operationId = operation.operationId ?? buildOperationId(method, urlPath);

      // Collect params (path-level + operation-level)
      const allParams = [...(pathItem.parameters ?? []), ...(operation.parameters ?? [])];

      const pathParams = allParams.filter((p) => !("$ref" in p) && p.in === "path").map(normalizeParam);

      const queryParams = allParams.filter((p) => !("$ref" in p) && p.in === "query").map(normalizeParam);

      // body
      let bodySchema: SchemaObject | undefined;
      let bodyRequired = false;

      if (operation.requestBody && !("$ref" in operation.requestBody)) {
        bodyRequired = operation.requestBody.required ?? false;
        const content = operation.requestBody.content;
        const jsonContent = content?.["application/json"];
        bodySchema = jsonContent?.schema;
      }

      // response schema (2xx)
      let responseSchema: SchemaObject | undefined;
      for (const [status, response] of Object.entries(operation.responses)) {
        if (status.startsWith("2") && !("$ref" in response)) {
          const jsonContent = response.content?.["application/json"];
          responseSchema = jsonContent?.schema;
          break;
        }
      }

      endpoints.push({
        operationId,
        method,
        path: urlPath,
        summary: operation.summary,
        description: operation.description,
        tags,
        pathParams,
        queryParams,
        bodySchema,
        bodyRequired,
        responseSchema,
      });
    }
  }

  return endpoints;
}

function normalizeParam(p: ParameterObject) {
  return {
    name: p.name,
    required: p.required ?? false,
    schema: p.schema,
    description: p.description,
  };
}

// /users/{userId}/posts/{postId} + GET  →  getUsersUserIdPostsPostId
function buildOperationId(method: string, urlPath: string): string {
  const parts = urlPath
    .split("/")
    .filter(Boolean)
    .map((segment) => {
      if (segment.startsWith("{") && segment.endsWith("}")) {
        const name = segment.slice(1, -1);
        return "By" + capitalize(name);
      }
      return capitalize(segment);
    });
  return method.toLowerCase() + parts.join("");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
