(function () {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  const levelLabel = document.getElementById("levelLabel");
  const scoreLabel = document.getElementById("scoreLabel");
  const livesLabel = document.getElementById("livesLabel");
  const messagePanel = document.getElementById("messagePanel");
  const messageTitle = document.getElementById("messageTitle");
  const messageText = document.getElementById("messageText");
  const startButton = document.getElementById("startButton");
  const restartButton = document.getElementById("restartButton");
  const pauseButton = document.getElementById("pauseButton");
  const nextButton = document.getElementById("nextButton");
  const touchLanes = Array.from(document.querySelectorAll("[data-hold]"));

  const brickTypes = {
    coral: { hp: 1, color: "#f06d53", trim: "#b93b2d", points: 20 },
    gold: { hp: 1, color: "#ffc940", trim: "#c88712", points: 20 },
    teal: { hp: 1, color: "#22b8b0", trim: "#0b7776", points: 20 },
    blue: { hp: 1, color: "#4b8ce8", trim: "#205cb8", points: 20 },
    armor: { hp: 2, color: "#8d7df2", trim: "#5045a9", points: 45 },
    heavy: { hp: 3, color: "#6a7686", trim: "#333f4f", points: 75 },
    metal: { hp: Infinity, color: "#9aa4ad", trim: "#52606c", points: 0, solid: true }
  };

  const levels = [
    {
      name: "Sunrise wall",
      rows: [
        "....gggg....",
        "...cccccc...",
        "..tttttttt..",
        ".bbbbbbbbbb.",
        "..cccccccc..",
        "...gggggg..."
      ]
    },
    {
      name: "Cracked crown",
      rows: [
        "...aaaaaa...",
        "..agggggga..",
        ".aattttttaa.",
        "..abbbbbba..",
        "...aaccaa...",
        "....aaaa...."
      ]
    },
    {
      name: "Road blocks",
      rows: [
        "..mmm..mmm..",
        ".ccca..accc.",
        ".tttm..mttt.",
        "..bbb..bbb..",
        ".aamm..mmaa.",
        "...gggggg..."
      ]
    },
    {
      name: "Color lanes",
      rows: [
        ".cccc..cccc.",
        "..gggggggg..",
        ".tttt..tttt.",
        "..bbbbbbbb..",
        ".cccc..cccc.",
        "...gggggg..."
      ]
    },
    {
      name: "Shield wave",
      rows: [
        "....aaaa....",
        "..ggccccgg..",
        ".ttaaaaaatt.",
        "..bbhhhhbb..",
        "...cccccc...",
        "....gggg...."
      ]
    },
    {
      name: "Metal gates",
      rows: [
        ".m.cccc.ccm.",
        ".m.gggg.ggm.",
        ".m.tttt.ttm.",
        ".m.bbbb.bbm.",
        ".m.aaaa.aam.",
        "...hhhhhh..."
      ]
    },
    {
      name: "Twin towers",
      rows: [
        ".cc..mm..cc.",
        ".gg..aa..gg.",
        ".tt..hh..tt.",
        ".bb..aa..bb.",
        ".cc..gg..cc.",
        ".hh......hh."
      ]
    },
    {
      name: "Diamond drive",
      rows: [
        ".....hh.....",
        "....aaaa....",
        "...gttttg...",
        "..cbbmmbbc..",
        "...gttttg...",
        "....aaaa....",
        ".....hh....."
      ]
    },
    {
      name: "Garage wall",
      rows: [
        "mhhmhhhhmhhm",
        ".aaggggggaa.",
        ".ttmccccmtt.",
        ".bbmttttmbb.",
        ".aaggggggaa.",
        "mccmhhhhmccm"
      ]
    },
    {
      name: "Final circuit",
      rows: [
        "mhhhaaaahhhm",
        "hccmggggmcch",
        "attmhhhhmtta",
        "abbmttttmbba",
        "hccmggggmcch",
        "mhhhaaaahhhm",
        "...cccccc..."
      ]
    }
  ];

  const maxLevelParam = Number(new URLSearchParams(window.location.search).get("maxLevel") || levels.length);
  const allowedLevelCount = Math.max(1, Math.min(levels.length, Number.isFinite(maxLevelParam) ? Math.floor(maxLevelParam) : levels.length));
  const playableLevels = levels.slice(0, allowedLevelCount);

  const typeByLetter = {
    c: "coral",
    g: "gold",
    t: "teal",
    b: "blue",
    a: "armor",
    h: "heavy",
    m: "metal"
  };

  const state = {
    levelIndex: 0,
    score: 0,
    lives: 3,
    running: false,
    paused: false,
    won: false,
    lost: false,
    frame: 0,
    lastTime: 0,
    input: { left: false, right: false },
    paddle: null,
    balls: [],
    bricks: [],
    bonuses: [],
    particles: [],
    effects: {
      wideUntil: 0,
      narrowUntil: 0,
      slowUntil: 0,
      fastUntil: 0,
      fireUntil: 0
    }
  };

  function resetGame(keepScore) {
    state.running = false;
    state.paused = false;
    state.won = false;
    state.lost = false;
    state.frame = 0;
    state.lastTime = 0;
    state.bonuses = [];
    state.particles = [];
    state.effects = {
      wideUntil: 0,
      narrowUntil: 0,
      slowUntil: 0,
      fastUntil: 0,
      fireUntil: 0
    };
    if (!keepScore) state.score = 0;
    if (!keepScore) state.lives = 3;
    resetPaddleAndBall();
    buildLevel();
    nextButton.hidden = true;
    pauseButton.textContent = "Pause";
    updateHud();
    draw();
  }

  function resetPaddleAndBall() {
    state.paddle = {
      x: width / 2 - 75,
      y: height - 58,
      w: 150,
      h: 17,
      speed: 650
    };
    state.balls = [makeBall(width / 2, height - 86, -0.35, -1)];
  }

  function makeBall(x, y, dx, dy) {
    const mag = Math.hypot(dx, dy) || 1;
    return {
      x,
      y,
      r: 9,
      dx: dx / mag,
      dy: dy / mag,
      speed: 410,
      fireTrail: []
    };
  }

  function buildLevel() {
    const level = playableLevels[state.levelIndex];
    const brickW = 58;
    const brickH = 25;
    const gap = 7;
    const startX = (width - (12 * brickW + 11 * gap)) / 2;
    const startY = 86;

    state.bricks = [];
    level.rows.forEach((row, rowIndex) => {
      row.split("").forEach((letter, colIndex) => {
        if (letter === ".") return;
        const typeName = typeByLetter[letter];
        const type = brickTypes[typeName];
        state.bricks.push({
          x: startX + colIndex * (brickW + gap),
          y: startY + rowIndex * (brickH + gap),
          w: brickW,
          h: brickH,
          type: typeName,
          hp: type.hp,
          maxHp: type.hp,
          wobble: Math.random() * Math.PI * 2
        });
      });
    });
  }

  function startGame() {
    if (state.won || state.lost) resetGame(state.won);
    state.running = true;
    state.paused = false;
    state.lastTime = performance.now();
    hideMessage();
    requestAnimationFrame(loop);
  }

  function loop(now) {
    if (!state.running || state.paused) return;
    const dt = Math.min(0.024, (now - state.lastTime) / 1000 || 0.016);
    state.lastTime = now;
    state.frame += 1;
    update(dt, now);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt, now) {
    updatePaddle(dt);
    updateBalls(dt, now);
    updateBonuses(dt, now);
    updateParticles(dt);
    checkLevelEnd();
    updateHud();
  }

  function updatePaddle(dt) {
    const paddle = state.paddle;
    let dir = 0;
    if (state.input.left) dir -= 1;
    if (state.input.right) dir += 1;
    paddle.w = getPaddleWidth();
    paddle.x += dir * paddle.speed * dt;
    paddle.x = clamp(paddle.x, 20, width - paddle.w - 20);
  }

  function getPaddleWidth() {
    const now = performance.now();
    if (state.effects.wideUntil > now) return 184;
    if (state.effects.narrowUntil > now) return 106;
    return 150;
  }

  function getBallSpeed(ball) {
    const now = performance.now();
    let speed = ball.speed;
    if (state.effects.slowUntil > now) speed *= 0.72;
    if (state.effects.fastUntil > now) speed *= 1.24;
    return speed;
  }

  function updateBalls(dt, now) {
    const fire = state.effects.fireUntil > now;

    state.balls.forEach((ball) => {
      ball.fire = fire;
      ball.fireTrail.push({ x: ball.x, y: ball.y, life: 0.22 });
      if (ball.fireTrail.length > 12) ball.fireTrail.shift();

      ball.x += ball.dx * getBallSpeed(ball) * dt;
      ball.y += ball.dy * getBallSpeed(ball) * dt;

      if (ball.x - ball.r < 16) {
        ball.x = 16 + ball.r;
        ball.dx = Math.abs(ball.dx);
      }
      if (ball.x + ball.r > width - 16) {
        ball.x = width - 16 - ball.r;
        ball.dx = -Math.abs(ball.dx);
      }
      if (ball.y - ball.r < 16) {
        ball.y = 16 + ball.r;
        ball.dy = Math.abs(ball.dy);
      }

      collidePaddle(ball);
      collideBricks(ball);
    });

    state.balls = state.balls.filter((ball) => ball.y - ball.r < height + 18);
    if (!state.balls.length) loseLife();
  }

  function collidePaddle(ball) {
    const p = state.paddle;
    const withinX = ball.x > p.x - ball.r && ball.x < p.x + p.w + ball.r;
    const withinY = ball.y + ball.r > p.y && ball.y - ball.r < p.y + p.h;
    if (!withinX || !withinY || ball.dy < 0) return;

    const hit = (ball.x - (p.x + p.w / 2)) / (p.w / 2);
    const angle = hit * 1.05;
    ball.dx = Math.sin(angle);
    ball.dy = -Math.cos(angle);
    ball.y = p.y - ball.r - 1;
    addSpark(ball.x, p.y, "#ffffff", 7);
  }

  function collideBricks(ball) {
    for (const brick of state.bricks) {
      if (brick.dead || !circleRect(ball, brick)) continue;

      const type = brickTypes[brick.type];
      const fire = ball.fire && !type.solid;
      const prevX = ball.x - ball.dx * 8;
      const prevY = ball.y - ball.dy * 8;

      if (!fire) {
        const cameFromSide = prevX < brick.x || prevX > brick.x + brick.w;
        const cameFromTopBottom = prevY < brick.y || prevY > brick.y + brick.h;
        if (cameFromSide && !cameFromTopBottom) ball.dx *= -1;
        else ball.dy *= -1;
      }

      if (!type.solid) {
        brick.hp = fire ? 0 : brick.hp - 1;
        addSpark(ball.x, ball.y, type.color, 10);
        if (brick.hp <= 0) destroyBrick(brick);
      } else {
        addSpark(ball.x, ball.y, "#d9e2e8", 8);
      }
      return;
    }
  }

  function destroyBrick(brick) {
    brick.dead = true;
    const type = brickTypes[brick.type];
    state.score += type.points;
    addSpark(brick.x + brick.w / 2, brick.y + brick.h / 2, type.color, 18);
    if (Math.random() < 0.2) dropBonus(brick.x + brick.w / 2, brick.y + brick.h / 2);
  }

  function dropBonus(x, y) {
    const choices = [
      { kind: "wide", label: "W", color: "#22b8b0" },
      { kind: "narrow", label: "N", color: "#8d7df2" },
      { kind: "slow", label: "S", color: "#4b8ce8" },
      { kind: "fast", label: "F", color: "#f06d53" },
      { kind: "triple", label: "3", color: "#ffc940" },
      { kind: "fire", label: "B", color: "#f04b30" }
    ];
    const bonus = choices[Math.floor(Math.random() * choices.length)];
    state.bonuses.push({ ...bonus, x, y, w: 34, h: 24, vy: 125, spin: 0 });
  }

  function updateBonuses(dt, now) {
    const p = state.paddle;
    state.bonuses.forEach((bonus) => {
      bonus.y += bonus.vy * dt;
      bonus.spin += dt * 5;
      const caught = bonus.x > p.x && bonus.x < p.x + p.w && bonus.y + bonus.h / 2 > p.y && bonus.y < p.y + p.h + 18;
      if (!caught) return;

      bonus.caught = true;
      applyBonus(bonus.kind, now);
      addSpark(bonus.x, bonus.y, bonus.color, 20);
    });
    state.bonuses = state.bonuses.filter((bonus) => !bonus.caught && bonus.y < height + 40);
  }

  function applyBonus(kind, now) {
    const duration = 9000;
    if (kind === "wide") {
      state.effects.wideUntil = now + duration;
      state.effects.narrowUntil = 0;
    }
    if (kind === "narrow") {
      state.effects.narrowUntil = now + 6500;
      state.effects.wideUntil = 0;
    }
    if (kind === "slow") {
      state.effects.slowUntil = now + duration;
      state.effects.fastUntil = 0;
    }
    if (kind === "fast") {
      state.effects.fastUntil = now + 6500;
      state.effects.slowUntil = 0;
    }
    if (kind === "fire") state.effects.fireUntil = now + 7500;
    if (kind === "triple") tripleBalls();
  }

  function tripleBalls() {
    const source = state.balls[0] || makeBall(width / 2, height - 86, 0, -1);
    const balls = [];
    state.balls.forEach((ball) => {
      balls.push(ball);
      balls.push(makeBall(ball.x, ball.y, ball.dx - 0.55, ball.dy - 0.18));
      balls.push(makeBall(ball.x, ball.y, ball.dx + 0.55, ball.dy - 0.18));
    });
    state.balls = balls.slice(0, 7);
    if (!state.balls.length) state.balls = [source];
  }

  function updateParticles(dt) {
    state.particles.forEach((particle) => {
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 260 * dt;
      particle.life -= dt;
    });
    state.particles = state.particles.filter((particle) => particle.life > 0);
    state.balls.forEach((ball) => {
      ball.fireTrail.forEach((trail) => {
        trail.life -= dt;
      });
      ball.fireTrail = ball.fireTrail.filter((trail) => trail.life > 0);
    });
  }

  function addSpark(x, y, color, count) {
    for (let i = 0; i < count; i += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 45 + Math.random() * 160;
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        color,
        size: 2 + Math.random() * 4,
        life: 0.25 + Math.random() * 0.35
      });
    }
  }

  function checkLevelEnd() {
    const remaining = state.bricks.some((brick) => !brick.dead && !brickTypes[brick.type].solid);
    if (remaining) return;
    state.won = true;
    state.running = false;
    state.score += 200 + state.levelIndex * 150;
      nextButton.hidden = state.levelIndex >= playableLevels.length - 1;
      showMessage(
      state.levelIndex >= playableLevels.length - 1 ? "You cleared all levels" : "Level clear",
      state.levelIndex >= playableLevels.length - 1 ? "Nice run. Restart to play from level one." : "The next pattern adds more trouble.",
      state.levelIndex >= playableLevels.length - 1 ? "Play again" : "Replay level"
    );
    updateHud();
  }

  function lose() {
    state.lost = true;
    state.running = false;
    showMessage("Try again", "All lives are gone. Restart this level and catch a bonus early.", "Restart");
  }

  function loseLife() {
    state.lives -= 1;
    state.running = false;
    state.bonuses = [];
    state.effects.wideUntil = 0;
    state.effects.narrowUntil = 0;
    state.effects.slowUntil = 0;
    state.effects.fastUntil = 0;
    state.effects.fireUntil = 0;
    if (state.lives <= 0) {
      lose();
      updateHud();
      return;
    }
    resetPaddleAndBall();
    showMessage("Life lost", `${state.lives} ${state.lives === 1 ? "life" : "lives"} left. Launch the ball when ready.`, "Launch ball");
    updateHud();
    draw();
  }

  function draw() {
    drawBackground();
    drawBricks();
    drawBonuses();
    drawPaddle();
    drawBalls();
    drawParticles();
    drawActiveEffects();
  }

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, height);
    sky.addColorStop(0, "#bdeefa");
    sky.addColorStop(0.5, "#f6fbff");
    sky.addColorStop(1, "#d8efe8");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, width, height);

    ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
    for (let i = 0; i < 9; i += 1) {
      const x = (i * 97 + 36) % width;
      const y = 42 + (i % 3) * 32;
      pill(x, y, 72 + (i % 2) * 28, 18);
      ctx.fill();
    }

    const hill = ctx.createLinearGradient(0, 360, 0, 700);
    hill.addColorStop(0, "#58b97d");
    hill.addColorStop(1, "#2b8d70");
    ctx.fillStyle = hill;
    ctx.beginPath();
    ctx.moveTo(0, 420);
    ctx.bezierCurveTo(110, 360, 200, 435, 320, 382);
    ctx.bezierCurveTo(465, 316, 540, 430, 720, 360);
    ctx.lineTo(width, height);
    ctx.lineTo(0, height);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(34, 48, 66, 0.12)";
    ctx.fillRect(0, height - 150, width, 150);
    ctx.fillStyle = "rgba(255, 255, 255, 0.34)";
    for (let y = height - 124; y < height; y += 42) {
      ctx.fillRect(64, y, width - 128, 8);
    }
  }

  function drawBricks() {
    state.bricks.forEach((brick) => {
      if (brick.dead) return;
      drawBrick(brick);
    });
  }

  function drawBrick(brick) {
    const type = brickTypes[brick.type];
    const x = brick.x;
    const y = brick.y + Math.sin(state.frame / 38 + brick.wobble) * 0.4;
    const gradient = ctx.createLinearGradient(x, y, x, y + brick.h);
    gradient.addColorStop(0, lighten(type.color, 28));
    gradient.addColorStop(0.58, type.color);
    gradient.addColorStop(1, type.trim);

    ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
    roundRect(x + 2, y + 4, brick.w, brick.h, 7);
    ctx.fill();

    ctx.fillStyle = gradient;
    roundRect(x, y, brick.w, brick.h, 7);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.46)";
    ctx.lineWidth = 2;
    roundRect(x + 2, y + 2, brick.w - 4, brick.h - 6, 5);
    ctx.stroke();

    if (type.solid) {
      ctx.fillStyle = "rgba(34, 48, 66, 0.42)";
      ctx.beginPath();
      ctx.arc(x + 12, y + 10, 3, 0, Math.PI * 2);
      ctx.arc(x + brick.w - 12, y + brick.h - 9, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    if (brick.maxHp > 1 && brick.hp < brick.maxHp) drawCracks(x, y, brick);
  }

  function drawCracks(x, y, brick) {
    ctx.strokeStyle = "rgba(31, 38, 48, 0.62)";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + 14, y + 7);
    ctx.lineTo(x + 24, y + 14);
    ctx.lineTo(x + 18, y + 22);
    ctx.moveTo(x + 27, y + 12);
    ctx.lineTo(x + 38, y + 8);
    ctx.moveTo(x + 24, y + 15);
    ctx.lineTo(x + 35, y + 22);
    if (brick.hp < brick.maxHp - 1) {
      ctx.moveTo(x + 8, y + 19);
      ctx.lineTo(x + 18, y + 15);
      ctx.moveTo(x + 34, y + 14);
      ctx.lineTo(x + 42, y + 19);
    }
    ctx.stroke();
  }

  function drawPaddle() {
    const p = state.paddle;
    const base = ctx.createLinearGradient(p.x, p.y, p.x, p.y + p.h);
    base.addColorStop(0, "#fff7d6");
    base.addColorStop(0.24, "#ffc940");
    base.addColorStop(1, "#d58817");

    ctx.fillStyle = "rgba(0, 0, 0, 0.2)";
    roundRect(p.x + 3, p.y + 6, p.w, p.h, 9);
    ctx.fill();

    ctx.fillStyle = base;
    roundRect(p.x, p.y, p.w, p.h, 9);
    ctx.fill();

    ctx.fillStyle = "#e7352e";
    roundRect(p.x + 14, p.y + 4, p.w - 28, 5, 3);
    ctx.fill();

    ctx.fillStyle = "rgba(255, 255, 255, 0.66)";
    roundRect(p.x + p.w * 0.2, p.y + 2, p.w * 0.35, 3, 3);
    ctx.fill();
  }

  function drawBalls() {
    state.balls.forEach((ball) => {
      if (ball.fire) {
        ball.fireTrail.forEach((trail) => {
          ctx.globalAlpha = Math.max(0, trail.life / 0.22) * 0.45;
          ctx.fillStyle = "#ff6b35";
          ctx.beginPath();
          ctx.arc(trail.x, trail.y, ball.r * 1.9, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.globalAlpha = 1;
      }

      const glow = ctx.createRadialGradient(ball.x - 3, ball.y - 4, 2, ball.x, ball.y, ball.r + 8);
      glow.addColorStop(0, "#ffffff");
      glow.addColorStop(0.42, ball.fire ? "#ffd15c" : "#ecf7ff");
      glow.addColorStop(1, ball.fire ? "#f04b30" : "#2672d9");
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(34, 48, 66, 0.18)";
      ctx.lineWidth = 2;
      ctx.stroke();
    });
  }

  function drawBonuses() {
    state.bonuses.forEach((bonus) => {
      ctx.save();
      ctx.translate(bonus.x, bonus.y);
      ctx.rotate(Math.sin(bonus.spin) * 0.12);
      ctx.fillStyle = "rgba(0, 0, 0, 0.17)";
      roundRect(-bonus.w / 2 + 2, -bonus.h / 2 + 4, bonus.w, bonus.h, 9);
      ctx.fill();
      ctx.fillStyle = bonus.color;
      roundRect(-bonus.w / 2, -bonus.h / 2, bonus.w, bonus.h, 9);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.7)";
      roundRect(-bonus.w / 2 + 4, -bonus.h / 2 + 3, bonus.w - 8, 5, 3);
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.font = "800 16px Trebuchet MS, Arial";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(bonus.label, 0, 1);
      ctx.restore();
    });
  }

  function drawParticles() {
    state.particles.forEach((particle) => {
      ctx.globalAlpha = Math.max(0, particle.life / 0.6);
      ctx.fillStyle = particle.color;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;
  }

  function drawActiveEffects() {
    const now = performance.now();
    const active = [];
    if (state.effects.wideUntil > now) active.push(["Wide", state.effects.wideUntil]);
    if (state.effects.narrowUntil > now) active.push(["Narrow", state.effects.narrowUntil]);
    if (state.effects.slowUntil > now) active.push(["Slow", state.effects.slowUntil]);
    if (state.effects.fastUntil > now) active.push(["Fast", state.effects.fastUntil]);
    if (state.effects.fireUntil > now) active.push(["Fireball", state.effects.fireUntil]);
    if (!active.length) return;

    ctx.font = "800 15px Trebuchet MS, Arial";
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    active.forEach((effect, index) => {
      const [label, until] = effect;
      const seconds = Math.max(1, Math.ceil((until - now) / 1000));
      const x = 22;
      const y = height - 36 - index * 31;
      ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
      roundRect(x, y - 13, 128, 25, 8);
      ctx.fill();
      ctx.fillStyle = "#223042";
      ctx.fillText(`${label} ${seconds}s`, x + 12, y);
    });
  }

  function updateHud() {
    levelLabel.textContent = String(state.levelIndex + 1);
    scoreLabel.textContent = String(state.score);
    livesLabel.textContent = String(state.lives);
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

  function nextLevel() {
    if (state.levelIndex < playableLevels.length - 1) state.levelIndex += 1;
    resetGame(true);
    showMessage(playableLevels[state.levelIndex].name, "A fresh brick pattern is ready.", "Start level");
  }

  function circleRect(ball, rect) {
    const closestX = clamp(ball.x, rect.x, rect.x + rect.w);
    const closestY = clamp(ball.y, rect.y, rect.y + rect.h);
    return Math.hypot(ball.x - closestX, ball.y - closestY) < ball.r;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function roundRect(x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function pill(x, y, w, h) {
    roundRect(x, y, w, h, h / 2);
  }

  function lighten(hex, amount) {
    const value = hex.replace("#", "");
    const r = clamp(parseInt(value.slice(0, 2), 16) + amount, 0, 255);
    const g = clamp(parseInt(value.slice(2, 4), 16) + amount, 0, 255);
    const b = clamp(parseInt(value.slice(4, 6), 16) + amount, 0, 255);
    return `rgb(${r}, ${g}, ${b})`;
  }

  function setHold(direction, isDown) {
    state.input[direction] = isDown;
    touchLanes
      .filter((lane) => lane.dataset.hold === direction)
      .forEach((lane) => lane.classList.toggle("active", isDown));
  }

  startButton.addEventListener("click", startGame);
  restartButton.addEventListener("click", () => {
    resetGame(false);
    showMessage("Ready?", "Break all colored bricks. Metal bricks stay on the board.", "Start game");
  });
  pauseButton.addEventListener("click", () => {
    if (!state.running && !state.paused) return;
    state.paused = !state.paused;
    pauseButton.textContent = state.paused ? "Resume" : "Pause";
    if (state.paused) {
      showMessage("Paused", "Take a breath, then resume the run.", "Resume");
    } else {
      hideMessage();
      state.lastTime = performance.now();
      requestAnimationFrame(loop);
    }
  });
  nextButton.addEventListener("click", nextLevel);

  document.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") setHold("left", true);
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") setHold("right", true);
    if (event.key === " " && !state.running) startGame();
  });
  document.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft" || event.key.toLowerCase() === "a") setHold("left", false);
    if (event.key === "ArrowRight" || event.key.toLowerCase() === "d") setHold("right", false);
  });

  touchLanes.forEach((lane) => {
    const direction = lane.dataset.hold;
    lane.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      lane.setPointerCapture(event.pointerId);
      setHold(direction, true);
      if (!state.running && !state.paused && !state.won && !state.lost) startGame();
    });
    lane.addEventListener("pointerup", () => setHold(direction, false));
    lane.addEventListener("pointercancel", () => setHold(direction, false));
    lane.addEventListener("pointerleave", () => setHold(direction, false));
  });

  window.addEventListener("blur", () => {
    setHold("left", false);
    setHold("right", false);
  });

  resetGame(false);
})();
