import { defineConfig } from "vite";

// Base config for the vanilla TypeScript app. Rendering (Canvas) arrives in a
// later feature; for now this just serves index.html and src/main.ts.
export default defineConfig({
  build: {
    target: "es2020",
  },
});
