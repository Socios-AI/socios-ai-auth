import { defineConfig } from "tsup";

export default defineConfig({
  entry: {
    "index": "src/index.ts",
    "react/index": "src/react/index.ts",
    "admin/index": "src/admin/index.ts",
    "next/index": "src/next/index.ts",
    "edge/index": "src/edge/index.ts",
  },
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: false,
  external: ["react", "@supabase/ssr", "@supabase/supabase-js", "zod", "next", "next/server", "next/headers"],
});
