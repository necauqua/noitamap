import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/main.ts"],
  minify: true,
  format: "esm",
});
