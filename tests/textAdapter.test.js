import { describe, expect, it } from "vitest";
import { collectTextSource } from "../src/adapters/textAdapter.js";

describe("text adapter", () => {
  it("uses pasted notes when no file is given", async () => {
    const source = await collectTextSource({
      notes: "  Lecture notes about retrieval.  ",
    });

    expect(source.label).toBe("Text notes");
    expect(source.text).toBe("Lecture notes about retrieval.");
    expect(source.origin).toBe("paste");
  });

  it("reads a text file when provided", async () => {
    const file = new File(["Imported file notes about source checking."], "notes.txt", {
      type: "text/plain",
    });

    const source = await collectTextSource({ notes: "", file });
    expect(source.origin).toBe("file");
    expect(source.text).toContain("Imported file notes");
  });

  it("returns null for empty input", async () => {
    await expect(collectTextSource({ notes: "   " })).resolves.toBeNull();
  });
});
