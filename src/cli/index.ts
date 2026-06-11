#!/usr/bin/env node
import { Command } from "commander";
import chalk from "chalk";
import ora from "ora";
import path from "node:path";
import fs from "node:fs";
import { loadConfig } from "../config/loader.js";
import { generate } from "../generate.js";

const program = new Command();

program.name("axigen").description("Generate typed Axios client functions from OpenAPI / Swagger specs").version(getVersion());

// ─── generate command (default) ───────────────────────────────────────────────

program
  .command("generate", { isDefault: true })
  .alias("gen")
  .description("Generate axios client from OpenAPI spec")
  .option("-c, --config <path>", "Path to config file (default: axigen.config.js)")
  .option("--cwd <path>", "Working directory (default: process.cwd())")
  .action(async (opts) => {
    const cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();

    const spinner = ora({
      text: chalk.dim("Loading config..."),
      color: "cyan",
    }).start();

    try {
      // load config
      const config = await loadConfig(cwd, opts.config);
      spinner.text = chalk.dim(`Parsing ${config.input}...`);

      // generate
      const result = await generate(config, cwd);

      spinner.succeed(chalk.green("Generated successfully!"));

      console.log("");
      console.log(chalk.bold("  Output:"));
      console.log(`  ${chalk.cyan("client")}  →  ${chalk.white(relPath(cwd, result.clientPath))}`);
      if (result.typesPath) {
        console.log(`  ${chalk.cyan("types")}   →  ${chalk.white(relPath(cwd, result.typesPath))}`);
      }
      console.log("");
      console.log(`  ${chalk.green("✓")} ${chalk.bold(result.endpointCount)} endpoint${result.endpointCount !== 1 ? "s" : ""} generated`);
      console.log("");
    } catch (err) {
      spinner.fail(chalk.red("Generation failed"));
      console.error("");
      console.error(chalk.red("  Error: ") + (err instanceof Error ? err.message : String(err)));
      console.error("");
      process.exit(1);
    }
  });

// ─── init command ─────────────────────────────────────────────────────────────

program
  .command("init")
  .description("Create a starter axigen.config.js in the current directory")
  .option("--cwd <path>", "Working directory")
  .action((opts) => {
    const cwd = opts.cwd ? path.resolve(opts.cwd) : process.cwd();
    const dest = path.join(cwd, "axigen.config.js");

    if (fs.existsSync(dest)) {
      console.log(chalk.yellow("  axigen.config.js already exists."));
      return;
    }

    const template = `/** @type {import('axigen').AxigenConfig} */
module.exports = {
  input: './openapi.yaml',

  output: {
    client: './src/api/client.ts',
    types: './src/api/types.ts',
  },
  axiosInstancePath: '../lib/axios',
  language: 'ts',
  jsdoc: true,
}
`;

    fs.writeFileSync(dest, template, "utf-8");
    console.log(chalk.green(`  ✓ Created axigen.config.js`));
    console.log(chalk.dim(`  Edit it and run: axigen generate`));
  });

program.parse();

// ─── helpers ──────────────────────────────────────────────────────────────────

function relPath(cwd: string, abs: string): string {
  return path.relative(cwd, abs);
}

function getVersion(): string {
  try {
    const pkgPath = new URL("../../package.json", import.meta.url).pathname;
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8")) as { version: string };
    return pkg.version;
  } catch {
    return "0.0.0";
  }
}
