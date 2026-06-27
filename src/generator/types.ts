import type { SchemaObject, ParsedEndpoint } from "../types.js";

// ─── Schema → TypeScript type string ─────────────────────────────────────────

export function schemaToTSType(schema: SchemaObject | undefined, indent = 0): string {
  if (!schema) return "unknown";

  // $ref — extract the type name and reference it directly (no inline expansion)
  if (schema.$ref) {
    return refToTypeName(schema.$ref);
  }

  if (schema.allOf && schema.allOf.length > 0) {
    return schema.allOf.map((s) => schemaToTSType(s, indent)).join(" & ");
  }

  if (schema.anyOf || schema.oneOf) {
    const variants = (schema.anyOf ?? schema.oneOf)!;
    return variants.map((s) => schemaToTSType(s, indent)).join(" | ");
  }

  if (schema.enum) {
    return schema.enum.map((v) => JSON.stringify(v)).join(" | ");
  }

  const nullable = schema.nullable ? " | null" : "";

  switch (schema.type) {
    case "string":
      return `string${nullable}`;
    case "number":
    case "integer":
      return `number${nullable}`;
    case "boolean":
      return `boolean${nullable}`;
    case "null":
      return "null";
    case "array":
      return `Array<${schemaToTSType(schema.items, indent)}>${nullable}`;
    case "object":
      return buildObjectType(schema, indent) + nullable;
    default:
      if (schema.properties) {
        return buildObjectType(schema, indent) + nullable;
      }
      return `unknown${nullable}`;
  }
}

function buildObjectType(schema: SchemaObject, indent: number): string {
  if (!schema.properties || Object.keys(schema.properties).length === 0) {
    return "Record<string, unknown>";
  }

  const required = new Set(schema.required ?? []);
  const pad = "  ".repeat(indent + 1);
  const closePad = "  ".repeat(indent);

  const fields = Object.entries(schema.properties)
    .map(([key, val]) => {
      const optional = !required.has(key) ? "?" : "";
      const comment = val.description ? `${pad}/** ${val.description} */\n` : "";
      const safeName = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(key) ? key : `'${key}'`;
      return `${comment}${pad}${safeName}${optional}: ${schemaToTSType(val, indent + 1)}`;
    })
    .join("\n");

  return `{\n${fields}\n${closePad}}`;
}

function refToTypeName(ref: string): string {
  const parts = ref.split("/");
  const raw = parts[parts.length - 1] ?? "unknown";
  return toPascalCase(raw);
}

function toPascalCase(name: string): string {
  return name
    .split(/[-_]/)
    .map((part) => (part.length === 0 ? "" : part.charAt(0).toUpperCase() + part.slice(1)))
    .join("");
}

// ─── Type collector ───────────────────────────────────────────────────────────

/**
 * Holds all type declarations to be emitted.
 * Key   → type/interface name
 * Value → full declaration string (without trailing newline)
 *
 * Using Map preserves insertion order and naturally deduplicates by name:
 * if two endpoints reference the same schema, the second set() is a no-op
 * because we guard with has() before inserting.
 */
type TypeRegistry = Map<string, { declaration: string; section: "component" | "endpoint" }>;

function registerType(registry: TypeRegistry, name: string, declaration: string, section: "component" | "endpoint"): void {
  // First writer wins — skip if the name was already registered
  if (registry.has(name)) return;
  registry.set(name, { declaration, section });
}

// ─── Generate types.ts file content ──────────────────────────────────────────

export function generateTypesFile(endpoints: ParsedEndpoint[], schemas: Record<string, SchemaObject> = {}): string {
  const registry: TypeRegistry = new Map();

  // ─── Phase 1: collect component schemas ──────────────────────────────────
  // Process all components/schemas first so every $ref target is registered
  // before we start processing endpoint schemas.
  for (const [rawName, schema] of Object.entries(schemas)) {
    const name = toPascalCase(rawName);
    const jsDoc = schema.description ? `/** ${schema.description} */\n` : "";
    const declaration = `${jsDoc}export type ${name} = ${schemaToTSType(schema)}`;
    registerType(registry, name, declaration, "component");
  }

  // ─── Phase 2: collect endpoint-specific types ─────────────────────────────
  // For body/response: if the schema is a $ref that already exists in the
  // registry (i.e. it was declared as a component), emit a re-export alias
  // only when the alias name differs from the component name.
  // PathParams / QueryParams are always inline — no $ref possible there.
  for (const ep of endpoints) {
    const baseName = operationToTypeName(ep.operationId);

    // Path params
    if (ep.pathParams.length > 0) {
      const fields = ep.pathParams
        .map((p) => {
          const comment = p.description ? `  /** ${p.description} */\n` : "";
          return `${comment}  ${p.name}: ${schemaToTSType(p.schema)}`;
        })
        .join("\n");
      registerType(registry, `${baseName}PathParams`, `export interface ${baseName}PathParams {\n${fields}\n}`, "endpoint");
    }

    // Query params
    if (ep.queryParams.length > 0) {
      const fields = ep.queryParams
        .map((p) => {
          const optional = !p.required ? "?" : "";
          const comment = p.description ? `  /** ${p.description} */\n` : "";
          return `${comment}  ${p.name}${optional}: ${schemaToTSType(p.schema)}`;
        })
        .join("\n");
      registerType(registry, `${baseName}QueryParams`, `export interface ${baseName}QueryParams {\n${fields}\n}`, "endpoint");
    }

    // Request body
    if (ep.bodySchema) {
      collectSchemaType(registry, ep.bodySchema, `${baseName}Body`);
    }

    // Response
    if (ep.responseSchema) {
      collectSchemaType(registry, ep.responseSchema, `${baseName}Response`);
    }
  }

  // ─── Phase 3: emit ────────────────────────────────────────────────────────
  return emitRegistry(registry);
}

/**
 * Decides how to register a body/response schema:
 * - If it is a $ref to an already-registered component → emit an alias (unless
 *   the alias name matches the component name exactly, in which case skip).
 * - Otherwise → emit a new type declaration.
 */
function collectSchemaType(registry: TypeRegistry, schema: SchemaObject, aliasName: string): void {
  const refName = schema.$ref ? refToTypeName(schema.$ref) : undefined;

  if (refName) {
    // The schema is a $ref
    if (registry.has(refName)) {
      // Component already declared — only add an alias when names differ
      if (aliasName !== refName) {
        registerType(registry, aliasName, `export type ${aliasName} = ${refName}`, "endpoint");
      }
    } else {
      // $ref target not in components (external or forward ref) — reference as-is
      registerType(registry, aliasName, `export type ${aliasName} = ${refName}`, "endpoint");
    }
  } else {
    // Inline schema → emit a standalone type
    registerType(registry, aliasName, `export type ${aliasName} = ${schemaToTSType(schema)}`, "endpoint");
  }
}

/** Serialise the registry into the final file string */
function emitRegistry(registry: TypeRegistry): string {
  const lines: string[] = [];

  lines.push(`// This file is auto-generated by axigen. DO NOT EDIT.`);
  lines.push(`// Generated at: ${new Date().toISOString()}`);
  lines.push("");

  const componentEntries = [...registry.values()].filter((e) => e.section === "component");
  const endpointEntries = [...registry.values()].filter((e) => e.section === "endpoint");

  if (componentEntries.length > 0) {
    lines.push("// ─── Component Schemas ────────────────────────────────────────────────────────");
    lines.push("");
    for (const entry of componentEntries) {
      lines.push(entry.declaration);
      lines.push("");
    }
  }

  if (endpointEntries.length > 0) {
    lines.push("// ─── Endpoint Types ───────────────────────────────────────────────────────────");
    lines.push("");
    for (const entry of endpointEntries) {
      lines.push(entry.declaration);
      lines.push("");
    }
  }

  return lines.join("\n");
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function operationToTypeName(operationId: string): string {
  return operationId.charAt(0).toUpperCase() + operationId.slice(1);
}
