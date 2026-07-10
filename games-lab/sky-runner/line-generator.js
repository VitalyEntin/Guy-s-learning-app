const canvas = document.getElementById("lineCanvas");
const context = canvas.getContext("2d");
const strip = document.getElementById("segmentStrip");
const platformRatio = document.getElementById("platformRatio");
const gapRatio = document.getElementById("gapRatio");
const jumpRatio = document.getElementById("jumpRatio");
const resetButton = document.getElementById("resetButton");
const slowerButton = document.getElementById("slowerButton");
const fasterButton = document.getElementById("fasterButton");

const LANE_COUNT = 3;
const SEGMENT_WIDTH = 76;
const LANE_GAP = 116;
const PREVIEW_SEGMENTS = 80;
const TARGETS = {
  platform: 0.65,
  gap: 0.3,
  jump: 0.05
};

const laneColors = [
  ["#77f1ff", "#70ff9a"],
  ["#ff3df2", "#9f58ff"],
  ["#ffe96b", "#ff8a38"]
];

const state = {
  segments: [],
  cursor: 0,
  speed: 108,
  lastTime: performance.now(),
  generator: null
};

function reset() {
  state.segments = [];
  state.cursor = 0;
  state.generator = createPlatformLineGenerator();

  while (state.segments.length < 160) {
    state.segments.push(state.generator.nextSegment());
  }
  renderStrip();
}

function createPlatformLineGenerator() {
  return {
    queue: [],
    cycleIndex: 0,
    counts: {
      platform: 0,
      gap: 0,
      jump: 0,
      total: 0
    },

    nextSegment() {
      if (!this.queue.length) this.queue.push(...this.nextChunk());
      const segment = sanitizeSegment(this.queue.shift());
      segment.lanes.forEach((lane) => {
        this.counts.total += 1;
        if (lane.platform) this.counts.platform += 1;
        if (!lane.platform) this.counts.gap += 1;
        if (lane.kind === "jumpGap") this.counts.jump += 1;
      });
      return segment;
    },

    nextChunk() {
      const chunk = this.platformCycle(this.cycleIndex);
      this.cycleIndex += 1;
      return chunk;
    },

    platformCycle(cycleIndex) {
      const flip = cycleIndex % 2 === 1;
      const firstLane = flip ? 2 : 0;
      const lastLane = flip ? 0 : 2;
      return [
        ...this.bridgeColumns(8),
        ...Array.from({ length: 10 }, () => this.gapColumn([0, 2], "gap")),
        ...this.bridgeColumns(3),
        ...Array.from({ length: 12 }, () => this.gapColumn(1, "gap")),
        ...this.bridgeColumns(2),
        ...Array.from({ length: 8 }, () => this.gapColumn([0, 2], "gap")),
        ...this.bridgeColumns(2),
        ...Array.from({ length: 12 }, () => this.gapColumn(1, "gap")),
        ...this.bridgeColumns(1),
        ...Array.from({ length: 6 }, () => this.gapColumn(firstLane, "gap")),
        ...this.bridgeColumns(1),
        ...Array.from({ length: 6 }, () => this.gapColumn(lastLane, "gap")),
        ...this.singleLaneJumpColumns()
      ];
    },

    bridgeColumns(length) {
      return Array.from({ length }, () => makeSegment(["platform", "platform", "platform"]));
    },

    singleLaneJumpColumns() {
      return [
        ...Array.from({ length: 4 }, () => this.gapColumn([0, 2], "jumpGap")),
        ...Array.from({ length: 4 }, () => this.gapColumn(1, "jumpGap")),
        ...this.bridgeColumns(1)
      ];
    },

    gapColumn(gapLanes, kind) {
      const lanesToGap = Array.isArray(gapLanes) ? gapLanes : [gapLanes];
      const lanes = ["platform", "platform", "platform"];
      lanesToGap.forEach((lane) => {
        lanes[lane] = kind;
      });
      return makeSegment(lanes);
    }
  };
}

function makeSegment(kinds) {
  return {
    lanes: kinds.map((kind) => ({
      platform: kind !== "gap" && kind !== "jumpGap",
      kind
    }))
  };
}

function sanitizeSegment(segment) {
  const lanes = segment.lanes.map((lane) => ({ ...lane }));

  for (let lane = 0; lane < LANE_COUNT - 1; lane += 1) {
    if (!lanes[lane].platform && !lanes[lane + 1].platform) {
      lanes[lane + 1] = { platform: true, kind: "platform" };
    }
  }

  if (!lanes.some((lane) => lane.platform)) {
    lanes[1] = { platform: true, kind: "platform" };
  }

  return { lanes };
}

function resize() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(window.innerWidth * dpr);
  canvas.height = Math.floor(window.innerHeight * dpr);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  context.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function update(now) {
  const dt = Math.min(0.04, (now - state.lastTime) / 1000);
  state.lastTime = now;
  state.cursor += state.speed * dt;

  while (state.cursor >= SEGMENT_WIDTH) {
    state.cursor -= SEGMENT_WIDTH;
    state.segments.shift();
    state.segments.push(state.generator.nextSegment());
    renderStrip();
  }

  draw();
  requestAnimationFrame(update);
}

function draw() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const centerY = height * 0.5;
  context.clearRect(0, 0, width, height);
  drawStars(width, height);
  drawLanes(width, centerY);
}

function drawStars(width, height) {
  context.save();
  context.fillStyle = "rgba(119, 241, 255, 0.55)";
  for (let i = 0; i < 80; i += 1) {
    const x = (i * 137 + state.cursor * 0.2) % width;
    const y = (i * 83) % height;
    const size = i % 9 === 0 ? 2 : 1;
    context.globalAlpha = i % 7 === 0 ? 0.55 : 0.2;
    context.fillRect(x, y, size, size);
  }
  context.restore();
}

function drawLanes(width, centerY) {
  const startX = -state.cursor - SEGMENT_WIDTH * 2;
  const visibleCount = Math.ceil(width / SEGMENT_WIDTH) + 5;
  context.save();
  context.translate(0, centerY);

  for (let lane = 0; lane < LANE_COUNT; lane += 1) {
    drawLaneGuide(width, laneY(lane));
  }

  for (let i = 0; i < visibleCount; i += 1) {
    const segment = state.segments[i] || makeSegment(["gap", "platform", "gap"]);
    const x = startX + i * SEGMENT_WIDTH;
    segment.lanes.forEach((laneSegment, lane) => {
      const y = laneY(lane);
      if (!laneSegment.platform) {
        drawGapMarker(x, y, laneSegment.kind === "jumpGap");
        return;
      }
      drawPlatformSegment(x, y, lane, laneSegment.kind === "jumpIsland");
    });
  }

  context.restore();
}

function laneY(lane) {
  return (lane - 1) * LANE_GAP;
}

function drawLaneGuide(width, y) {
  context.strokeStyle = "rgba(119, 241, 255, 0.16)";
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(0, y - 38);
  context.lineTo(width, y - 38);
  context.moveTo(0, y + 38);
  context.lineTo(width, y + 38);
  context.stroke();
}

function drawPlatformSegment(x, y, lane, isJumpIsland) {
  const colors = isJumpIsland ? ["#ff3df2", "#9f58ff"] : laneColors[lane];
  const gradient = context.createLinearGradient(x, y - 30, x, y + 30);
  gradient.addColorStop(0, colors[0]);
  gradient.addColorStop(1, colors[1]);

  context.shadowColor = colors[0];
  context.shadowBlur = 16;
  context.fillStyle = gradient;
  roundedRect(x + 4, y - 30, SEGMENT_WIDTH - 8, 60, 8);
  context.fill();

  context.shadowBlur = 0;
  context.fillStyle = "rgba(255, 255, 255, 0.22)";
  roundedRect(x + 9, y - 25, SEGMENT_WIDTH - 18, 9, 5);
  context.fill();
}

function drawGapMarker(x, y, isJumpGap) {
  context.save();
  context.strokeStyle = isJumpGap ? "rgba(255, 61, 242, 0.7)" : "rgba(255, 255, 255, 0.08)";
  context.setLineDash(isJumpGap ? [4, 5] : [6, 10]);
  context.lineWidth = isJumpGap ? 3 : 2;
  context.beginPath();
  context.moveTo(x + SEGMENT_WIDTH * 0.5, y - 32);
  context.lineTo(x + SEGMENT_WIDTH * 0.5, y + 32);
  context.stroke();
  context.restore();
}

function roundedRect(x, y, width, height, radius) {
  context.beginPath();
  context.moveTo(x + radius, y);
  context.arcTo(x + width, y, x + width, y + height, radius);
  context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius);
  context.arcTo(x, y, x + width, y, radius);
  context.closePath();
}

function renderStrip() {
  const preview = state.segments.slice(0, PREVIEW_SEGMENTS);
  const cells = [];
  preview.forEach((segment, column) => {
    segment.lanes.forEach((laneSegment, lane) => {
      const node = document.createElement("span");
      node.style.gridColumn = String(column + 1);
      node.style.gridRow = String(lane + 1);
      if (laneSegment.platform) {
        node.className = laneSegment.kind === "jumpIsland" ? "jump" : `platform lane-${lane}`;
      }
      if (laneSegment.kind === "jumpGap") node.className = "jump-gap";
      cells.push(node);
    });
  });
  strip.replaceChildren(...cells);
  updateStats();
}

function updateStats() {
  const preview = state.segments.slice(0, PREVIEW_SEGMENTS).flatMap((segment) => segment.lanes);
  const total = Math.max(1, preview.length);
  const platforms = preview.filter((segment) => segment.platform).length;
  const gaps = preview.filter((segment) => segment.kind === "gap").length;
  const jumpGaps = preview.filter((segment) => segment.kind === "jumpGap").length;
  platformRatio.textContent = `${Math.round((platforms / total) * 100)}%`;
  gapRatio.textContent = `${Math.round((gaps / total) * 100)}%`;
  jumpRatio.textContent = `${Math.round((jumpGaps / total) * 100)}%`;
}

function getPreviewSafetyReport() {
  const preview = state.segments.slice(0, PREVIEW_SEGMENTS);
  const unsafeColumns = [];
  preview.forEach((segment, column) => {
    for (let lane = 0; lane < LANE_COUNT - 1; lane += 1) {
      if (!segment.lanes[lane].platform && !segment.lanes[lane + 1].platform) {
        unsafeColumns.push({ column, lanes: [lane, lane + 1] });
      }
    }
  });
  return {
    columns: preview.length,
    unsafeColumns,
    emptyColumns: preview
      .map((segment, column) => segment.lanes.some((lane) => lane.platform) ? null : column)
      .filter((column) => column !== null)
  };
}

window.platformLineLab = {
  state,
  getPreviewSafetyReport
};

resetButton.addEventListener("click", reset);
slowerButton.addEventListener("click", () => {
  state.speed = Math.max(70, state.speed - 30);
});
fasterButton.addEventListener("click", () => {
  state.speed = Math.min(360, state.speed + 30);
});

window.addEventListener("resize", resize);
resize();
reset();
requestAnimationFrame(update);
