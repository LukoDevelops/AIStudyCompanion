import { describe, expect, it } from "vitest";
import { selectMmr } from "../src/pipeline/mmr.js";

function jaccard(left, right) {
  const leftSet = new Set(left.tokens);
  const rightSet = new Set(right.tokens);
  const shared = [...leftSet].filter((token) => rightSet.has(token)).length;
  return shared / new Set([...left.tokens, ...right.tokens]).size;
}

describe("MMR selection", () => {
  it('penalizes redundancy with already reserved source representatives', () => {
    const initial = [{id:'seed',relevance:1,tokens:['same']}];
    const candidates = [{id:'repeat',relevance:1,tokens:['same']},{id:'new',relevance:.9,tokens:['different']}];
    expect(selectMmr(candidates,{limit:1,similarity:jaccard,initial})[0].id).toBe('new');
  });
  it('bounds pair comparisons by n times k', () => {
    let calls=0;
    const candidates=Array.from({length:100},(_,id)=>({id,relevance:1}));
    const result=selectMmr(candidates,{limit:10,similarity:()=>{calls++;return .5;}});
    expect(result).toHaveLength(10);
    expect(calls).toBeLessThanOrEqual(100*10);
    expect(candidates).toHaveLength(100);
  });
  it("avoids picking two near-duplicate sentences", () => {
    const selected = selectMmr(
      [
        { id: "a", relevance: 1, tokens: ["retrieval", "source", "information"] },
        { id: "b", relevance: 0.98, tokens: ["retrieval", "source", "information"] },
        { id: "c", relevance: 0.72, tokens: ["pipeline", "orchestration", "controller"] },
      ],
      {
        limit: 2,
        similarity: jaccard,
      }
    );

    const ids = selected.map((item) => item.id).sort();
    expect(ids).toEqual(["a", "c"]);
  });
});
