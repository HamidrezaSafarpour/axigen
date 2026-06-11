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

// ─── Axigen config ─────────────────────────────────────────────────────────────

export interface AxigenConfig {
  input: string;
  output: {
    client: string;
    types?: string;
  };
  axiosInstancePath: string;
  axiosInstanceExport?: string;
  language?: "ts" | "js";
  jsdoc?: boolean;
  tags?: string[];
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
