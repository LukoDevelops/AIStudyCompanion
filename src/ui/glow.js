import { initFluid } from "smokey-fluid-cursor";

const fluidOptions = {
  simResolution: 96,
  dyeResolution: 512,
  pressureIteration: 12,
  curl: 24,
  splatRadius: 0.18,
  splatForce: 4200,
  densityDissipation: 2.5,
  velocityDissipation: 1.5,
  transparent: true,
  shading: false,
};

const patchedContexts = new WeakSet();

function patchCanvasTransparency(canvas) {
  const nativeGetContext = canvas.getContext.bind(canvas);
  canvas.getContext = (type, attributes) => {
    const context = nativeGetContext(type, {
      ...(attributes || {}),
      alpha: true,
      premultipliedAlpha: false,
    });
    if (context && /^webgl/.test(type) && !patchedContexts.has(context)) {
      const nativeClearColor = context.clearColor.bind(context);
      const nativeClear = context.clear.bind(context);
      context.clearColor = (red, green, blue) => nativeClearColor(red, green, blue, 0);
      context.clear = mask => {
        nativeClearColor(0, 0, 0, 0);
        nativeClear(mask);
      };
      patchedContexts.add(context);
    }
    return context;
  };
  return () => { canvas.getContext = nativeGetContext; };
}

export function bindCursorGlow(element = document.getElementById("cursorGlow")) {
  if (!element) return () => {};
  const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let initialized = false;
  let stopped = false;

  const start = () => {
    if (initialized || stopped) return;
    const restoreContext = patchCanvasTransparency(element);
    try {
      initFluid({ id: element.id, ...fluidOptions });
      initialized = true;
      element.style.zIndex = "0";
      element.style.background = "transparent";
    } catch {
      element.hidden = true;
    } finally {
      restoreContext();
    }
  };

  const update = () => {
    const shouldHide = motion.matches || document.hidden || document.body.classList.contains("is-processing");
    element.hidden = shouldHide;
    if (!shouldHide) start();
  };

  update();
  document.addEventListener("visibilitychange", update);
  document.addEventListener("study-processing-change", update);
  motion.addEventListener("change", update);

  return () => {
    stopped = true;
    element.hidden = true;
    document.removeEventListener("visibilitychange", update);
    document.removeEventListener("study-processing-change", update);
    motion.removeEventListener("change", update);
  };
}
