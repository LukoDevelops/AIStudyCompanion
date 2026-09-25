import { normaliseDocument } from "../pipeline/document.js";
import { normalise } from "../pipeline/text.js";
import { describeImage, readImageText } from "./visionAdapter.js";

const IMAGE_EXTENSIONS = [
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".bmp",
  ".avif",
  ".tif",
  ".tiff",
];

export function isImageFile(file) {
  const name = String(file?.name || "").toLowerCase();
  const type = String(file?.type || "").toLowerCase();
  return (
    type.startsWith("image/") ||
    IMAGE_EXTENSIONS.some((extension) => name.endsWith(extension))
  );
}

function buildSource({ label, text, origin, adapter, warning = null, stages, ocrQuality, extractedText, visualDescription }) {
  const document = normaliseDocument({ text });
  const clean = normalise(document.text);

  if (!clean) {
    return warning ? { label, text: "", origin, adapter, warning, blocks: [] } : null;
  }

  return {
    label,
    text: clean,
    origin,
    adapter,
    warning,
    blocks: extractedText || visualDescription ? [
      ...(visualDescription ? normaliseDocument({ text: visualDescription }).blocks.map(block => ({...block, origin: "vision", heading: "Model description — check against the image"})) : []),
      ...(extractedText ? extractedText.split(/\n+/).filter(Boolean).map(text => ({kind:"bullet", text, origin:"ocr", heading:"Text read from the image", page:1})) : []),
    ] : document.blocks,
    visionStages: stages,
    ocrQuality,
  };
}

export async function collectImageSources({
  description,
  files = [],
  onStatus = () => {},
  useLocalCaption = true,
  cloudKey = "",
  requireCloud = false,
}) {
  const sources = [];
  const pasted = normalise(description);

  if (pasted) {
    sources.push(
      buildSource({
        label: "Image description",
        text: pasted,
        origin: "paste",
        adapter: "image-paste",
      })
    );
  }

  for (const file of files) {
    if (!isImageFile(file)) {
      sources.push({
        label: file.name,
        text: "",
        origin: "paste",
        adapter: "ocr",
        warning: `${file.name} is not an image file.`,
        blocks: [],
      });
      continue;
    }

    let result;
    try {
      result = await describeImage(file, {
        onStatus,
        useLocalCaption,
        cloudKey,
        requireCloud,
      });
    } catch (error) {
      // Report the damaged image and keep processing the other inputs.
      sources.push({
        label: file.name,
        text: "",
        origin: "image",
        adapter: "vision",
        warning: `${file.name} could not be processed as an image (${error.message}). Try re-saving it as PNG or JPEG, or add a short description.`,
        blocks: [],
      });
      continue;
    }

    if (!result.text) {
      sources.push({
        label: file.name,
        text: "",
        origin: "image",
        adapter: "vision",
        warning:
          result.warnings.join(" ") ||
          `No readable content was found in ${file.name}. A pasted description works better.`,
        blocks: [],
      });
      continue;
    }

    sources.push(
      buildSource({
        label: file.name,
        text: result.text,
        origin: result.stages.includes("cloud-vision")
          ? "cloud-vision"
          : result.stages.includes("caption")
            ? "vision"
            : "ocr",
        adapter: "ocr",
        warning: result.warnings.length ? result.warnings.join(" ") : null,
        stages: result.stages,
        ocrQuality: result.ocrQuality,
        extractedText: result.extractedText,
        visualDescription: result.visualDescription,
      })
    );
  }

  return sources.filter(Boolean);
}

export async function collectImageSource({ description, file, files, onStatus }) {
  const list = files || (file ? [file] : []);
  const collected = await collectImageSources({ description, files: list, onStatus });

  if (!collected.length) {
    return null;
  }

  const withText = collected.find((source) => source.text);
  return withText || collected[0];
}

export { readImageText as recogniseImageFile };
