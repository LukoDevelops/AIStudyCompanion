const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
const PALETTE = ["#67dce6", "#77e5b7", "#ffbc75", "#bbabff", "#acd974", "#f19bab"];

/** Spread the starting positions evenly around a sphere. */
export function fibonacciSphere(count) {
  if (count <= 0) {
    return [];
  }

  if (count === 1) {
    return [{ x: 0, y: 0, z: 0 }];
  }

  return Array.from({ length: count }, (_, index) => {
    const y = 1 - (index / (count - 1)) * 2;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const theta = GOLDEN_ANGLE * index;

    return {
      x: Math.cos(theta) * radius,
      y,
      z: Math.sin(theta) * radius,
    };
  });
}

/**
 * Repel nodes, pull linked pairs together, and keep the layout centred.
 */
export function relaxLayout(nodes, edges, options = {}) {
  const {
    repulsion = 0.85,
    spring = 0.06,
    restLength = 1.1,
    centering = 0.02,
    damping = 0.82,
    step = 0.35,
  } = options;

  const forces = nodes.map(() => ({ x: 0, y: 0, z: 0 }));

  for (let i = 0; i < nodes.length; i += 1) {
    for (let j = i + 1; j < nodes.length; j += 1) {
      const dx = nodes[i].x - nodes[j].x;
      const dy = nodes[i].y - nodes[j].y;
      const dz = nodes[i].z - nodes[j].z;
      const distance = Math.max(0.08, Math.sqrt(dx * dx + dy * dy + dz * dz));
      const magnitude = repulsion / (distance * distance);
      const ux = (dx / distance) * magnitude;
      const uy = (dy / distance) * magnitude;
      const uz = (dz / distance) * magnitude;

      forces[i].x += ux;
      forces[i].y += uy;
      forces[i].z += uz;
      forces[j].x -= ux;
      forces[j].y -= uy;
      forces[j].z -= uz;
    }

    forces[i].x -= nodes[i].x * centering;
    forces[i].y -= nodes[i].y * centering;
    forces[i].z -= nodes[i].z * centering;
  }

  const indexOf = new Map(nodes.map((node, index) => [node.term, index]));

  edges.forEach((edge) => {
    const a = indexOf.get(edge.from);
    const b = indexOf.get(edge.to);

    if (a == null || b == null) {
      return;
    }

    const dx = nodes[b].x - nodes[a].x;
    const dy = nodes[b].y - nodes[a].y;
    const dz = nodes[b].z - nodes[a].z;
    const distance = Math.max(0.08, Math.sqrt(dx * dx + dy * dy + dz * dz));
    const strength = (distance - restLength) * spring * Math.min(3, edge.weight || 1);
    const ux = (dx / distance) * strength;
    const uy = (dy / distance) * strength;
    const uz = (dz / distance) * strength;

    forces[a].x += ux;
    forces[a].y += uy;
    forces[a].z += uz;
    forces[b].x -= ux;
    forces[b].y -= uy;
    forces[b].z -= uz;
  });

  return nodes.map((node, index) => {
    const vx = ((node.vx || 0) + forces[index].x * step) * damping;
    const vy = ((node.vy || 0) + forces[index].y * step) * damping;
    const vz = ((node.vz || 0) + forces[index].z * step) * damping;

    return {
      ...node,
      vx,
      vy,
      vz,
      x: node.x + vx * step,
      y: node.y + vy * step,
      z: node.z + vz * step,
    };
  });
}

/**
 * Centre and scale the settled layout to fit the viewport.
 */
export function centreAndScale(nodes, target = 1.35) {
  if (!nodes.length) {
    return nodes;
  }

  const centre = nodes.reduce(
    (total, node) => ({
      x: total.x + node.x / nodes.length,
      y: total.y + node.y / nodes.length,
      z: total.z + node.z / nodes.length,
    }),
    { x: 0, y: 0, z: 0 }
  );

  const centred = nodes.map((node) => ({
    ...node,
    x: node.x - centre.x,
    y: node.y - centre.y,
    z: node.z - centre.z,
  }));

  const radius = Math.max(
    0.0001,
    ...centred.map((node) => Math.sqrt(node.x ** 2 + node.y ** 2 + node.z ** 2))
  );
  const factor = target / radius;

  return centred.map((node) => ({
    ...node,
    x: node.x * factor,
    y: node.y * factor,
    z: node.z * factor,
  }));
}

/**
 * Rotate on Y then X and project to screen coordinates with a depth scale.
 */
export function project(point, camera) {
  const {
    yaw = 0,
    pitch = 0,
    zoom = 1,
    focal = 3.4,
    distance = 4.2,
    width = 800,
    height = 400,
  } = camera;

  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const x1 = point.x * cosYaw - point.z * sinYaw;
  const z1 = point.x * sinYaw + point.z * cosYaw;

  const cosPitch = Math.cos(pitch);
  const sinPitch = Math.sin(pitch);
  const y2 = point.y * cosPitch - z1 * sinPitch;
  const z2 = point.y * sinPitch + z1 * cosPitch;

  const depth = z2 + distance;
  const scale = (focal / Math.max(0.35, depth)) * zoom;

  return {
    x: width / 2 + x1 * scale * (height / 3),
    y: height / 2 + y2 * scale * (height / 3),
    scale,
    depth,
  };
}

export function pickNode(projected, x, y) {
  let found = null;

  projected.forEach((node) => {
    const dx = node.x - x;
    const dy = node.y - y;

    if (Math.sqrt(dx * dx + dy * dy) <= node.radius + 4) {
      if (!found || node.depth < found.depth) {
        found = node;
      }
    }
  });

  return found;
}

function prefersReducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

export function createGraph3d(canvas, { onSelect = () => {}, onHover = () => {} } = {}) {
  if (!canvas || typeof canvas.getContext !== "function") {
    return null;
  }

  const context = canvas.getContext("2d");
  let nodes = [];
  let edges = [];
  let projected = [];
  let camera = { yaw: 0.6, pitch: -0.35, zoom: 1 };
  let spinning = !prefersReducedMotion();
  let dragging = false;
  let lastPointer = null;
  let hovered = null;
  let frame = null;
  let settleSteps = 0;

  function size() {
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    const rect = canvas.getBoundingClientRect();
    const width = Math.max(320, rect.width || canvas.width);
    const height = Math.max(240, rect.height || canvas.height);
    if (canvas.width !== Math.round(width * ratio)) canvas.width = Math.round(width * ratio);
    if (canvas.height !== Math.round(height * ratio)) canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    return { width, height };
  }

  function draw() {
    const { width, height } = size();
    context.clearRect(0, 0, width, height);

    const wash = context.createRadialGradient(
      width * 0.5,
      height * 0.35,
      20,
      width * 0.5,
      height * 0.5,
      Math.max(width, height) * 0.62
    );
    wash.addColorStop(0, "#203e52");
    wash.addColorStop(0.55, "#122b3d");
    wash.addColorStop(1, "#091722");
    context.fillStyle = wash;
    context.fillRect(0, 0, width, height);

    if (!nodes.length) {
      context.fillStyle = "#6b6256";
      context.font = "13px Segoe UI, sans-serif";
      context.textAlign = "center";
      context.fillText("Generate a pack to build the concept map", width / 2, height / 2);
      return;
    }

    if (settleSteps > 0) {
      nodes = centreAndScale(relaxLayout(nodes, edges));
      settleSteps -= 1;
    }

    if (spinning && !dragging && !hovered) {
      camera.yaw += 0.004;
    }

    const view = { ...camera, width, height };
    projected = nodes
      .map((node, index) => {
        const point = project(node, view);
        return {
          ...point,
          index,
          term: node.term,
          evidenceId: node.evidenceId,
          rank: node.rank,
          degree: node.degree,
          radius: Math.max(
            8,
            (10 + Math.min(16, (node.rank || 0) * 48)) * point.scale * 0.85
          ),
        };
      })
      .sort((left, right) => right.depth - left.depth);

    const byIndex = new Map(projected.map((node) => [node.index, node]));
    const indexOf = new Map(nodes.map((node, index) => [node.term, index]));

    const neighbours = new Set(hovered ? [hovered.term] : []);
    edges.forEach(edge => {
      if (hovered && (edge.from === hovered.term || edge.to === hovered.term)) {
        neighbours.add(edge.from); neighbours.add(edge.to);
      }
    });
    edges.forEach((edge) => {
      const from = byIndex.get(indexOf.get(edge.from));
      const to = byIndex.get(indexOf.get(edge.to));

      if (!from || !to) {
        return;
      }

      const active =
        hovered && (hovered.term === edge.from || hovered.term === edge.to);
      const gradient = context.createLinearGradient(from.x, from.y, to.x, to.y);
      gradient.addColorStop(0, active ? "rgba(118,241,232,.95)" : hovered ? "rgba(150,180,200,.06)" : "rgba(150,190,210,.35)");
      gradient.addColorStop(1, active ? "rgba(184,199,255,.95)" : hovered ? "rgba(150,180,200,.06)" : "rgba(120,170,190,.3)");
      context.strokeStyle = gradient;
      context.lineWidth = active ? 2.4 : Math.min(1.7, .6 + Math.log2(1 + (edge.weight || 1)) * .25);
      context.beginPath();
      context.moveTo(from.x, from.y);
      context.quadraticCurveTo(
        (from.x + to.x) / 2 + (from.y - to.y) * 0.08,
        (from.y + to.y) / 2 + (to.x - from.x) * 0.08,
        to.x,
        to.y
      );
      context.stroke();
    });

    projected.forEach((node) => {
      const isHovered = hovered && hovered.term === node.term;
      const isolated = !node.degree;
      const connected = neighbours.has(node.term);
      const fade = hovered && !connected ? .16 : Math.min(1, Math.max(0.65, 1.5 - node.depth / 8));
      const colour = PALETTE[node.index % PALETTE.length];

      context.save();
      context.globalAlpha = fade;
      context.shadowColor = colour;
      context.shadowBlur = isHovered ? 22 : isolated ? 0 : 10;
      const sphere = context.createRadialGradient(node.x - node.radius * .3, node.y - node.radius * .4, 1, node.x, node.y, node.radius);
      sphere.addColorStop(0, "#ffffff"); sphere.addColorStop(.4, colour); sphere.addColorStop(1, "#264355");
      context.fillStyle = sphere;
      context.beginPath();
      context.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
      context.fill();
      context.restore();

      if (isolated) {
        context.save();
        context.setLineDash([3, 3]);
        context.strokeStyle = "rgba(195,215,230,.65)";
        context.lineWidth = 1.4;
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 5, 0, Math.PI * 2);
        context.stroke();
        context.restore();
      }

      if (isHovered || connected) {
        context.strokeStyle = isHovered ? "#ffffff" : "#88f5e4";
        context.lineWidth = 2.2;
        context.beginPath();
        context.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
        context.stroke();
      }

      if (projected.length <= 16 || node.radius > 11 || isHovered) {
        let label = node.term;
        const fontSize = Math.max(11, Math.round(12 * node.scale));
        context.font = `${isHovered ? 700 : 600} ${fontSize}px Segoe UI, sans-serif`;
        context.textAlign = "center";
        while (label.length > 4 && context.measureText(label).width > 168) label = label.slice(0, -2) + '…';
        const plateWidth = context.measureText(label).width + 12;
        const plateX = Math.max(plateWidth / 2 + 4, Math.min(width - plateWidth / 2 - 4, node.x));
        const plateY = Math.min(height - fontSize - 12, node.y + node.radius + 6);
        context.save(); context.globalAlpha = fade;
        context.fillStyle = "rgba(8, 22, 33, .88)";
        context.beginPath();
        context.roundRect?.(plateX - plateWidth / 2, plateY, plateWidth, fontSize + 8, 8);
        if (!context.roundRect) {
          context.fillRect(plateX - plateWidth / 2, plateY, plateWidth, fontSize + 8);
        } else {
          context.fill();
        }
        context.fillStyle = "#e4f0f5";
        context.fillText(label, plateX, plateY + fontSize + 1);
        context.restore();
      }
    });
  }

  function loop() {
    const rect = canvas.getBoundingClientRect();
    if (!document.hidden && !document.body.classList.contains("is-processing") && rect.width > 0 && rect.bottom > 0 && rect.top < window.innerHeight) draw();
    frame = requestAnimationFrame(loop);
  }

  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  canvas.addEventListener("pointerdown", (event) => {
    dragging = true;
    lastPointer = pointerPosition(event);
    canvas.setPointerCapture?.(event.pointerId);
    canvas.classList.add("is-grabbing");
  });

  canvas.addEventListener("pointermove", (event) => {
    const position = pointerPosition(event);

    if (dragging && lastPointer) {
      camera.yaw += (position.x - lastPointer.x) * 0.008;
      camera.pitch = Math.max(
        -1.2,
        Math.min(1.2, camera.pitch + (position.y - lastPointer.y) * 0.006)
      );
      lastPointer = position;
      return;
    }

    const hit = pickNode(projected, position.x, position.y);
    const changed = hit?.term !== hovered?.term;
    hovered = hit;
    canvas.style.cursor = hit ? "pointer" : "grab";

    if (changed) {
      onHover(hit);
    }
  });

  const endDrag = (event) => {
    dragging = false;
    lastPointer = null;
    canvas.releasePointerCapture?.(event.pointerId);
    canvas.classList.remove("is-grabbing");
  };

  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);
  canvas.addEventListener("pointerleave", () => {
    hovered = null;
    onHover(null);
  });

  canvas.addEventListener("click", (event) => {
    const position = pointerPosition(event);
    const hit = pickNode(projected, position.x, position.y);

    if (hit?.evidenceId) {
      onSelect(hit.evidenceId, hit);
    }
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      camera.zoom = Math.min(2.6, Math.max(0.55, camera.zoom - event.deltaY * 0.0012));
    },
    { passive: false }
  );

  canvas.addEventListener("keydown", (event) => {
    const stepSize = 0.12;

    if (event.key === "ArrowLeft") {
      camera.yaw -= stepSize;
    } else if (event.key === "ArrowRight") {
      camera.yaw += stepSize;
    } else if (event.key === "ArrowUp") {
      camera.pitch = Math.max(-1.2, camera.pitch - stepSize);
    } else if (event.key === "ArrowDown") {
      camera.pitch = Math.min(1.2, camera.pitch + stepSize);
    } else {
      return;
    }

    event.preventDefault();
  });

  return {
    setData(concepts, graphEdges) {
      const positions = fibonacciSphere(concepts.length);
      const degrees = new Map();

      (graphEdges || []).forEach((edge) => {
        degrees.set(edge.from, (degrees.get(edge.from) || 0) + 1);
        degrees.set(edge.to, (degrees.get(edge.to) || 0) + 1);
      });

      nodes = centreAndScale(
        concepts.map((concept, index) => ({
          ...positions[index],
          vx: 0,
          vy: 0,
          vz: 0,
          term: concept.term,
          evidenceId: concept.evidenceId,
          rank: concept.pageRank || 0,
          degree: degrees.get(concept.term) || 0,
        }))
      );
      hovered = null;
      edges = graphEdges || [];
      settleSteps = 160;
      camera = { yaw: 0.6, pitch: -0.35, zoom: 1 };

      if (!frame) {
        loop();
      }
    },
    setSpinning(next) {
      spinning = next;
      return spinning;
    },
    get spinning() {
      return spinning;
    },
    recentre() {
      camera = { yaw: 0.6, pitch: -0.35, zoom: 1 };
      settleSteps = 90;
    },
    stop() {
      if (frame) {
        cancelAnimationFrame(frame);
        frame = null;
      }
    },
  };
}
