import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: { "cli/index": "src/cli/index.ts" },
    format: ["esm"],
    clean: true,
    shims: true,
    banner: { js: "#!/usr/bin/env node" },
  },
  {
    entry: { index: "src/index.ts" },
    format: ["esm", "cjs"],
    dts: true,
    clean: false,
    shims: true,
  },
]);
