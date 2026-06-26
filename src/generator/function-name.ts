import type { FunctionNameConfig, FunctionNameTransform, HttpMethod } from "../types.js";

/**
 * Applies the user-defined functionName config to a raw operationId
 * and returns the final function name to be used in generated code.
 */
export function resolveFunctionName(operationId: string, method: HttpMethod, config: FunctionNameConfig | undefined): string {
  if (!config) return operationId;

  let name = operationId;

  if (config.transforms && config.transforms.length > 0) {
    for (const transform of config.transforms) {
      name = applyTransform(name, transform);
    }
  }

  // Prepend the HTTP method prefix if configured
  if (shouldAppendMethod(method, config.appendMethod)) {
    name = method.toLowerCase() + name.charAt(0).toUpperCase() + name.slice(1);
  } else {
    name = name.charAt(0).toLowerCase() + name.slice(1);
  }

  return name;
}

/**
 * Applies a single regex transform to a string.
 *
 * Supports special replacement tokens:
 *   "upper:$1"  → replace match with capture group 1 uppercased
 *   "lower:$1"  → replace match with capture group 1 lowercased
 *   anything else → used as a standard String.replace() replacement
 *
 * Example — convert kebab-case to camelCase:
 *   match: "-([a-zA-Z])", flags: "g", replacement: "upper:$1"
 *   "product-variant-create" → "productVariantCreate"
 */
function applyTransform(input: string, transform: FunctionNameTransform): string {
  const flags = transform.flags ?? "g";
  const regex = new RegExp(transform.match, flags);
  const { replacement } = transform;

  // Check for upper:$N token
  const upperMatch = replacement.match(/^upper:\$(\d+)$/);
  if (upperMatch) {
    const groupIndex = parseInt(upperMatch[1], 10);
    return input.replace(regex, (...args) => {
      const captured = args[groupIndex] as string | undefined;
      return captured ? captured.toUpperCase() : "";
    });
  }

  // Check for lower:$N token
  const lowerMatch = replacement.match(/^lower:\$(\d+)$/);
  if (lowerMatch) {
    const groupIndex = parseInt(lowerMatch[1], 10);
    return input.replace(regex, (...args) => {
      const captured = args[groupIndex] as string | undefined;
      return captured ? captured.toLowerCase() : "";
    });
  }

  // Standard replacement — supports $1, $2, $& etc.
  return input.replace(regex, replacement);
}

/**
 * Returns true if the HTTP method should be appended to the function name.
 * Comparison is case-insensitive so both "post" and "POST" work in config.
 */
function shouldAppendMethod(method: HttpMethod, appendMethod: FunctionNameConfig["appendMethod"]): boolean {
  if (!appendMethod) return false;
  if (appendMethod === true) return true;
  if (Array.isArray(appendMethod)) {
    // Normalize both sides to lowercase for comparison
    return appendMethod.map((m) => m.toLowerCase()).includes(method.toLowerCase());
  }
  return false;
}
