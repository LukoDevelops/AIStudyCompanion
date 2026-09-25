import { escapeHtml } from "../pipeline/text.js";

const PALETTE = [
  ["#21455a", "#4c8aa3"],
  ["#0f6e62", "#3aa892"],
  ["#c46a2d", "#e39a55"],
  ["#7a4e9a", "#b07ad4"],
  ["#2f7d52", "#5bb07a"],
  ["#8a5a3a", "#c48b5c"],
];

function colour(index) {
  return PALETTE[index % PALETTE.length][0];
}

function colourPair(index) {
  return PALETTE[index % PALETTE.length];
}

function reducedMotion() {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

function animationStyle(index) {
  return reducedMotion() ? "" : ` style="animation-delay:${index * 55}ms"`;
}

function tipAttributes(text) {
  const safe = escapeHtml(text);
  return `data-tip="${safe}" tabindex="0" role="img" aria-label="${safe}"`;
}

function gradientDefs(count, prefix) {
  return Array.from({ length: Math.max(1, count) }, (_, index) => {
    const [from, to] = colourPair(index);
    return `<linearGradient id="${prefix}${index}" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${from}" />
      <stop offset="100%" stop-color="${to}" />
    </linearGradient>`;
  }).join("");
}

// Keep the public name for callers; HTML labels remain readable without SVG scaling.
export function barChartSvg(items, options = {}) {
  const { mode = "count" } = options;
  if (!items?.length) return '<p class="muted">No data yet</p>';
  const percent = mode === "percent";
  const max = percent ? 100 : Math.max(1, ...items.map(item => item.value));
  return '<div class="coverage-bars">' + items.map((item, index) => {
    const value = percent ? item.percent ?? 0 : item.value;
    const display = percent ? value + "%" : String(value);
    const width = Math.max(0, Math.min(100, value / max * 100));
    return '<div class="coverage-row"><span class="coverage-name">' + escapeHtml(item.label) +
      '</span><div class="coverage-meter"><div class="coverage-track" role="img" aria-label="' +
      escapeHtml(item.label + ": " + display + (item.total != null ? " of " + item.total + " sentences" : "")) +
      '"><span style="width:' + width + '%;background:' + colour(index) +
      '"></span></div><strong>' + escapeHtml(display) + '</strong></div></div>';
  }).join("") + '</div>';
}

export function histogramSvg(bins, options = {}) {
  const { width = 380, height = 196 } = options;

  if (!bins?.length) {
    return emptySvg(width, height, "No data yet");
  }

  const max = Math.max(1, ...bins.map((bin) => bin.value));
  const gap = bins.length > 6 ? 6 : 12;
  const left = 28;
  const bottom = 36;
  const top = 16;
  const chartHeight = height - bottom - top;
  const barWidth = (width - left * 2 - gap * (bins.length - 1)) / bins.length;
  const grid = [0.25, 0.5, 0.75, 1]
    .map((part) => {
      const y = top + chartHeight * (1 - part);
      return `<line x1="${left}" x2="${width - left}" y1="${y}" y2="${y}" class="chart-grid" />`;
    })
    .join("");

  const bars = bins
    .map((bin, index) => {
      const barHeight = Math.max(4, (bin.value / max) * chartHeight);
      const x = left + index * (barWidth + gap);
      const y = height - bottom - barHeight;
      const tip = `${bin.label}% grounding: ${bin.value} item${bin.value === 1 ? "" : "s"}`;

      return `
        <rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="8" fill="url(#histGrad${index})"
          class="chart-bar chart-rise" ${tipAttributes(tip)}
          style="transform-origin:${x + barWidth / 2}px ${height - bottom}px${reducedMotion() ? "" : `;animation-delay:${index * 55}ms`}" />
        <text x="${x + barWidth / 2}" y="${height - 14}" text-anchor="middle" class="chart-label">${escapeHtml(bin.label)}</text>
      `;
    })
    .join("");

  return wrapSvg(
    width,
    height,
    `${grid}<line x1="${left}" x2="${width - left}" y1="${height - bottom}" y2="${height - bottom}" class="chart-axis" />${bars}`,
    gradientDefs(bins.length, "histGrad")
  );
}

export function donutSvg(items, options = {}) {
  const { size = 220 } = options;

  if (!items?.length) {
    return emptySvg(size, size, "No data yet");
  }

  const total = items.reduce((sum, item) => sum + item.value, 0) || 1;
  const radius = 68;
  const inner = 40;
  const cx = 88;
  const cy = size / 2;
  let angle = -Math.PI / 2;

  const slices = items
    .map((item, index) => {
      const sweep = (item.value / total) * Math.PI * 2;
      const start = angle;
      angle += sweep;
      const percent = Math.round((item.value / total) * 100);
      const tip = `${item.label}: ${item.value} question${item.value === 1 ? "" : "s"} (${percent}%)`;

      return `<path d="${ringPath(cx, cy, radius, inner, start, angle)}" fill="url(#donutGrad${index})"
        class="chart-slice chart-fade" ${tipAttributes(tip)}${animationStyle(index)} />`;
    })
    .join("");

  const legend = items
    .map((item, index) => {
      const percent = Math.round((item.value / total) * 100);
      const y = cy - items.length * 13 + index * 26;
      return `
        <rect x="176" y="${y}" width="12" height="12" rx="4" fill="url(#donutGrad${index})" />
        <text x="194" y="${y + 10}" class="chart-label">${escapeHtml(item.label)}</text>
        <text x="${size + 148}" y="${y + 10}" text-anchor="end" class="chart-value">${item.value} · ${percent}%</text>
      `;
    })
    .join("");

  return wrapSvg(
    size + 160,
    size,
    `${slices}<text x="${cx}" y="${cy - 2}" text-anchor="middle" class="chart-centre">${total}</text>
     <text x="${cx}" y="${cy + 16}" text-anchor="middle" class="chart-label">questions</text>${legend}`,
    gradientDefs(items.length, "donutGrad")
  );
}

export function conceptGraphSvg(concepts, edges, options = {}) {
  const { width = 560, height = 400, minWeight = 1 } = options;

  if (!concepts?.length) {
    return emptySvg(width, height, "No concepts yet");
  }

  const cx = width / 2;
  const cy = height / 2 + 4;
  const radius = Math.min(width, height) / 2 - 90;
  const nodes = concepts.map((concept, index) => {
    const angle = (index / concepts.length) * Math.PI * 2 - Math.PI / 2;
    return {
      term: concept.term,
      evidenceId: concept.evidenceId,
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      rank: concept.pageRank || 0,
    };
  });
  // External label rails prevent long concepts colliding with neighbouring nodes.
  for (const left of [true, false]) {
    const side = nodes.filter(node => (node.x < cx) === left).sort((a,b) => a.y-b.y);
    side.forEach((node, index) => {
      node.labelX = left ? 14 : width-14;
      node.labelY = side.length === 1 ? cy : 40 + index * (height-80)/(side.length-1);
      node.anchor = left ? 'start' : 'end';
      node.label = node.term.length > 24 ? node.term.slice(0,23) + '…' : node.term;
      node.leadX = left ? 146 : width-146;
    });
  }
  const lookup = new Map(nodes.map((node) => [node.term, node]));
  const visible = (edges || []).filter((edge) => (edge.weight || 1) >= minWeight);

  const lines = visible
    .map((edge, index) => {
      const from = lookup.get(edge.from);
      const to = lookup.get(edge.to);

      if (!from || !to) {
        return "";
      }

      const mx = (from.x + to.x) / 2;
      const my = (from.y + to.y) / 2;
      const bumpX = mx + (cy - my) * 0.18;
      const bumpY = my + (mx - cx) * 0.18;

      return `<path d="M ${from.x} ${from.y} Q ${bumpX} ${bumpY} ${to.x} ${to.y}" class="chart-edge" data-from="${escapeHtml(edge.from)}" data-to="${escapeHtml(edge.to)}"
        stroke-width="${Math.min(2.5, .8 + Math.log2(1 + (edge.weight || 1)) * .45)}" fill="none"
        style="animation-delay:${index * 35}ms" />`;
    })
    .join("");

  const circles = nodes
    .map((node, index) => {
      const r = 10 + Math.min(8, (node.rank || 0) * 30);
      const degree = visible.filter(
        (edge) => edge.from === node.term || edge.to === node.term
      ).length;
      const tip =
        degree === 0
          ? `${node.term}: no overlapping wording with the other ideas`
          : `${node.term}: ${degree} link${degree === 1 ? "" : "s"}, rank ${node.rank || 0}`;

      return `
        <circle cx="${node.x}" cy="${node.y}" r="${r + 6}" class="chart-node-halo" />
        <circle cx="${node.x}" cy="${node.y}" r="${r}" fill="url(#graphGrad${index})"
          data-term="${escapeHtml(node.term)}" class="chart-node chart-fade ${degree ? "" : "is-isolated"}" data-evidence-id="${escapeHtml(node.evidenceId || "")}"
          ${tipAttributes(tip)}${animationStyle(index)} />
        <path d="M ${node.x} ${node.y} L ${node.leadX} ${node.labelY}" class="graph-label-leader" fill="none" />
        <text data-term="${escapeHtml(node.term)}" x="${node.labelX}" y="${node.labelY + 4}" text-anchor="${node.anchor}" class="chart-label graph-label">${escapeHtml(node.label)}</text>
      `;
    })
    .join("");

  return wrapSvg(
    width,
    height,
    `<circle cx="${cx}" cy="${cy}" r="${radius + 28}" class="chart-orbit" />${lines}${circles}`,
    gradientDefs(nodes.length, "graphGrad")
  );
}

function ringPath(cx, cy, outer, inner, start, end) {
  if (end - start >= Math.PI * 2 - 0.0001) {
    return `M ${cx - outer} ${cy} a ${outer} ${outer} 0 1 0 ${outer * 2} 0 a ${outer} ${outer} 0 1 0 ${-outer * 2} 0
            M ${cx - inner} ${cy} a ${inner} ${inner} 0 1 1 ${inner * 2} 0 a ${inner} ${inner} 0 1 1 ${-inner * 2} 0`;
  }

  const large = end - start > Math.PI ? 1 : 0;
  const outerStart = polar(cx, cy, outer, start);
  const outerEnd = polar(cx, cy, outer, end);
  const innerEnd = polar(cx, cy, inner, end);
  const innerStart = polar(cx, cy, inner, start);
  return `M ${outerStart.x} ${outerStart.y} A ${outer} ${outer} 0 ${large} 1 ${outerEnd.x} ${outerEnd.y}
          L ${innerEnd.x} ${innerEnd.y} A ${inner} ${inner} 0 ${large} 0 ${innerStart.x} ${innerStart.y} Z`;
}

function polar(cx, cy, radius, angle) {
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function emptySvg(width, height, message) {
  return wrapSvg(
    width,
    height,
    `<text x="${width / 2}" y="${height / 2}" text-anchor="middle" class="chart-label">${escapeHtml(message)}</text>`
  );
}

function wrapSvg(width, height, inner, defs = "") {
  return `<svg class="chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" role="group">
    <defs>${defs}<filter id="nodeSoft" x="-30%" y="-30%" width="160%" height="160%">
      <feDropShadow dx="0" dy="1" stdDeviation="1.4" flood-color="#1f1a14" flood-opacity=".18" />
    </filter></defs>
    ${inner}
  </svg>`;
}

/**
 * Share one tooltip across charts, following pointer and keyboard focus.
 */
export function bindChartTooltips() {
  const tip = document.getElementById("chartTip");

  if (!tip || tip.dataset.bound === "true") {
    return;
  }

  tip.dataset.bound = "true";

  const show = (target) => {
    const text = target.dataset.tip;

    if (!text) {
      return;
    }

    tip.textContent = text;
    tip.classList.add("is-visible");
    tip.setAttribute("aria-hidden", "false");
    const box = target.getBoundingClientRect();
    const tipBox = tip.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, box.left + box.width / 2 - tipBox.width / 2),
      window.innerWidth - tipBox.width - 8
    );
    const top = box.top - tipBox.height - 10;
    tip.style.left = `${left}px`;
    tip.style.top = `${top < 8 ? box.bottom + 10 : top}px`;
  };

  const hide = () => {
    tip.classList.remove("is-visible");
    tip.setAttribute("aria-hidden", "true");
  };

  document.addEventListener("pointerover", (event) => {
    const target = event.target.closest?.("[data-tip]");

    if (target) {
      show(target);
    }
  });

  document.addEventListener("pointerout", (event) => {
    if (event.target.closest?.("[data-tip]")) {
      hide();
    }
  });

  document.addEventListener("focusin", (event) => {
    const target = event.target.closest?.("[data-tip]");

    if (target) {
      show(target);
    }
  });

  document.addEventListener("focusout", hide);
  window.addEventListener("scroll", hide, { passive: true });
}
