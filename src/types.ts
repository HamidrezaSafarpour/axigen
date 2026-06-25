// ─── OpenAPI types ────────────────────────────────────────────────────────────

export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    version: string;
    description?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  paths: Record<string, PathItem>;
  components?: {
    schemas?: Record<string, SchemaObject>;
    parameters?: Record<string, ParameterObject>;
    requestBodies?: Record<string, RequestBodyObject>;
    responses?: Record<string, ResponseObject>;
  };
}

export type HttpMethod = "get" | "post" | "put" | "patch" | "delete" | "head" | "options";

export type PathItem = {
  [method in HttpMethod]?: OperationObject;
} & {
  parameters?: ParameterObject[];
  summary?: string;
  description?: string;
};

export interface OperationObject {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: ParameterObject[];
  requestBody?: RequestBodyObject;
  responses: Record<string, ResponseObject>;
}

export interface ParameterObject {
  name: string;
  in: "query" | "path" | "header" | "cookie";
  required?: boolean;
  description?: string;
  schema?: SchemaObject;
  $ref?: string;
}

export interface RequestBodyObject {
  required?: boolean;
  description?: string;
  content: Record<string, { schema?: SchemaObject }>;
  $ref?: string;
}

export interface ResponseObject {
  description?: string;
  content?: Record<string, { schema?: SchemaObject }>;
  $ref?: string;
}

export interface SchemaObject {
  type?: "string" | "number" | "integer" | "boolean" | "array" | "object" | "null";
  format?: string;
  description?: string;
  required?: string[];
  properties?: Record<string, SchemaObject>;
  items?: SchemaObject;
  enum?: unknown[];
  $ref?: string;
  allOf?: SchemaObject[];
  anyOf?: SchemaObject[];
  oneOf?: SchemaObject[];
  nullable?: boolean;
  default?: unknown;
  example?: unknown;
}

// ─── Function name transformation config ─────────────────────────────────────

export interface FunctionNameTransform {
  /**
   * Regex pattern to match parts of the operationId.
   * Example: to convert "product-variant-create" to "productVariantCreate"
   * use: { match: '-([a-z])', replacement: (_, c) => c.toUpperCase() }
   *
   * Defined as a string pattern (flags supported via `flags` field).
   */
  match: string;

  /** Regex flags (e.g. 'g', 'gi'). Defaults to 'g'. */
  flags?: string;

  /**
   * Replacement string. Supports capture groups via $1, $2, etc.
   * Example: to capitalize the first char after a dash: use a replacer function
   * defined as a template string like "upper:$1" — see docs for special tokens.
   *
   * Special tokens:
   *   "upper:$1"  → uppercase capture group 1
   *   "lower:$1"  → lowercase capture group 1
   *   any other string is used as-is (standard String.replace replacement)
   */
  replacement: string;
}

export interface FunctionNameConfig {
  /**
   * One or more regex transforms applied in order to the raw operationId.
   * Each transform is applied to the result of the previous one.
   */
  transforms?: FunctionNameTransform[];

  /**
   * Append the HTTP method to the end of the function name.
   * Can be set globally or per-method.
   *
   * Examples:
   *   appendMethod: true          → always append
   *   appendMethod: ['post','put'] → append only for these methods
   */
  appendMethod?: boolean | HttpMethod[];
}

// ─── Axigen config ─────────────────────────────────────────────────────────────

export interface AxigenConfig {
  /** Path to the OpenAPI spec file (YAML or JSON) */
  input: string;

  output: {
    /** Output path for generated Axios client functions */
    client: string;
    /** Output path for generated TypeScript types (optional) */
    types?: string;
  };

  /** Import path to the user's Axios instance */
  axiosInstancePath: string;

  /** Named export of the Axios instance (default: "axiosInstance") */
  axiosInstanceExport?: string;

  /** Output language (default: "ts") */
  language?: "ts" | "js";

  /** Add JSDoc comments to generated functions (default: true) */
  jsdoc?: boolean;

  /** Only generate endpoints matching these tags */
  tags?: string[];

  /** Controls how generated function names are derived from operationIds */
  functionName?: FunctionNameConfig;
}

// ─── Internal intermediate representation ─────────────────────────────────────

export interface ParsedEndpoint {
  operationId: string;
  method: HttpMethod;
  path: string;
  summary?: string;
  description?: string;
  tags: string[];
  pathParams: ParsedParam[];
  queryParams: ParsedParam[];
  bodySchema?: SchemaObject;
  bodyRequired: boolean;
  responseSchema?: SchemaObject;
}

export interface ParsedParam {
  name: string;
  required: boolean;
  schema?: SchemaObject;
  description?: string;
}
