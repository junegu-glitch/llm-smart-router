#!/usr/bin/env node
/**
 * Post-build script: Add .js extensions to relative imports in dist/
 * Required for Node.js ESM resolution.
 *
 * Transforms:
 *   import { foo } from "./bar"    → import { foo } from "./bar.js"
 *   import { foo } from "../lib/x" → import { foo } from "../lib/x.js"
 *   export { foo } from "./bar"    → export { foo } from "./bar.js"
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from "fs";
import { join } from "path";

const DIST_DIR = "dist";

function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      files.push(...walk(full));
    } else if (full.endsWith(".js")) {
      files.push(full);
    }
  }
  return files;
}

function fixImports(content) {
  // Match: from "relative/path" or from 'relative/path'
  // Only fix relative imports (starting with . or ..)
  // Don't fix if already ends with .js
  return content.replace(
    /(from\s+["'])(\.\.?\/[^"']+)(["'])/g,
    (match, prefix, path, suffix) => {
      if (path.endsWith(".js") || path.endsWith(".json")) {
        return match;
      }
      return `${prefix}${path}.js${suffix}`;
    }
  );
}

const files = walk(DIST_DIR);
let fixedCount = 0;

for (const file of files) {
  const original = readFileSync(file, "utf-8");
  const fixed = fixImports(original);
  if (fixed !== original) {
    writeFileSync(file, fixed);
    fixedCount++;
  }
}

console.log(`Fixed ESM imports in ${fixedCount}/${files.length} files`);
