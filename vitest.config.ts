import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/cli/**"],
      exclude: ["src/app/**", "src/components/**"],
    },
  },
  resolve: {
    alias: {
      // Handle .js extensions in ESM imports
    },
  },
});
