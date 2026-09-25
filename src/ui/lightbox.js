let lastFocus = null;
let background = [];

function nodes() {
  return {
    root: document.getElementById("imageLightbox"),
    image: document.getElementById("lightboxImage"),
    caption: document.getElementById("lightboxCaption"),
    close: document.getElementById("lightboxClose"),
  };
}

export function closeLightbox() {
  const { root, image } = nodes();

  if (!root) {
    return;
  }

  root.classList.add("hidden");
  root.setAttribute("hidden", "");
  root.setAttribute("aria-hidden", "true");
  background.forEach(([element, wasInert]) => { element.inert = wasInert; });
  background = [];

  if (image) {
    image.removeAttribute("src");
    image.alt = "";
  }

  if (lastFocus && typeof lastFocus.focus === "function") {
    lastFocus.focus();
  }

  lastFocus = null;
}

export function openLightbox(src, caption = "") {
  const { root, image, caption: captionNode, close } = nodes();

  if (!root || !image || !src) {
    return;
  }

  lastFocus = document.activeElement;
  background = [...document.body.children].filter(element => element !== root && !element.contains(root)).map(element => [element, element.inert]);
  background.forEach(([element]) => { element.inert = true; });
  image.src = src;
  image.alt = caption || "Enlarged image preview";

  if (captionNode) {
    captionNode.textContent = caption;
  }

  root.classList.remove("hidden");
  root.removeAttribute("hidden");
  root.setAttribute("aria-hidden", "false");
  close?.focus();
}

export function bindLightbox() {
  const { root, close } = nodes();

  if (!root || root.dataset.bound === "true") {
    return;
  }

  root.dataset.bound = "true";

  close?.addEventListener("click", closeLightbox);
  root.querySelector(".lightbox-backdrop")?.addEventListener("click", closeLightbox);

  document.addEventListener("keydown", (event) => {
    if (event.key === 'Tab' && !root.classList.contains('hidden')) {
      event.preventDefault();
      close?.focus();
    }
    if (event.key === "Escape" && !root.classList.contains("hidden")) {
      closeLightbox();
    }
  });
}
