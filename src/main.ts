// Entry point: mount the multi-screen app shell onto #app.
//
// The DOM, scene wiring, hamburger menu and Game lifecycle all live in
// src/ui/app.ts. This file only locates the mount point and delegates.
import "./style.css";
import { mountApp } from "./ui/app.ts";

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) {
  throw new Error("#app mount point not found");
}

mountApp(app);
