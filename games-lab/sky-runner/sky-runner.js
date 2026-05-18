import * as THREE from "../vendor/three.module.min.js";

const host = document.getElementById("sceneHost");
const scoreLabel = document.getElementById("scoreLabel");
const coinLabel = document.getElementById("coinLabel");
const lifeLabel = document.getElementById("lifeLabel");
const messagePanel = document.getElementById("messagePanel");
const messageTitle = document.getElementById("messageTitle");
const messageText = document.getElementById("messageText");
const startButton = document.getElementById("startButton");
const controlButtons = Array.from(document.querySelectorAll("[data-action]"));

const laneXs = [-3.2, 0, 3.2];
const segmentLength = 7.2;
const world = {
  scene: new THREE.Scene(),
  camera: new THREE.PerspectiveCamera(58, 1, 0.1, 180),
  renderer: new THREE.WebGLRenderer({ antialias: true, alpha: false }),
  clock: new THREE.Clock()
};

const state = {
  running: false,
  over: false,
  lives: 3,
  coins: 0,
  score: 0,
  speed: 9,
  distance: 0,
  nextSegment: 0,
  player: null,
  lane: 1,
  targetLane: 1,
  verticalSpeed: 0,
  grounded: true,
  coyote: 0,
  platforms: [],
  coinsList: [],
  hazards: [],
  particles: []
};

const materials = {
  sky: new THREE.Color("#bdeefa"),
  platform: new THREE.MeshStandardMaterial({ color: "#31a77a", roughness: 0.72, metalness: 0.04 }),
  platformTop: new THREE.MeshStandardMaterial({ color: "#78d48b", roughness: 0.7 }),
  hazard: new THREE.MeshStandardMaterial({ color: "#e7352e", roughness: 0.55 }),
  coin: new THREE.MeshStandardMaterial({ color: "#ffc940", roughness: 0.35, metalness: 0.18 }),
  player: new THREE.MeshStandardMaterial({ color: "#2672d9", roughness: 0.52 }),
  playerTrim: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.42 }),
  cloud: new THREE.MeshStandardMaterial({ color: "#ffffff", roughness: 0.8 })
};

initScene();
resetGame();
drawFrame();

function initScene() {
  world.scene.background = materials.sky;
  world.scene.fog = new THREE.Fog("#bdeefa", 30, 118);
  world.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  world.renderer.shadowMap.enabled = true;
  world.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(world.renderer.domElement);

  world.camera.position.set(0, 7.2, 11.5);
  world.camera.lookAt(0, 1.2, -8);

  const hemi = new THREE.HemisphereLight("#ffffff", "#4ba579", 2.4);
  world.scene.add(hemi);

  const sun = new THREE.DirectionalLight("#ffffff", 2.6);
  sun.position.set(-6, 12, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 40;
  sun.shadow.camera.left = -22;
  sun.shadow.camera.right = 22;
  sun.shadow.camera.top = 22;
  sun.shadow.camera.bottom = -22;
  world.scene.add(sun);

  const floorGeo = new THREE.PlaneGeometry(80, 220);
  const floorMat = new THREE.MeshStandardMaterial({ color: "#4ab783", roughness: 0.9 });
  const floor = new THREE.Mesh(floorGeo, floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -1.45, -44);
  floor.receiveShadow = true;
  world.scene.add(floor);

  createPlayer();
  createClouds();
  resize();
  window.addEventListener("resize", resize);
}

function createPlayer() {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(1, 1.15, 1), materials.player);
  body.castShadow = true;
  body.position.y = 0.68;

  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.74, 0.18, 0.08), materials.playerTrim);
  visor.position.set(0, 0.86, 0.52);
  visor.castShadow = true;

  const footGeo = new THREE.BoxGeometry(0.36, 0.18, 0.66);
  const leftFoot = new THREE.Mesh(footGeo, materials.playerTrim);
  const rightFoot = new THREE.Mesh(footGeo, materials.playerTrim);
  leftFoot.position.set(-0.32, 0.14, 0.08);
  rightFoot.position.set(0.32, 0.14, 0.08);
  leftFoot.castShadow = true;
  rightFoot.castShadow = true;

  group.add(body, visor, leftFoot, rightFoot);
  world.scene.add(group);
  state.player = group;
}

function createClouds() {
  for (let i = 0; i < 18; i += 1) {
    const cloud = new THREE.Group();
    const puffCount = 3 + (i % 3);
    for (let j = 0; j < puffCount; j += 1) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(0.55 + j * 0.06, 12, 8), materials.cloud);
      puff.position.set(j * 0.56, Math.sin(j) * 0.1, 0);
      cloud.add(puff);
    }
    cloud.position.set(-16 + (i % 6) * 6.2, 8 + (i % 3) * 1.4, -10 - Math.floor(i / 6) * 22);
    cloud.scale.setScalar(1.1 + (i % 4) * 0.18);
    world.scene.add(cloud);
  }
}

function resetGame() {
  clearObjects();
  state.running = false;
  state.over = false;
  state.lives = 3;
  state.coins = 0;
  state.score = 0;
  state.speed = 9;
  state.distance = 0;
  state.nextSegment = 0;
  state.lane = 1;
  state.targetLane = 1;
  state.verticalSpeed = 0;
  state.grounded = true;
  state.coyote = 0;
  state.player.position.set(0, 0, 2);
  state.player.rotation.set(0, 0, 0);

  for (let i = 0; i < 22; i += 1) createSegment(i);
  updateHud();
  showMessage("Ready?", "Run forward, change lanes, and jump over gaps.", "Start");
}

function clearObjects() {
  [...state.platforms, ...state.coinsList, ...state.hazards, ...state.particles].forEach((entry) => {
    world.scene.remove(entry.mesh || entry);
  });
  state.platforms = [];
  state.coinsList = [];
  state.hazards = [];
  state.particles = [];
}

function createSegment(index) {
  const z = -index * segmentLength;
  const pattern = patternFor(index);
  pattern.lanes.forEach((hasPlatform, lane) => {
    if (!hasPlatform) return;
    createPlatform(lane, z, pattern.colorShift);
  });

  if (pattern.coinLane !== null && pattern.lanes[pattern.coinLane]) {
    createCoin(pattern.coinLane, z - 0.9);
  }

  if (pattern.hazardLane !== null && pattern.lanes[pattern.hazardLane]) {
    createHazard(pattern.hazardLane, z + 0.95);
  }
  state.nextSegment = index + 1;
}

function patternFor(index) {
  const cycle = index % 12;
  const rows = [
    { lanes: [true, true, true], coinLane: 1, hazardLane: null },
    { lanes: [true, true, true], coinLane: 0, hazardLane: 2 },
    { lanes: [true, false, true], coinLane: 2, hazardLane: null },
    { lanes: [false, true, true], coinLane: 1, hazardLane: null },
    { lanes: [true, true, false], coinLane: 0, hazardLane: 1 },
    { lanes: [true, false, true], coinLane: null, hazardLane: 0 },
    { lanes: [true, true, true], coinLane: 2, hazardLane: 1 },
    { lanes: [false, true, false], coinLane: 1, hazardLane: null },
    { lanes: [true, true, true], coinLane: 0, hazardLane: 2 },
    { lanes: [true, false, true], coinLane: 0, hazardLane: null },
    { lanes: [false, true, true], coinLane: 2, hazardLane: 1 },
    { lanes: [true, true, false], coinLane: 1, hazardLane: null }
  ];
  const picked = rows[cycle];
  return { ...picked, colorShift: index % 2 };
}

function createPlatform(lane, z, colorShift) {
  const group = new THREE.Group();
  const base = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.42, 5.8), materials.platform);
  const top = new THREE.Mesh(new THREE.BoxGeometry(2.54, 0.08, 5.58), materials.platformTop);
  base.position.y = -0.26;
  top.position.y = -0.01;
  base.receiveShadow = true;
  top.receiveShadow = true;
  group.add(base, top);
  group.position.set(laneXs[lane], 0, z);
  group.userData = { lane, z };
  if (colorShift) group.scale.z = 0.94;
  world.scene.add(group);
  state.platforms.push({ mesh: group, lane, z, length: 5.8 * group.scale.z });
}

function createCoin(lane, z) {
  const coin = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.12, 24), materials.coin);
  coin.rotation.x = Math.PI / 2;
  coin.position.set(laneXs[lane], 1.25, z);
  coin.castShadow = true;
  world.scene.add(coin);
  state.coinsList.push({ mesh: coin, lane, z, taken: false });
}

function createHazard(lane, z) {
  const hazard = new THREE.Mesh(new THREE.ConeGeometry(0.46, 0.94, 4), materials.hazard);
  hazard.position.set(laneXs[lane], 0.48, z);
  hazard.rotation.y = Math.PI / 4;
  hazard.castShadow = true;
  world.scene.add(hazard);
  state.hazards.push({ mesh: hazard, lane, z, hit: false });
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
  drawFrame();
  if (state.running) requestAnimationFrame(loop);
}

function update(dt) {
  state.distance += state.speed * dt;
  state.speed = Math.min(16, state.speed + dt * 0.12);
  state.score = Math.floor(state.distance * 4) + state.coins * 25;

  updatePlayer(dt);
  updateWorld(dt);
  collectCoins();
  checkHazards();
  checkFall();
  updateHud();
}

function updatePlayer(dt) {
  const player = state.player;
  const targetX = laneXs[state.targetLane];
  player.position.x += (targetX - player.position.x) * Math.min(1, dt * 13);
  player.position.y += state.verticalSpeed * dt;
  state.verticalSpeed -= 23 * dt;

  const supported = isSupported();
  if (supported && state.verticalSpeed <= 0 && player.position.y <= 0.02) {
    player.position.y = 0;
    state.verticalSpeed = 0;
    state.grounded = true;
    state.coyote = 0.1;
  } else {
    state.grounded = false;
    state.coyote = Math.max(0, state.coyote - dt);
  }

  player.rotation.z = (player.position.x - targetX) * -0.08;
  player.rotation.x = state.grounded ? Math.sin(state.distance * 3) * 0.03 : -0.18;
}

function updateWorld(dt) {
  const dz = state.speed * dt;
  const all = [...state.platforms, ...state.coinsList, ...state.hazards];
  all.forEach((entry) => {
    entry.mesh.position.z += dz;
    entry.z += dz;
    if (entry.mesh.rotation) entry.mesh.rotation.y += entry.mesh.geometry && entry.mesh.geometry.type === "CylinderGeometry" ? dt * 4 : 0;
  });

  state.platforms = state.platforms.filter((entry) => recycleEntry(entry, state.platforms));
  state.coinsList = state.coinsList.filter((entry) => recycleEntry(entry, state.coinsList));
  state.hazards = state.hazards.filter((entry) => recycleEntry(entry, state.hazards));

  while (state.nextSegment * segmentLength < state.distance + 150) {
    createSegment(state.nextSegment);
  }
}

function recycleEntry(entry) {
  if (entry.mesh.position.z < 18) return true;
  world.scene.remove(entry.mesh);
  return false;
}

function isSupported() {
  const lane = closestLane();
  return state.platforms.some((platform) => {
    const sameLane = platform.lane === lane;
    const z = platform.mesh.position.z;
    return sameLane && Math.abs(z - state.player.position.z) < platform.length / 2 + 0.3;
  });
}

function closestLane() {
  let best = 0;
  let bestDistance = Infinity;
  laneXs.forEach((x, index) => {
    const distance = Math.abs(state.player.position.x - x);
    if (distance < bestDistance) {
      best = index;
      bestDistance = distance;
    }
  });
  return best;
}

function collectCoins() {
  state.coinsList.forEach((coin) => {
    if (coin.taken) return;
    const closeX = Math.abs(coin.mesh.position.x - state.player.position.x) < 0.85;
    const closeZ = Math.abs(coin.mesh.position.z - state.player.position.z) < 0.9;
    const closeY = Math.abs(coin.mesh.position.y - (state.player.position.y + 0.7)) < 1.1;
    if (!closeX || !closeZ || !closeY) return;
    coin.taken = true;
    state.coins += 1;
    burst(coin.mesh.position, "#ffc940");
    world.scene.remove(coin.mesh);
  });
}

function checkHazards() {
  state.hazards.forEach((hazard) => {
    if (hazard.hit) return;
    const closeX = Math.abs(hazard.mesh.position.x - state.player.position.x) < 0.72;
    const closeZ = Math.abs(hazard.mesh.position.z - state.player.position.z) < 0.78;
    const lowEnough = state.player.position.y < 0.7;
    if (!closeX || !closeZ || !lowEnough) return;
    hazard.hit = true;
    loseLife("Ouch!", "Jump over red spikes or move to a clear lane.");
  });
}

function checkFall() {
  if (state.player.position.y > -3.2) return;
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
  state.targetLane = 1;
  state.lane = 1;
  state.verticalSpeed = 0;
  state.player.position.set(0, 0, 2);
  state.player.rotation.set(0, 0, 0);
  createPlatform(1, state.player.position.z, 0);
  updateHud();
  showMessage(title, `${text} ${state.lives} lives left.`, "Continue");
}

function move(direction) {
  if (!state.running) return;
  state.targetLane = Math.max(0, Math.min(2, state.targetLane + direction));
  state.lane = state.targetLane;
}

function jump() {
  if (!state.running) return;
  if (!state.grounded && state.coyote <= 0) return;
  state.verticalSpeed = 10.6;
  state.grounded = false;
  state.coyote = 0;
}

function burst(position, color) {
  for (let i = 0; i < 10; i += 1) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color }));
    mesh.position.copy(position);
    mesh.userData = {
      life: 0.38,
      velocity: new THREE.Vector3((Math.random() - 0.5) * 3, Math.random() * 2.5, (Math.random() - 0.5) * 3)
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
  updateParticles(Math.min(0.03, world.clock.getDelta()));
  world.camera.position.x += (state.player.position.x * 0.28 - world.camera.position.x) * 0.06;
  world.camera.lookAt(state.player.position.x * 0.22, 1.1 + state.player.position.y * 0.18, -8);
  world.renderer.render(world.scene, world.camera);
}

function updateHud() {
  scoreLabel.textContent = String(state.score);
  coinLabel.textContent = String(state.coins);
  lifeLabel.textContent = String(state.lives);
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
