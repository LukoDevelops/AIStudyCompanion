import { describe, expect, it } from "vitest";
import { classifyAudioFile, stripSubtitleMarkup } from "../src/adapters/audioAdapter.js";
import { uniqueLabels } from "../src/adapters/collect.js";
import { isImageFile } from "../src/adapters/imageAdapter.js";
import {
  classifyTextFile,
  collectTextSources,
  extractTextForInsert,
  formatCompiledNotes,
  notesBeyondCompiled,
} from "../src/adapters/textAdapter.js";
import { describeImage } from "../src/adapters/visionAdapter.js";

function fakeFile(name, type = "") {
  return { name, type };
}

describe("file classification", () => {
  it("routes text files by extension and type", () => {
    expect(classifyTextFile(fakeFile("notes.pdf"))).toBe("pdf");
    expect(classifyTextFile(fakeFile("report.docx"))).toBe("docx");
    expect(classifyTextFile(fakeFile("old.doc"))).toBe("legacy-doc");
    expect(classifyTextFile(fakeFile("notes.md"))).toBe("plain");
    expect(classifyTextFile(fakeFile("clip.mp3", "audio/mpeg"))).toBe("unsupported");
  });

  it("separates recordings from transcript files", () => {
    expect(classifyAudioFile(fakeFile("lecture.mp3", "audio/mpeg"))).toBe("audio");
    expect(classifyAudioFile(fakeFile("lecture.m4a"))).toBe("audio");
    expect(classifyAudioFile(fakeFile("lecture.webm", "video/webm"))).toBe("audio");
    expect(classifyAudioFile(fakeFile("lecture.vtt"))).toBe("transcript");
    expect(classifyAudioFile(fakeFile("slide.png", "image/png"))).toBe("unsupported");
  });

  it("recognises image files", () => {
    expect(isImageFile(fakeFile("chart.webp"))).toBe(true);
    expect(isImageFile(fakeFile("chart.PNG"))).toBe(true);
    expect(isImageFile(fakeFile("notes.txt", "text/plain"))).toBe(false);
  });
});

describe("subtitle cleanup", () => {
  it("removes cue numbers, timings, and tags", () => {
    const cleaned = stripSubtitleMarkup(
      [
        "WEBVTT",
        "",
        "1",
        "00:00:00.000 --> 00:00:06.000",
        "<v Speaker>Retrieval happens before generation.",
        "",
        "2",
        "00:00:06.000 --> 00:00:12.000",
        "That ordering keeps the answer anchored.",
      ].join("\n")
    );

    expect(cleaned).not.toContain("WEBVTT");
    expect(cleaned).not.toContain("-->");
    expect(cleaned).not.toContain("<v");
    expect(cleaned).toContain("Retrieval happens before generation.");
    expect(cleaned).toContain("That ordering keeps the answer anchored.");
  });
});

describe("multiple sources", () => {
  it("keeps every attached file as its own labelled source", async () => {
    const sources = await collectTextSources({
      notes: "Pasted revision notes about grounding and coverage.",
      files: [
        new File(["First imported file about retrieval ranking methods."], "one.txt", {
          type: "text/plain",
        }),
        new File(["Second imported file about evaluation and honesty."], "two.md", {
          type: "text/markdown",
        }),
      ],
    });

    expect(sources).toHaveLength(3);
    expect(sources.map((source) => source.label)).toEqual([
      "Text notes",
      "one.txt",
      "two.md",
    ]);
    expect(sources.every((source) => source.text.length > 0)).toBe(true);
    expect(sources.every((source) => Array.isArray(source.blocks))).toBe(true);
  });

  it("reports a warning instead of throwing when a file cannot be read", async () => {
    const broken = {
      name: "broken.docx",
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      arrayBuffer: async () => new ArrayBuffer(4),
    };

    const sources = await collectTextSources({ notes: "", files: [broken] });

    expect(sources).toHaveLength(1);
    expect(sources[0].text).toBe("");
    expect(sources[0].warning).toContain("broken.docx");
  });

  it("makes duplicate file names unique so sentence ids stay distinct", () => {
    const labelled = uniqueLabels([
      { label: "notes.txt" },
      { label: "notes.txt" },
      { label: "other.txt" },
      { label: "notes.txt" },
    ]);

    expect(labelled.map((source) => source.label)).toEqual([
      "notes.txt",
      "notes.txt (2)",
      "other.txt",
      "notes.txt (3)",
    ]);
  });
});

describe("compiled notes", () => {
  it("keeps paragraph breaks when inserting a notes file", async () => {
    const file = new File(["First paragraph about retrieval.\n\nSecond paragraph about grounding."], "notes.txt", {
      type: "text/plain",
    });

    const text = await extractTextForInsert(file);

    expect(text).toContain("First paragraph about retrieval.");
    expect(text).toContain("Second paragraph about grounding.");
    expect(text).toMatch(/\n/);
  });

  it("stacks several files in order with their names", () => {
    const compiled = formatCompiledNotes([
      { name: "one.txt", text: "Retrieval ranks sentences." },
      { name: "two.md", text: "Coverage measures unused lines." },
    ]);

    expect(compiled.indexOf("one.txt")).toBeLessThan(compiled.indexOf("two.md"));
    expect(compiled).toContain("Retrieval ranks sentences.");
    expect(compiled).toContain("Coverage measures unused lines.");
  });

  it("strips the compiled block so only typed notes reach the pipeline", () => {
    const compiled = formatCompiledNotes([{ name: "one.txt", text: "File text." }]);

    expect(notesBeyondCompiled(compiled, compiled)).toBe("");
    expect(notesBeyondCompiled(`My own notes.\n\n${compiled}`, compiled)).toBe("My own notes.");
  });
});

describe("cloud vision guard", () => {
  it("refuses cloud vision when no key is provided", async () => {
    await expect(
      describeImage({ name: "slide.png" }, { requireCloud: true, cloudKey: "", useLocalCaption: false })
    ).rejects.toThrow(/key/i);
  });
});
