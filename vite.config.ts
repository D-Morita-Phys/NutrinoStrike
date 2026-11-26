import { defineConfig } from "vite";

// Base config for the vanilla TypeScript app.
//
// GitHub Pages serves this as a project page under a subpath
// (https://d-morita-phys.github.io/NutrinoStrike/), so the production build
// must resolve assets under "/NutrinoStrike/". Local dev (npm run dev) should
// keep serving from "/", so the base is only applied on the build command.
export default defineConfig(({ command }) => ({
  base: command === "build" ? "/NutrinoStrike/" : "/",
  build: {
    target: "es2020",
  },
}));
