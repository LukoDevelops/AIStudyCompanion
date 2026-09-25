import { describe, expect, it } from "vitest";
import {
  centreAndScale,
  fibonacciSphere,
  pickNode,
  project,
  relaxLayout,
} from "../src/ui/graph3d.js";

describe("3D layout", () => {
  it("spreads starting points over a unit sphere", () => {
    const points = fibonacciSphere(24);

    expect(points).toHaveLength(24);

    points.forEach((point) => {
      const radius = Math.sqrt(point.x ** 2 + point.y ** 2 + point.z ** 2);
      expect(radius).toBeGreaterThan(0.85);
      expect(radius).toBeLessThan(1.15);
    });
  });

  it("pushes unlinked nodes apart and pulls linked nodes together", () => {
    const start = [
      { term: "a", x: 0.05, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
      { term: "b", x: -0.05, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    ];

    const distance = (nodes) =>
      Math.sqrt(
        (nodes[0].x - nodes[1].x) ** 2 +
          (nodes[0].y - nodes[1].y) ** 2 +
          (nodes[0].z - nodes[1].z) ** 2
      );

    let apart = start;
    for (let step = 0; step < 30; step += 1) {
      apart = relaxLayout(apart, []);
    }

    expect(distance(apart)).toBeGreaterThan(distance(start));

    let linked = [
      { term: "a", x: 4, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
      { term: "b", x: -4, y: 0, z: 0, vx: 0, vy: 0, vz: 0 },
    ];
    const before = distance(linked);

    for (let step = 0; step < 60; step += 1) {
      linked = relaxLayout(linked, [{ from: "a", to: "b", weight: 2 }]);
    }

    expect(distance(linked)).toBeLessThan(before);
  });
});

describe("keeping the cloud in view", () => {
  it("recentres a drifted cloud and rescales it to a fixed radius", () => {
    const drifted = [
      { term: "a", x: 20, y: 20, z: 20 },
      { term: "b", x: 26, y: 20, z: 20 },
      { term: "c", x: 23, y: 26, z: 20 },
    ];

    const fitted = centreAndScale(drifted, 1.35);
    const radii = fitted.map((node) =>
      Math.sqrt(node.x ** 2 + node.y ** 2 + node.z ** 2)
    );
    const centroid = fitted.reduce((total, node) => total + node.x, 0) / fitted.length;

    expect(Math.max(...radii)).toBeCloseTo(1.35, 5);
    expect(centroid).toBeCloseTo(0, 5);
  });

  it("survives a single node without dividing by zero", () => {
    const fitted = centreAndScale([{ term: "only", x: 3, y: 0, z: 0 }]);

    expect(Number.isFinite(fitted[0].x)).toBe(true);
    expect(fitted[0].x).toBeCloseTo(0, 5);
  });
});

describe("perspective projection", () => {
  const camera = { yaw: 0, pitch: 0, zoom: 1, width: 800, height: 400 };

  it("puts the origin at the centre of the canvas", () => {
    const point = project({ x: 0, y: 0, z: 0 }, camera);

    expect(point.x).toBeCloseTo(400, 5);
    expect(point.y).toBeCloseTo(200, 5);
  });

  it("draws nearer points larger than farther ones", () => {
    const near = project({ x: 1, y: 0, z: -1 }, camera);
    const far = project({ x: 1, y: 0, z: 1 }, camera);

    expect(near.scale).toBeGreaterThan(far.scale);
    expect(near.depth).toBeLessThan(far.depth);
  });

  it("rotates a point around the vertical axis", () => {
    const front = project({ x: 1, y: 0, z: 0 }, camera);
    const turned = project({ x: 1, y: 0, z: 0 }, { ...camera, yaw: Math.PI / 2 });

    expect(Math.abs(turned.x - 400)).toBeLessThan(Math.abs(front.x - 400));
  });
});

describe("hit testing", () => {
  const projected = [
    { term: "far", x: 100, y: 100, radius: 20, depth: 6 },
    { term: "near", x: 105, y: 104, radius: 20, depth: 2 },
    { term: "away", x: 400, y: 300, radius: 12, depth: 3 },
  ];

  it("returns the nearest node under the pointer", () => {
    expect(pickNode(projected, 102, 102).term).toBe("near");
  });

  it("returns nothing when the pointer misses every node", () => {
    expect(pickNode(projected, 700, 20)).toBe(null);
  });
});
