import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  normalise,
  shuffle,
  splitSentences,
  tokenize,
} from "../src/pipeline/text.js";

describe("text helpers", () => {
  it("normalises whitespace", () => {
    expect(normalise("  hello   world \n")).toBe("hello world");
  });

  it("splits sentences and keeps short input as one record", () => {
    const long = splitSentences(
      "Retrieval augmented generation uses an external source. Students should check unsupported claims."
    );
    expect(long).toHaveLength(2);

    const short = splitSentences("Source checking helps students.");
    expect(short).toEqual(["Source checking helps students."]);
  });

  it("tokenises text and drops punctuation", () => {
    expect(tokenize("Hello, RAG-style tools.")).toEqual([
      "hello",
      "rag-style",
      "tools",
    ]);
  });

  it("escapes HTML", () => {
    expect(escapeHtml(`<img src="x">`)).toBe("&lt;img src=&quot;x&quot;&gt;");
  });

  it("shuffles deterministically with a supplied random function", () => {
    const random = () => 0;
    expect(shuffle(["a", "b", "c"], random)).toEqual(["b", "c", "a"]);
  });
});
