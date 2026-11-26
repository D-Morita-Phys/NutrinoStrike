// Persistent top bar + hamburger menu shell.
//
// This renders a fixed top bar present on every screen. The hamburger button
// opens a panel with three actions: restart (やり直し), volume (音量調整, a
// slider placeholder for now; FEAT-002 wires it to the Web Audio engine), and
// collection (コレクション). Each action closes the menu after running.
//
// The menu is DOM-only presentation; it knows nothing about scenes directly.
// Callers pass handlers so navigation stays in the scene wiring (app.ts).

export interface MenuHandlers {
  /** やり直し: restart back to the start screen. */
  onRestart(): void;
  /** コレクション: open the collection screen. */
  onOpenCollection(): void;
  /** 音量調整: volume changed (0..1). Placeholder until FEAT-002. */
  onVolumeChange(value: number): void;
}

export interface TopBar {
  /** The top bar element to prepend to the app root. */
  readonly element: HTMLElement;
  /** Close the menu panel if open. */
  close(): void;
}

/** Build the top bar with the hamburger menu wired to the given handlers. */
export function createTopBar(handlers: MenuHandlers): TopBar {
  const bar = document.createElement("header");
  bar.className = "topbar";

  const brand = document.createElement("span");
  brand.className = "topbar-brand";
  brand.textContent = "Neutrino Strike";

  const button = document.createElement("button");
  button.type = "button";
  button.className = "hamburger";
  button.setAttribute("aria-label", "メニューを開く");
  button.setAttribute("aria-expanded", "false");
  button.innerHTML = "<span></span><span></span><span></span>";

  const panel = document.createElement("nav");
  panel.className = "menu-panel";
  panel.hidden = true;

  // --- Restart ---
  const restartBtn = document.createElement("button");
  restartBtn.type = "button";
  restartBtn.className = "menu-item";
  restartBtn.textContent = "やり直し";

  // --- Volume (slider placeholder) ---
  const volumeWrap = document.createElement("div");
  volumeWrap.className = "menu-item menu-volume";
  const volumeLabel = document.createElement("label");
  volumeLabel.className = "menu-volume-label";
  volumeLabel.textContent = "音量調整";
  const volumeSlider = document.createElement("input");
  volumeSlider.type = "range";
  volumeSlider.min = "0";
  volumeSlider.max = "100";
  volumeSlider.value = "70";
  volumeSlider.className = "menu-volume-slider";
  volumeSlider.setAttribute("aria-label", "音量調整");
  volumeLabel.appendChild(volumeSlider);
  volumeWrap.appendChild(volumeLabel);

  // --- Collection ---
  const collectionBtn = document.createElement("button");
  collectionBtn.type = "button";
  collectionBtn.className = "menu-item";
  collectionBtn.textContent = "コレクション";

  panel.append(restartBtn, volumeWrap, collectionBtn);
  bar.append(brand, button, panel);

  let open = false;
  const setOpen = (next: boolean): void => {
    open = next;
    panel.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
    button.classList.toggle("is-open", open);
  };
  const close = (): void => setOpen(false);

  button.addEventListener("click", (e) => {
    e.stopPropagation();
    setOpen(!open);
  });

  // Click outside the panel closes it.
  document.addEventListener("click", (e) => {
    if (!open) return;
    const target = e.target as Node;
    if (!panel.contains(target) && target !== button) close();
  });

  restartBtn.addEventListener("click", () => {
    close();
    handlers.onRestart();
  });
  collectionBtn.addEventListener("click", () => {
    close();
    handlers.onOpenCollection();
  });
  // Volume is live and does not close the menu (the user drags the slider).
  volumeSlider.addEventListener("input", () => {
    handlers.onVolumeChange(Number(volumeSlider.value) / 100);
  });

  return { element: bar, close };
}
