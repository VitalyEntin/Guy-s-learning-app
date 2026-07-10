import * as THREE from "../vendor/three.module.min.js";

const host = document.getElementById("sceneHost");
const scoreLabel = document.getElementById("scoreLabel");
const coinLabel = document.getElementById("coinLabel");
const speedLabel = document.getElementById("speedLabel");
const lifeLabel = document.getElementById("lifeLabel");
const messagePanel = document.getElementById("messagePanel");
const messageTitle = document.getElementById("messageTitle");
const messageText = document.getElementById("messageText");
const startButton = document.getElementById("startButton");
const controlButtons = Array.from(document.querySelectorAll("[data-action]"));

const laneXs = [-3.35, 0, 3.35];
const laneCount = laneXs.length;
const segmentLength = 6.2;
const cycleLength = 80;
const platformWidth = 2.72;
const platformHeight = 0.34;
const lookAheadDistance = 290;
const recycleZ = 30;
const baseSpeed = 8.2;
const speedRampPerSecond = 0.045;
const jumpGapLength = 2;

const palette = {
  sky: "#050716",
  cyan: "#00f5ff",
  magenta: "#ff3df2",
  violet: "#8b5cff",
  yellow: "#ffe75c",
  orange: "#ff8a34",
  green: "#79ff7b",
  darkDeck: "#11162f",
  white: "#f8fbff"
};

const lanePalettes = [
  [palette.cyan, palette.green],
  [palette.magenta, palette.violet],
  [palette.yellow, palette.orange]
];

const world = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(57, 1, 0.1, 190),
  renderer: new THREE.WebGLRenderer({ antialias: true, alpha: false }),
  clock: new THREE.Clock()
};

const materials = {
  deck: new THREE.MeshStandardMaterial({ color: palette.darkDeck, roughness: 0.44, metalness: 0.22 }),
  coin: new THREE.MeshStandardMaterial({
    color: "#ffffff",
    emissive: "#ff4df2",
    emissiveIntensity: 1.35,
    roughness: 0.16,
    metalness: 0.34
  }),
  ship: new THREE.MeshStandardMaterial({
    color: "#208dff",
    emissive: "#004bff",
    emissiveIntensity: 0.6,
    roughness: 0.3,
    metalness: 0.22
  }),
  shipWing: new THREE.MeshStandardMaterial({
    color: palette.white,
    emissive: "#7cf7ff",
    emissiveIntensity: 1.15,
    roughness: 0.22,
    metalness: 0.12
  }),
  glass: new THREE.MeshStandardMaterial({
    color: "#8effff",
    emissive: palette.cyan,
    emissiveIntensity: 1.15,
    roughness: 0.12,
    metalness: 0.08
  }),
  star: new THREE.PointsMaterial({ color: "#c8f7ff", size: 0.044, transparent: true, opacity: 0.58 })
};

const state = {
  running: false,
  over: false,
  lives: 3,
  coins: 0,
  score: 0,
  speed: baseSpeed,
  speedMultiplier: 1,
  distance: 0,
  nextCycleStart: 0,
  player: null,
  lane: 1,
  targetLane: 1,
  verticalSpeed: 0,
  grounded: true,
  coyote: 0,
  laneGrace: 0,
  platforms: [],
  coinsList: [],
  particles: []
};

const materialCache = new Map();

initScene();
resetGame();
drawFrame();

function initScene() {
  world.scene.background = new THREE.Color(palette.sky);
  world.scene.fog = new THREE.Fog(palette.sky, 42, 140);
  world.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  world.renderer.shadowMap.enabled = true;
  world.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(world.renderer.domElement);

  world.camera.position.set(0, 7.4, 12.2);
  world.camera.lookAt(0, 1.2, -10);

  const hemi = new THREE.HemisphereLight("#bffcff", "#100224", 1.65);
  world.scene.add(hemi);

  const key = new THREE.DirectionalLight("#ffe7ff", 2.55);
  key.position.set(-6, 13, 7);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 48;
  key.shadow.camera.left = -24;
  key.shadow.camera.right = 24;
  key.shadow.camera.top = 24;
  key.shadow.camera.bottom = -24;
  world.scene.add(key);

  const cyan = new THREE.PointLight(palette.cyan, 14, 70);
  cyan.position.set(8, 5, -24);
  world.scene.add(cyan);

  const magenta = new THREE.PointLight(palette.magenta, 16, 62);
  magenta.position.set(-8, 5, -18);
  world.scene.add(magenta);

  createStars();
  createShip();
  resize();
  window.addEventListener("resize", resize);
}

function createStars() {
  const geometry = new THREE.BufferGeometry();
  const positions = [];
  for (let i = 0; i < 520; i += 1) {
    positions.push((Math.random() - 0.5) * 110, 5 + Math.random() * 46, 18 - Math.random() * 170);
  }
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  world.scene.add(new THREE.Points(geometry, materials.star));
}

function createShip() {
  const group = new THREE.Group();

  const body = new THREE.Mesh(createShipBodyGeometry(), materials.ship);
  body.position.y = 0.52;
  body.castShadow = true;

  const cockpit = new THREE.Mesh(new THREE.SphereGeometry(0.24, 24, 12), materials.glass);
  cockpit.position.set(0, 0.73, -0.2);
  cockpit.scale.set(0.92, 0.42, 1.2);
  cockpit.castShadow = true;

  const leftWing = new THREE.Mesh(createWingGeometry(-1), materials.shipWing);
  const rightWing = new THREE.Mesh(createWingGeometry(1), materials.shipWing);
  leftWing.position.y = 0.42;
  rightWing.position.y = 0.42;
  leftWing.castShadow = true;
  rightWing.castShadow = true;

  const engine = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.25, 0.28, 20), materials.shipWing);
  engine.position.set(0, 0.46, 0.73);
  engine.rotation.x = Math.PI / 2;
  engine.castShadow = true;

  const flame = new THREE.Mesh(
    new THREE.ConeGeometry(0.2, 0.52, 20),
    new THREE.MeshBasicMaterial({ color: palette.magenta, transparent: true, opacity: 0.88 })
  );
  flame.position.set(0, 0.46, 1.05);
  flame.rotation.x = -Math.PI / 2;

  group.add(body, cockpit, leftWing, rightWing, engine, flame);
  world.scene.add(group);
  state.player = group;
}

function createShipBodyGeometry() {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0, 0.18, -1.0,
    -0.42, 0.02, -0.22,
    0.42, 0.02, -0.22,
    0, 0.5, -0.17,
    -0.31, 0.02, 0.72,
    0.31, 0.02, 0.72,
    0, 0.35, 0.58
  ]);
  const indices = [
    0, 1, 3, 0, 3, 2,
    1, 4, 6, 1, 6, 3,
    3, 6, 5, 3, 5, 2,
    1, 2, 5, 1, 5, 4,
    4, 5, 6,
    0, 2, 1
  ];
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createWingGeometry(side) {
  const geometry = new THREE.BufferGeometry();
  const vertices = new Float32Array([
    0.2 * side, 0.02, -0.18,
    1.08 * side, -0.02, 0.16,
    0.3 * side, 0.02, 0.57,
    0.16 * side, 0.13, 0.05
  ]);
  const indices = [0, 1, 3, 1, 2, 3, 0, 3, 2, 0, 2, 1];
  geometry.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function resetGame() {
  clearObjects();
  state.running = false;
  state.over = false;
  state.lives = 3;
  state.coins = 0;
  state.score = 0;
  state.speed = baseSpeed;
  state.speedMultiplier = 1;
  state.distance = 0;
  state.nextCycleStart = 0;
  state.lane = 1;
  state.targetLane = 1;
  state.verticalSpeed = 0;
  state.grounded = true;
  state.coyote = 0;
  state.laneGrace = 0;
  state.player.position.set(0, 0, 2);
  state.player.rotation.set(0, 0, 0);

  generateUntil(lookAheadDistance);
  updateHud();
  showMessage("Ready?", "Run through neon space, change lanes, and jump the gaps.", "Start");
}

function clearObjects() {
  [...state.platforms, ...state.coinsList, ...state.particles].forEach((entry) => {
    world.scene.remove(entry.mesh || entry);
  });
  state.platforms = [];
  state.coinsList = [];
  state.particles = [];
}

function generateUntil(distanceAhead) {
  while (state.nextCycleStart * segmentLength < state.distance + distanceAhead) {
    createCycle(state.nextCycleStart);
    state.nextCycleStart += cycleLength;
  }
}

function createCycle(startIndex) {
  const rows = createPlatformCycle(Math.floor(startIndex / cycleLength));
  for (let lane = 0; lane < laneCount; lane += 1) {
    let runStart = null;

    for (let offset = 0; offset <= rows.length; offset += 1) {
      const isOpen = offset < rows.length && rows[offset].lanes[lane].platform;
      if (isOpen && runStart === null) runStart = offset;
      if ((!isOpen || offset === rows.length) && runStart !== null) {
        createPlatformRun(lane, startIndex + runStart, offset - runStart);
        runStart = null;
      }
    }
  }

  rows.forEach((row, offset) => {
    const index = startIndex + offset;
    if (index % 4 === 1) return;
    const openLanes = row.lanes.map((lane, laneIndex) => lane.platform ? laneIndex : null).filter((lane) => lane !== null);
    if (!openLanes.length) return;
    const lane = openLanes[(index + Math.floor(index / cycleLength)) % openLanes.length];
    createCoin(lane, -index * segmentLength - 0.8 + state.distance);
  });
}

function createPlatformCycle(cycleIndex) {
  const rows = Array.from({ length: cycleLength }, () => makeTrackSegment(["platform", "platform", "platform"]));
  const firstLane = cycleIndex % laneCount;
  const secondLane = (cycleIndex + 1) % laneCount;
  const thirdLane = (cycleIndex + 2) % laneCount;
  const longGaps = [
    { lane: firstLane, start: 9, length: 12 },
    { lane: secondLane, start: 27, length: 14 },
    { lane: thirdLane, start: 48, length: 12 },
    { lane: firstLane, start: 66, length: 6 }
  ];
  const jumpGaps = [
    { lane: secondLane, index: 7 },
    { lane: thirdLane, index: 23 },
    { lane: firstLane, index: 25 },
    { lane: thirdLane, index: 43 },
    { lane: secondLane, index: 45 },
    { lane: firstLane, index: 63 },
    { lane: secondLane, index: 75 }
  ];

  longGaps.forEach((gap) => carveGap(rows, gap.lane, gap.start, gap.length, "gap"));
  jumpGaps.forEach((gap) => carveJumpGap(rows, gap.lane, gap.index));
  return rows.map(sanitizeSegment);
}

function carveGap(rows, lane, start, length, kind) {
  for (let offset = 0; offset < length; offset += 1) {
    setGap(rows, lane, start + offset, kind);
  }
}

function carveJumpGap(rows, lane, index) {
  if (!rows[index - 1]?.lanes[lane].platform || !rows[index + jumpGapLength]?.lanes[lane].platform) return;
  carveGap(rows, lane, index, jumpGapLength, "jumpGap");
}

function setGap(rows, lane, index, kind) {
  if (!rows[index]) return;
  rows[index].lanes[lane] = { platform: false, kind };
}

function makeTrackSegment(kinds) {
  const lanes = kinds.map((kind) => ({ platform: kind !== "gap" && kind !== "jumpGap", kind }));
  return sanitizeSegment({ lanes });
}

function sanitizeSegment(segment) {
  const lanes = segment.lanes.map((lane) => ({ ...lane }));
  for (let lane = 0; lane < laneCount - 1; lane += 1) {
    if (!lanes[lane].platform && !lanes[lane + 1].platform) {
      lanes[lane + 1] = { platform: true, kind: "platform" };
    }
  }
  if (!lanes.some((lane) => lane.platform)) lanes[1] = { platform: true, kind: "platform" };
  return { lanes };
}

function createPlatformRun(lane, startIndex, segmentCount) {
  const length = segmentCount * segmentLength + 0.18;
  const centerIndex = startIndex + (segmentCount - 1) / 2;
  const z = -centerIndex * segmentLength + state.distance;
  const colorIndex = (lane + Math.floor(startIndex / 5)) % lanePalettes.length;
  const [mainColor, edgeColor] = lanePalettes[colorIndex];
  const deckMaterial = new THREE.MeshStandardMaterial({
    color: mainColor,
    emissive: mainColor,
    emissiveIntensity: 1.05,
    roughness: 0.34,
    metalness: 0.24
  });
  const edgeMaterial = getEdgeMaterial(edgeColor);
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(platformWidth, platformHeight, length), materials.deck);
  const top = new THREE.Mesh(new THREE.BoxGeometry(platformWidth - 0.16, 0.08, length - 0.06), deckMaterial);
  const leftEdge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, length), edgeMaterial);
  const rightEdge = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, length), edgeMaterial);

  base.position.y = -0.26;
  top.position.y = -0.01;
  leftEdge.position.set(-platformWidth / 2 + 0.04, 0.1, 0);
  rightEdge.position.set(platformWidth / 2 - 0.04, 0.1, 0);
  base.receiveShadow = true;
  top.receiveShadow = true;
  group.add(base, top, leftEdge, rightEdge);
  group.position.set(laneXs[lane], 0, z);
  world.scene.add(group);
  state.platforms.push({ mesh: group, lane, z, length, startIndex, endIndex: startIndex + segmentCount - 1 });
}

function getEdgeMaterial(color) {
  if (!materialCache.has(color)) {
    materialCache.set(color, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.84 }));
  }
  return materialCache.get(color);
}

function createCoin(lane, z) {
  const coin = new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.08, 12, 28), materials.coin);
  coin.position.set(laneXs[lane], 1.22, z);
  coin.castShadow = true;
  world.scene.add(coin);
  state.coinsList.push({ mesh: coin, lane, z, taken: false });
}

function startGame() {
  if (state.over) resetGame();
  state.running = true;
  hideMessage();
  world.clock.getDelta();
  requestAnimationFrame(loop);
}

function loop() {
  const dt = Math.min(0.03, world.clock.getDelta());
  if (state.running) update(dt);
  updateParticles(dt);
  drawFrame();
  if (state.running) requestAnimationFrame(loop);
}

function update(dt) {
  state.speedMultiplier += speedRampPerSecond * dt;
  state.speed = baseSpeed * state.speedMultiplier;
  state.distance += state.speed * dt;
  state.score = Math.floor(state.distance * 4) + state.coins * 25;

  updateWorld(dt);
  updatePlayer(dt);
  collectCoins();
  checkFall();
  updateHud();
}

function updatePlayer(dt) {
  const player = state.player;
  const targetX = laneXs[state.targetLane];
  player.position.x += (targetX - player.position.x) * Math.min(1, dt * 14);
  player.position.y += state.verticalSpeed * dt;
  state.verticalSpeed -= 26 * dt;
  state.laneGrace = Math.max(0, state.laneGrace - dt);

  const supported = isSupported() || isLaneChangeRecoverable();
  if (supported && state.verticalSpeed <= 0 && player.position.y <= 0.03) {
    player.position.y = 0;
    state.verticalSpeed = 0;
    state.grounded = true;
    state.coyote = 0.12;
  } else {
    state.grounded = false;
    state.coyote = Math.max(0, state.coyote - dt);
  }

  player.rotation.z = (player.position.x - targetX) * -0.08;
  player.rotation.x = state.grounded ? Math.sin(state.distance * 3) * 0.022 : -0.11;
}

function updateWorld(dt) {
  const dz = state.speed * dt;
  const all = [...state.platforms, ...state.coinsList];
  all.forEach((entry) => {
    entry.mesh.position.z += dz;
    entry.z += dz;
    if (entry.mesh.geometry && entry.mesh.geometry.type === "TorusGeometry") entry.mesh.rotation.y += dt * 5;
  });

  state.platforms = state.platforms.filter(recycleEntry);
  state.coinsList = state.coinsList.filter(recycleEntry);
  generateUntil(lookAheadDistance);
}

function recycleEntry(entry) {
  const halfLength = (entry.length || 0) / 2;
  if (entry.mesh.position.z - halfLength < recycleZ) return true;
  world.scene.remove(entry.mesh);
  return false;
}

function isSupported() {
  return state.platforms.some((platform) => {
    const closeX = Math.abs(platform.mesh.position.x - state.player.position.x) < platformWidth / 2 + 0.26;
    const closeZ = Math.abs(platform.mesh.position.z - state.player.position.z) < platform.length / 2 + 0.35;
    return closeX && closeZ;
  });
}

function isLaneChangeRecoverable() {
  if (state.laneGrace <= 0) return false;
  return state.platforms.some((platform) => {
    const sameLane = platform.lane === state.targetLane;
    const closeZ = Math.abs(platform.mesh.position.z - state.player.position.z) < platform.length / 2 + 1.0;
    return sameLane && closeZ;
  });
}

function collectCoins() {
  state.coinsList.forEach((coin) => {
    if (coin.taken) return;
    const closeX = Math.abs(coin.mesh.position.x - state.player.position.x) < 0.86;
    const closeZ = Math.abs(coin.mesh.position.z - state.player.position.z) < 0.92;
    const closeY = Math.abs(coin.mesh.position.y - (state.player.position.y + 0.7)) < 1.08;
    if (!closeX || !closeZ || !closeY) return;
    coin.taken = true;
    state.coins += 1;
    burst(coin.mesh.position, "#ff8bff");
    world.scene.remove(coin.mesh);
  });
  state.coinsList = state.coinsList.filter((coin) => !coin.taken);
}

function checkFall() {
  if (state.player.position.y > -1.35) return;
  loseLife("Gap!", "Jump earlier or change lanes before the missing platform.");
}

function loseLife(title, text) {
  state.lives -= 1;
  if (state.lives <= 0) {
    state.over = true;
    state.running = false;
    updateHud();
    showMessage("Try again", "No lives left. Restart the run.", "Restart");
    return;
  }

  state.running = false;
  const respawnLane = findSafeRespawnLane();
  state.targetLane = respawnLane;
  state.lane = respawnLane;
  state.verticalSpeed = 0;
  state.laneGrace = 0;
  state.player.position.set(laneXs[respawnLane], 0, 2);
  state.player.rotation.set(0, 0, 0);
  updateHud();
  showMessage(title, `${text} ${state.lives} lives left.`, "Continue");
}

function findSafeRespawnLane() {
  const supportedLanes = state.platforms
    .filter((platform) => Math.abs(platform.mesh.position.z - state.player.position.z) < platform.length / 2 + 0.55)
    .map((platform) => platform.lane);
  if (supportedLanes.includes(state.targetLane)) return state.targetLane;
  if (supportedLanes.includes(1)) return 1;
  return supportedLanes[0] ?? 1;
}

function move(direction) {
  if (!state.running) return;
  const nextLane = Math.max(0, Math.min(2, state.targetLane + direction));
  if (nextLane !== state.targetLane) state.laneGrace = 0.5;
  state.targetLane = nextLane;
  state.lane = state.targetLane;
}

function jump() {
  if (!state.running) return;
  if (!state.grounded && state.coyote <= 0) return;
  state.verticalSpeed = 8.75;
  state.grounded = false;
  state.coyote = 0;
}

function burst(position, color) {
  for (let i = 0; i < 6; i += 1) {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 6),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 })
    );
    mesh.position.copy(position);
    mesh.userData = {
      life: 0.22,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 1.7, Math.random() * 1.5, (Math.random() - 0.5) * 1.7)
    };
    world.scene.add(mesh);
    state.particles.push(mesh);
  }
}

function updateParticles(dt) {
  state.particles.forEach((particle) => {
    particle.userData.life -= dt;
    particle.position.addScaledVector(particle.userData.velocity, dt);
    particle.userData.velocity.y -= 5 * dt;
  });
  state.particles = state.particles.filter((particle) => {
    if (particle.userData.life > 0) return true;
    world.scene.remove(particle);
    return false;
  });
}

function drawFrame() {
  world.camera.position.x += (state.player.position.x * 0.26 - world.camera.position.x) * 0.055;
  world.camera.lookAt(state.player.position.x * 0.18, 1.1 + state.player.position.y * 0.18, -9);
  world.renderer.render(world.scene, world.camera);
}

function updateHud() {
  scoreLabel.textContent = String(state.score);
  coinLabel.textContent = String(state.coins);
  speedLabel.textContent = formatSpeedMultiplier();
  lifeLabel.textContent = String(state.lives);
  document.documentElement.dataset.skyRunner = JSON.stringify(getDebugSnapshot());
}

function formatSpeedMultiplier() {
  const value = state.speedMultiplier.toFixed(1);
  return `${value.endsWith(".0") ? value.slice(0, -2) : value}X`;
}

function showMessage(title, text, buttonText) {
  messageTitle.textContent = title;
  messageText.textContent = text;
  startButton.textContent = buttonText;
  messagePanel.hidden = false;
}

function hideMessage() {
  messagePanel.hidden = true;
}

function resize() {
  const rect = host.getBoundingClientRect();
  world.camera.aspect = Math.max(1, rect.width) / Math.max(1, rect.height);
  world.camera.updateProjectionMatrix();
  world.renderer.setSize(rect.width, rect.height, false);
}

function pressAction(action) {
  if (action === "left") move(-1);
  if (action === "right") move(1);
  if (action === "jump") jump();
}

function getDebugSnapshot() {
  const floatingCoins = state.coinsList.filter((coin) => {
    return !state.platforms.some((platform) => {
      const sameLane = platform.lane === coin.lane;
      const closeZ = Math.abs(platform.mesh.position.z - coin.mesh.position.z) < platform.length / 2 + 0.25;
      return sameLane && closeZ;
    });
  });
  return {
    platforms: state.platforms.length,
    coins: state.coinsList.length,
    floatingCoins: floatingCoins.length,
    lives: state.lives,
    score: state.score,
    speed: Number(state.speed.toFixed(2)),
    speedMultiplier: Number(state.speedMultiplier.toFixed(2)),
    running: state.running
  };
}

window.skyRunnerDebug = { state, createPlatformCycle, getDebugSnapshot };

startButton.addEventListener("click", startGame);

document.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") pressAction("left");
  if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") pressAction("right");
  if (event.key === "ArrowUp" || event.key === " " || event.key.toLowerCase() === "w") pressAction("jump");
});

controlButtons.forEach((button) => {
  const action = button.dataset.action;
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.classList.add("active");
    button.setPointerCapture(event.pointerId);
    pressAction(action);
  });
  button.addEventListener("pointerup", () => button.classList.remove("active"));
  button.addEventListener("pointercancel", () => button.classList.remove("active"));
  button.addEventListener("pointerleave", () => button.classList.remove("active"));
});
