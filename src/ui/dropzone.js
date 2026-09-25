function hasFiles(event) {
  const types = event.dataTransfer?.types;
  return Boolean(types && Array.from(types).includes("Files"));
}

const activeZones = new Set();

export function hideAllDropzones() {
  activeZones.forEach((hide) => hide());
}

/**
 * Count nested drag events to keep the overlay steady. Clear all zones on drop.
 */
export function bindDropzone(element, { onFiles, message = "Drop to add" }) {
  if (!element) {
    return () => {};
  }

  let depth = 0;
  const overlay = document.createElement("div");
  overlay.className = "drop-overlay";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `<span class="drop-overlay-text">${message}</span>`;
  element.classList.add("dropzone");
  element.appendChild(overlay);

  const show = () => element.classList.add("is-dropping");
  const hide = () => {
    depth = 0;
    element.classList.remove("is-dropping");
  };

  activeZones.add(hide);

  const onEnter = (event) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    depth += 1;
    show();
  };

  const onOver = (event) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    show();
  };

  const onLeave = (event) => {
    if (!hasFiles(event)) {
      return;
    }

    depth = Math.max(0, depth - 1);

    if (depth === 0) {
      hide();
    }
  };

  const onDrop = (event) => {
    if (!hasFiles(event)) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();
    hideAllDropzones();
    const files = Array.from(event.dataTransfer.files || []);

    if (files.length) {
      onFiles(files);
    }
  };

  element.addEventListener("dragenter", onEnter);
  element.addEventListener("dragover", onOver);
  element.addEventListener("dragleave", onLeave);
  element.addEventListener("drop", onDrop);

  return () => {
    element.removeEventListener("dragenter", onEnter);
    element.removeEventListener("dragover", onOver);
    element.removeEventListener("dragleave", onLeave);
    element.removeEventListener("drop", onDrop);
    activeZones.delete(hide);
    overlay.remove();
    element.classList.remove("dropzone", "is-dropping");
  };
}

/** The window handlers stop a stray drop from navigating away from the app. */
export function blockWindowDrops() {
  if (blockWindowDrops.bound) {
    return;
  }

  blockWindowDrops.bound = true;

  const swallow = (event) => {
    if (hasFiles(event)) {
      event.preventDefault();
    }
  };

  const clearIfLeavingWindow = (event) => {
    if (event.relatedTarget == null || event.clientX <= 0 || event.clientY <= 0) {
      hideAllDropzones();
    }
  };

  window.addEventListener("dragover", swallow);
  window.addEventListener("drop", (event) => {
    swallow(event);
    hideAllDropzones();
  });
  window.addEventListener("dragend", hideAllDropzones);
  document.addEventListener("dragleave", clearIfLeavingWindow);
}

blockWindowDrops.bound = false;
