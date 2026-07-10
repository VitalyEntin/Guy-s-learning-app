(function () {
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const targetEl = document.getElementById("target");
  const scoreEl = document.getElementById("score");
  const livesEl = document.getElementById("lives");
  const targetFlash = document.getElementById("targetFlash");
  const targetFlashText = document.getElementById("targetFlashText");
  const startLayer = document.getElementById("startLayer");
  const endLayer = document.getElementById("endLayer");
  const endText = document.getElementById("endText");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const exitButton = document.getElementById("exitButton");

  const letterPool = [
    { sound: "алеф", text: "א" },
    { sound: "бет", text: "ב" },
    { sound: "гимель", text: "ג" },
    { sound: "далет", text: "ד" },
    { sound: "hей", text: "ה" },
    { sound: "вав", text: "ו" },
    { sound: "заин", text: "ז" },
    { sound: "хет", text: "ח" },
    { sound: "тет", text: "ט" },
    { sound: "йуд", text: "י" },
    { sound: "каф", text: "כ" },
    { sound: "ламед", text: "ל" },
    { sound: "мем", text: "מ" },
    { sound: "нун", text: "נ" },
    { sound: "самех", text: "ס" },
    { sound: "айн", text: "ע" },
    { sound: "пей", text: "פ" },
    { sound: "цади", text: "צ" },
    { sound: "куф", text: "ק" },
    { sound: "реш", text: "ר" },
    { sound: "шин", text: "ש" },
    { sound: "тав", text: "ת" }
  ];

  const syllablePool = [
    { sound: "ба", text: "בָ" },
    { sound: "би", text: "בִ" },
    { sound: "бо", text: "בּוֹ" },
    { sound: "ма", text: "מָ" },
    { sound: "ми", text: "מִ" },
    { sound: "мо", text: "מוֹ" },
    { sound: "ша", text: "שָ" },
    { sound: "ши", text: "שִ" },
    { sound: "шо", text: "שׁוֹ" },
    { sound: "ла", text: "לָ" },
    { sound: "ли", text: "לִ" },
    { sound: "ло", text: "לוֹ" },
    { sound: "ра", text: "רָ" },
    { sound: "ри", text: "רִ" },
    { sound: "ро", text: "רוֹ" },
    { sound: "та", text: "תָ" },
    { sound: "ти", text: "תִ" },
    { sound: "то", text: "תוֹ" },
    { sound: "ну", text: "נוּ" },
    { sound: "ку", text: "כוּ" }
  ];

  const hardPool = [
    { sound: "аба", text: "אַבָּא" },
    { sound: "има", text: "אִמָּא" },
    { sound: "шалом", text: "שָׁלוֹם" },
    { sound: "байт", text: "בַּיִת" },
    { sound: "майм", text: "מַיִם" },
    { sound: "йам", text: "יָם" },
    { sound: "ор", text: "אוֹר" },
    { sound: "сэфер", text: "סֵפֶר" }
  ];

  let width = 0;
  let height = 0;
  let dpr = 1;
  let running = false;
  let ended = false;
  let startedAt = 0;
  let lastFrame = 0;
  let lastSpawn = 0;
  let score = 0;
  let lives = 3;
  let target = letterPool[0];
  let previousTarget = null;
  let targetChangedAt = 0;
  let targetVersion = 0;
  let announceUntil = 0;
  let canStartNewRun = true;
  let paletteHue = 205;
  let bubbles = [];
  let pops = [];

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function activePool() {
    const elapsed = (Date.now() - startedAt) / 1000;
    if (elapsed > 150) return letterPool.concat(syllablePool, hardPool);
    if (elapsed > 70) return syllablePool.concat(letterPool.slice(0, 8));
    return letterPool.slice(0, 12);
  }

  function chooseTarget() {
    const pool = activePool();
    previousTarget = target;
    let next = pool[Math.floor(Math.random() * pool.length)];
    if (pool.length > 1 && next.text === target.text) {
      next = pool[(pool.indexOf(next) + 1) % pool.length];
    }
    target = next;
    targetVersion += 1;
    paletteHue = (paletteHue + 73 + Math.floor(Math.random() * 34)) % 360;
    targetChangedAt = Date.now();
    announceUntil = Date.now() + 1150;
    targetEl.textContent = target.sound;
    targetFlashText.textContent = target.sound;
    document.documentElement.style.setProperty("--bubble-accent", `hsl(${paletteHue}, 78%, 48%)`);
    targetFlash.classList.add("show");
    window.setTimeout(() => {
      if (Date.now() >= announceUntil) targetFlash.classList.remove("show");
    }, 1150);
  }

  function startGame() {
    if (!canStartNewRun && ended) return;
    running = true;
    ended = false;
    startedAt = Date.now();
    lastFrame = performance.now();
    lastSpawn = 0;
    score = 0;
    lives = 3;
    bubbles = [];
    pops = [];
    startLayer.hidden = true;
    endLayer.hidden = true;
    chooseTarget();
    updateHud();
    requestAnimationFrame(loop);
  }

  function finishGame() {
    running = false;
    ended = true;
    endText.textContent = canStartNewRun
      ? `Очки: ${score}. Можно сыграть ещё.`
      : `Очки: ${score}. Игровое время закончилось. Нужно ещё поучиться.`;
    restartButton.disabled = !canStartNewRun;
    endLayer.hidden = false;
  }

  function updateHud() {
    scoreEl.textContent = String(score);
    livesEl.textContent = String(lives);
  }

  function spawnBubble(now) {
    const elapsed = (Date.now() - startedAt) / 1000;
    const interval = Math.max(520, 1120 - elapsed * 6);
    if (now - lastSpawn < interval) return;
    lastSpawn = now;

    const pool = activePool();
    const shouldBeCorrect = Math.random() < 0.34 || bubbles.every((bubble) => bubble.item.text !== target.text);
    let item = shouldBeCorrect ? target : pool[Math.floor(Math.random() * pool.length)];
    if (!shouldBeCorrect && item.text === target.text && pool.length > 1) {
      item = pool[(pool.indexOf(item) + 1) % pool.length];
    }

    const radius = Math.max(34, Math.min(52, width * 0.055 + Math.random() * 14));
    const x = findSpawnX(radius);
    bubbles.push({
      item,
      x,
      y: height + radius + 20,
      radius,
      speed: 55 + Math.random() * 36 + elapsed * 0.18,
      wobble: Math.random() * Math.PI * 2,
      hue: paletteHue + Math.random() * 34 - 17,
      targetVersion
    });
  }

  function findSpawnX(radius) {
    const minX = radius + 12;
    const maxX = Math.max(minX, width - radius - 12);
    for (let attempt = 0; attempt < 28; attempt += 1) {
      const x = minX + Math.random() * Math.max(1, maxX - minX);
      const crowded = bubbles.some((bubble) => {
        if (Math.abs(bubble.y - (height + radius + 20)) > radius + bubble.radius + 86) return false;
        return Math.abs(bubble.x - x) < radius + bubble.radius + 24;
      });
      if (!crowded) return x;
    }
    const lanes = [0.16, 0.32, 0.5, 0.68, 0.84].map((part) => minX + (maxX - minX) * part);
    return lanes.reduce((best, x) => {
      const nearest = bubbles.reduce((min, bubble) => Math.min(min, Math.hypot(bubble.x - x, bubble.y - height)), Infinity);
      const bestNearest = bubbles.reduce((min, bubble) => Math.min(min, Math.hypot(bubble.x - best, bubble.y - height)), Infinity);
      return nearest > bestNearest ? x : best;
    }, lanes[0]);
  }

  function update(delta) {
    bubbles.forEach((bubble) => {
      bubble.y -= bubble.speed * delta;
      bubble.wobble += delta * 2.4;
      bubble.x += Math.sin(bubble.wobble) * delta * 18;
    });

    bubbles = bubbles.filter((bubble) => {
      const gone = bubble.y < -bubble.radius;
      if (gone && bubble.item.text === target.text && bubble.targetVersion === targetVersion) lives -= 1;
      return !gone;
    });

    pops = pops.filter((pop) => {
      pop.age += delta;
      return pop.age < 0.35;
    });

    if (lives <= 0) finishGame();
  }

  function drawBackground() {
    ctx.clearRect(0, 0, width, height);
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.fillStyle = "#ffffff";
    for (let i = 0; i < 14; i += 1) {
      const x = (i * 137 + performance.now() * 0.018) % (width + 120) - 60;
      const y = 70 + (i * 83) % Math.max(120, height - 180);
      ctx.beginPath();
      ctx.arc(x, y, 16 + (i % 4) * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBubble(bubble) {
    const gradient = ctx.createRadialGradient(
      bubble.x - bubble.radius * 0.35,
      bubble.y - bubble.radius * 0.45,
      bubble.radius * 0.2,
      bubble.x,
      bubble.y,
      bubble.radius
    );
    gradient.addColorStop(0, "rgba(255,255,255,0.96)");
    gradient.addColorStop(0.45, `hsla(${bubble.hue}, 82%, 72%, 0.78)`);
    gradient.addColorStop(1, `hsla(${bubble.hue + 24}, 74%, 48%, 0.72)`);
    ctx.fillStyle = gradient;
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(bubble.x, bubble.y, bubble.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = "#163047";
    ctx.font = `800 ${Math.round(bubble.radius * 0.8)}px "Segoe UI", Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.direction = "rtl";
    ctx.fillText(bubble.item.text, bubble.x, bubble.y + 2);
  }

  function drawPops() {
    pops.forEach((pop) => {
      const alpha = 1 - pop.age / 0.35;
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.strokeStyle = pop.good ? "#1f9f68" : "#e7352e";
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(pop.x, pop.y, pop.radius + pop.age * 70, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    });
  }

  function draw() {
    drawBackground();
    bubbles.forEach(drawBubble);
    drawPops();
    drawTargetAnnouncement();
  }

  function drawTargetAnnouncement() {
    if (Date.now() >= announceUntil || !running) return;
    const alpha = Math.max(0, Math.min(1, (announceUntil - Date.now()) / 350));
    ctx.save();
    ctx.globalAlpha = 0.18 * alpha;
    ctx.fillStyle = "#e7352e";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function loop(now) {
    if (!running) return;
    const delta = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    spawnBubble(now);
    update(delta);
    draw();
    updateHud();
    if (running) requestAnimationFrame(loop);
  }

  function popAt(x, y) {
    if (!running) return;
    const grace = Date.now() - targetChangedAt <= 1000;
    const candidates = bubbles
      .map((bubble, index) => ({
        bubble,
        index,
        distance: Math.hypot(x - bubble.x, y - bubble.y),
        good: bubble.item.text === target.text || (grace && previousTarget && bubble.item.text === previousTarget.text)
      }))
      .filter((entry) => entry.distance <= entry.bubble.radius + 8)
      .sort((a, b) => {
        if (a.good !== b.good) return a.good ? -1 : 1;
        return a.distance - b.distance;
      });

    if (!candidates.length) return;

    const { bubble, index, good } = candidates[0];
    bubbles.splice(index, 1);
    pops.push({ x: bubble.x, y: bubble.y, radius: bubble.radius, age: 0, good });
    if (good) {
      score += 1;
      if (score % 3 === 0) chooseTarget();
    } else {
      lives -= 1;
    }
    updateHud();
  }

  canvas.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    const rect = canvas.getBoundingClientRect();
    popAt(event.clientX - rect.left, event.clientY - rect.top);
  }, { passive: false });

  startButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startGame();
  });
  restartButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    startGame();
  });
  exitButton.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    window.parent.postMessage({ type: "guy-game-exit" }, window.location.origin);
  });
  window.addEventListener("resize", resize);

  ["contextmenu", "selectstart", "dragstart", "touchstart", "touchmove", "touchend"].forEach((eventName) => {
    document.addEventListener(eventName, (event) => {
      if (eventName.startsWith("touch")) event.preventDefault();
      if (eventName === "contextmenu" || eventName === "selectstart" || eventName === "dragstart") event.preventDefault();
    }, { passive: false, capture: true });
  });

  window.addEventListener("message", (event) => {
    if (event.origin !== window.location.origin || !event.data || event.data.type !== "guy-play-time") return;
    canStartNewRun = !!event.data.canStart;
    if (ended) {
      restartButton.disabled = !canStartNewRun;
      if (!canStartNewRun) endText.textContent = `Очки: ${score}. Игровое время закончилось. Нужно ещё поучиться.`;
    }
  });

  resize();
  draw();
})();
