// Entry point stub. Canvas rendering and input handling are implemented in a
// later feature. For now this keeps the Vite build happy and documents the
// pure-logic modules that the game is built on.
import { MIN_ENERGY_MEV, MAX_ENERGY_MEV } from "./game/neutrinos.ts";

const app = document.querySelector<HTMLDivElement>("#app");
if (app) {
  app.textContent = `Nutrino Strike (energy range ${MIN_ENERGY_MEV}-${MAX_ENERGY_MEV} MeV)`;
}
