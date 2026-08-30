import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { openApiDocument } from "./document.ts";

const currentFilePath = fileURLToPath(import.meta.url);
const currentDirPath = dirname(currentFilePath);
const outputFilePath = resolve(currentDirPath, "../../openapi/openapi.json");

await mkdir(dirname(outputFilePath), { recursive: true });
await writeFile(
  outputFilePath,
  `${JSON.stringify(openApiDocument, null, 2)}\n`,
  "utf8",
);

console.log(`OpenAPI spec written to ${outputFilePath}`);
