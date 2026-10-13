"use strict";

(() => {
  const canvas = document.querySelector("#game-canvas");
  const context = canvas.getContext("2d");
  const elements = {
    score: document.querySelector("#score-value"),
    scoreLabel: document.querySelector("#score-label"),
    time: document.querySelector("#time-value"),
    level: document.querySelector("#level-value"),
    hull: document.querySelector("#hull-value"),
    hullFill: document.querySelector("#hull-fill"),
    energy: document.querySelector("#energy-value"),
    energyFill: document.querySelector("#energy-fill"),
    speed: document.querySelector("#speed-value"),
    speedFill: document.querySelector("#speed-fill"),
    record: document.querySelector("#record-value"),
    highscore: document.querySelector("#highscore-value"),
    finalScore: document.querySelector("#final-score"),
    finalTime: document.querySelector("#final-time"),
    announcer: document.querySelector("#game-announcer"),
    menu: document.querySelector("#menu-screen"),
    instructions: document.querySelector("#instructions-overlay"),
    highscoreOverlay: document.querySelector("#highscore-overlay"),
    pauseOverlay: document.querySelector("#pause-overlay"),
    quitOverlay: document.querySelector("#quit-overlay"),
    gameOverOverlay: document.querySelector("#gameover-overlay"),
    startButton: document.querySelector("#start-button"),
    instructionsButton: document.querySelector("#instructions-button"),
    highscoreButton: document.querySelector("#highscore-button"),
    quitButton: document.querySelector("#quit-button"),
    pauseButton: document.querySelector("#pause-button"),
    gameActions: document.querySelector("#game-actions"),
    resumeButton: document.querySelector("#resume-button"),
    restartButton: document.querySelector("#restart-button"),
    playAgainButton: document.querySelector("#play-again-button"),
    instructionsBackButton: document.querySelector("#instructions-back-button"),
    highscoreBackButton: document.querySelector("#highscore-back-button"),
    pauseMenuButton: document.querySelector("#pause-menu-button"),
    quitReturnButton: document.querySelector("#quit-return-button"),
    quitCancelButton: document.querySelector("#quit-cancel-button"),
    gameoverMenuButton: document.querySelector("#gameover-menu-button"),
    touchControls: document.querySelector(".touch-controls"),
  };

  const WIDTH = 1200;
  const HEIGHT = 720;
  const RECORD_KEY = "space-survival-record-v1";
  const FLIGHT = {
    cruise: 112,
    minimum: 42,
    maximum: 238,
    acceleration: 132,
    braking: 158,
    coasting: 82,
    asteroidFlow: 0.42,
    enemyFlow: 0.3,
    pickupFlow: 0.42,
    projectileFlow: 0.12,
    starFlow: 0.5,
  };
  const pressed = new Set();
  const stars = Array.from({ length: 145 }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT,
    size: Math.random() * 1.7 + 0.35,
    speed: Math.random() * 17 + 5,
    depth: Math.random() * 0.85 + 0.15,
    phase: Math.random() * Math.PI * 2,
    warmth: Math.random() < 0.14,
  }));
  const nebulae = [
    { x: 0.12, y: 0.32, radius: 0.42, color: "132, 42, 226", phase: 0.1 },
    { x: 0.34, y: 0.74, radius: 0.37, color: "37, 89, 224", phase: 2.1 },
    { x: 0.64, y: 0.2, radius: 0.4, color: "172, 36, 202", phase: 3.7 },
    { x: 0.83, y: 0.66, radius: 0.43, color: "40, 64, 182", phase: 5.2 },
    { x: 0.53, y: 0.51, radius: 0.31, color: "54, 87, 224", phase: 1.5 },
  ];

  let state = "menu";
  let lastFrame = 0;
  let displayAccumulator = 0;
  let record = readRecord();
  let run;
  let atmosphere = createAtmosphere();
  elements.record.textContent = formatScore(record);
  elements.highscore.textContent = formatScore(record);
  fitCanvas();
  window.addEventListener("resize", fitCanvas);
  requestAnimationFrame(frame);

  function fitCanvas() {
    const bounds = canvas.getBoundingClientRect();
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.max(1, Math.round(bounds.width * ratio));
    canvas.height = Math.max(1, Math.round(bounds.height * ratio));
    context.setTransform(canvas.width / WIDTH, 0, 0, canvas.height / HEIGHT, 0, 0);
  }

  function readRecord() {
    try {
      const saved = Number(window.localStorage.getItem(RECORD_KEY));
      return Number.isFinite(saved) && saved > 0 ? Math.floor(saved) : 0;
    } catch {
      return 0;
    }
  }

  function writeRecord(value) {
    try {
      window.localStorage.setItem(RECORD_KEY, String(value));
    } catch {
      // The current run remains playable when browser storage is disabled.
    }
  }

  function formatScore(value) {
    return String(Math.floor(value)).padStart(6, "0");
  }

  function formatTime(seconds) {
    const wholeSeconds = Math.floor(seconds);
    const minutes = String(Math.floor(wholeSeconds / 60)).padStart(2, "0");
    const remainder = String(wholeSeconds % 60).padStart(2, "0");
    return `${minutes}:${remainder}`;
  }

  function createRun() {
    return {
      elapsed: 0,
      scoreBonus: 0,
      hull: 100,
      energy: 100,
      forwardSpeed: FLIGHT.cruise,
      player: { x: WIDTH / 2, y: HEIGHT - 125, radius: 21, speed: 355, invulnerable: 0, fireTimer: 0 },
      asteroids: [],
      enemies: [],
      shots: [],
      enemyShots: [],
      pickups: [],
      particles: [],
      asteroidTimer: 0.5,
      enemyTimer: 3.5,
      pickupTimer: 7,
      damageFlash: 0,
    };
  }

  function createAtmosphere() {
    return {
      rocks: Array.from({ length: 23 }, () => createSpaceRock()),
      ships: Array.from({ length: 3 }, (_, index) => createSpaceShip(index * 2.8)),
      bolts: [],
      boltTimer: 0.6,
      shipTimer: 4,
    };
  }

  function createSpaceRock() {
    const radius = randomBetween(9, 31);
    return {
      x: randomBetween(0, WIDTH),
      y: randomBetween(-HEIGHT * 0.25, HEIGHT),
      vx: randomBetween(-17, 17),
      vy: randomBetween(9, 37),
      radius,
      vertices: Array.from({ length: 9 }, () => randomBetween(0.75, 1.16)),
      spin: randomBetween(-0.35, 0.35),
      angle: randomBetween(0, Math.PI * 2),
      hp: 1,
      ambient: true,
    };
  }

  function createSpaceShip(delay = 0) {
    return {
      x: randomBetween(-WIDTH * 0.5, WIDTH * 1.5),
      y: randomBetween(80, HEIGHT - 80),
      speed: randomBetween(42, 82),
      scale: randomBetween(0.42, 0.75),
      phase: randomBetween(0, Math.PI * 2),
      delay,
      color: Math.random() < 0.5 ? "#ea587f" : "#876bff",
    };
  }

  function updateAtmosphere(delta) {
    atmosphere.boltTimer -= delta;
    atmosphere.shipTimer -= delta;
    for (const rock of atmosphere.rocks) {
      rock.x += rock.vx * delta;
      rock.y += (rock.vy + FLIGHT.cruise * 0.16) * delta;
      rock.angle += rock.spin * delta;
      if (rock.y > HEIGHT + rock.radius) {
        rock.y = -rock.radius;
        rock.x = randomBetween(0, WIDTH);
      }
      if (rock.x < -rock.radius) rock.x = WIDTH + rock.radius;
      if (rock.x > WIDTH + rock.radius) rock.x = -rock.radius;
    }
    for (const ship of atmosphere.ships) {
      ship.delay -= delta;
      if (ship.delay <= 0) ship.x += ship.speed * delta;
      if (ship.x > WIDTH + 100) Object.assign(ship, createSpaceShip(randomBetween(1, 6)), { x: -100 });
    }
    for (const bolt of atmosphere.bolts) {
      bolt.x += bolt.vx * delta;
      bolt.y += bolt.vy * delta;
      bolt.life -= delta;
    }
    atmosphere.bolts = atmosphere.bolts.filter((bolt) => bolt.life > 0);
    if (atmosphere.boltTimer <= 0) {
      atmosphere.bolts.push({
        x: randomBetween(0, WIDTH),
        y: randomBetween(0, HEIGHT * 0.72),
        vx: randomBetween(-30, 30),
        vy: randomBetween(115, 190),
        life: 2.2,
      });
      atmosphere.boltTimer = randomBetween(1.3, 3.6);
    }
    if (atmosphere.shipTimer <= 0) {
      atmosphere.ships.push(createSpaceShip());
      atmosphere.shipTimer = randomBetween(7, 12);
    }
    atmosphere.ships = atmosphere.ships.filter((ship) => ship.x < WIDTH + 100 || ship.delay > 0);
  }

  function hideScreens() {
    elements.menu.hidden = true;
    elements.instructions.hidden = true;
    elements.highscoreOverlay.hidden = true;
    elements.pauseOverlay.hidden = true;
    elements.quitOverlay.hidden = true;
    elements.gameOverOverlay.hidden = true;
  }

  function showMenu() {
    state = "menu";
    run = null;
    pressed.clear();
    hideScreens();
    elements.menu.hidden = false;
    elements.gameActions.hidden = true;
    elements.touchControls.hidden = true;
    elements.scoreLabel.textContent = "BEST FLIGHT";
    elements.score.textContent = formatScore(record);
    elements.record.textContent = formatScore(record);
    elements.highscore.textContent = formatScore(record);
    elements.time.textContent = "00:00";
    elements.level.textContent = "1";
    elements.hull.textContent = "100%";
    elements.hullFill.style.width = "100%";
    elements.energy.textContent = "100%";
    elements.energyFill.style.width = "100%";
    elements.speed.textContent = "1.0x";
    elements.speedFill.style.width = `${speedPercent(FLIGHT.cruise)}%`;
    elements.startButton.focus();
  }

  function openMenuDialog(dialog, dialogState) {
    hideScreens();
    state = dialogState;
    elements[dialog].hidden = false;
    elements[dialog].querySelector("button")?.focus();
  }

  function startGame() {
    run = createRun();
    atmosphere = createAtmosphere();
    pressed.clear();
    state = "playing";
    hideScreens();
    elements.gameActions.hidden = false;
    elements.touchControls.hidden = false;
    elements.scoreLabel.textContent = "SCORE";
    elements.pauseButton.textContent = "Ⅱ";
    elements.pauseButton.setAttribute("aria-label", "Pause game");
    canvas.focus();
    lastFrame = performance.now();
    updateHud();
    elements.announcer.textContent = "Flight started. Use WASD or arrow keys to move and Space to fire.";
  }

  function pauseGame() {
    if (state === "playing") {
      state = "paused";
      pressed.clear();
      elements.pauseOverlay.hidden = false;
      elements.touchControls.hidden = true;
      elements.pauseButton.textContent = "▶";
      elements.pauseButton.setAttribute("aria-label", "Resume game");
      elements.resumeButton.focus();
    } else if (state === "paused") {
      resumeGame();
    }
  }

  function resumeGame() {
    state = "playing";
    elements.pauseOverlay.hidden = true;
    elements.touchControls.hidden = false;
    elements.pauseButton.textContent = "Ⅱ";
    elements.pauseButton.setAttribute("aria-label", "Pause game");
    canvas.focus();
    lastFrame = performance.now();
  }

  function finishGame() {
    if (state !== "playing") return;
    state = "gameover";
    pressed.clear();
    const score = getScore();
    elements.finalScore.textContent = formatScore(score);
    elements.finalTime.textContent = formatTime(run.elapsed);
    elements.gameOverOverlay.hidden = false;
    elements.gameActions.hidden = true;
    elements.touchControls.hidden = true;
    elements.playAgainButton.focus();
    if (score > record) {
      record = score;
      elements.record.textContent = formatScore(record);
      elements.highscore.textContent = formatScore(record);
      writeRecord(record);
    }
    elements.announcer.textContent = `Flight over. Final score ${score}. Survival time ${formatTime(run.elapsed)}.`;
  }

  function updateRecordScreen() {
    const latest = readRecord();
    record = Math.max(record, latest);
    elements.record.textContent = formatScore(record);
    elements.highscore.textContent = formatScore(record);
  }

  function getScore() {
    return Math.floor(run.elapsed * 5) + run.scoreBonus;
  }

  function spawnAsteroid() {
    const radius = randomBetween(17, 39);
    const vertices = Array.from({ length: 9 }, () => randomBetween(0.72, 1.18));
    run.asteroids.push({
      x: randomBetween(radius, WIDTH - radius),
      y: -radius - 5,
      vx: randomBetween(-48, 48),
      vy: randomBetween(112, 178) + Math.min(run.elapsed * 1.1, 95),
      worldFlow: FLIGHT.asteroidFlow,
      radius,
      vertices,
      spin: randomBetween(-0.8, 0.8),
      angle: randomBetween(0, Math.PI * 2),
      hp: radius > 29 ? 2 : 1,
    });
  }

  function spawnEnemy() {
    run.enemies.push({
      x: randomBetween(90, WIDTH - 90),
      y: -36,
      vx: randomBetween(-66, 66),
      vy: randomBetween(54, 83) + Math.min(run.elapsed * 0.25, 26),
      worldFlow: FLIGHT.enemyFlow,
      radius: 25,
      hp: 2,
      fireTimer: randomBetween(0.7, 1.6),
      phase: randomBetween(0, Math.PI * 2),
      clock: 0,
    });
  }

  function spawnPickup(x = randomBetween(55, WIDTH - 55), y = -20) {
    run.pickups.push({ x, y, radius: 12, vy: 91, worldFlow: FLIGHT.pickupFlow, phase: randomBetween(0, Math.PI * 2) });
  }

  function spawnBurst(x, y, color, count = 12, speedScale = 1) {
    for (let index = 0; index < count; index += 1) {
      const angle = Math.random() * Math.PI * 2;
      const speed = randomBetween(40, 190) * speedScale;
      run.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: randomBetween(0.24, 0.68),
        maxLife: 0.68,
        radius: randomBetween(1.5, 3.2),
        color,
      });
    }
  }

  function fireShot() {
    if (run.energy < 0.7) return;
    run.energy = Math.max(0, run.energy - 0.7);
    run.shots.push({ x: run.player.x, y: run.player.y - 24, vy: -620, radius: 4, damage: 1 });
    run.player.fireTimer = 0.19;
  }

  function fireEnemyShot(enemy) {
    const dx = run.player.x - enemy.x;
    const dy = run.player.y - enemy.y;
    const length = Math.hypot(dx, dy) || 1;
    const speed = 215 + Math.min(run.elapsed * 0.35, 48);
    run.enemyShots.push({
      x: enemy.x,
      y: enemy.y + 15,
      vx: dx / length * speed,
      vy: dy / length * speed,
      radius: 6,
    });
  }

  function update(delta) {
    run.elapsed += delta;
    run.energy = Math.min(100, run.energy + delta * 0.32);
    run.player.invulnerable = Math.max(0, run.player.invulnerable - delta);
    run.damageFlash = Math.max(0, run.damageFlash - delta * 2.5);

    updatePlayer(delta);
    updateSpawns(delta);
    updateAsteroids(delta);
    updateEnemies(delta);
    updateShots(delta);
    updatePickups(delta);
    updateParticles(delta);
    checkCollisions();

    displayAccumulator += delta;
    if (displayAccumulator >= 0.08) {
      updateHud();
      displayAccumulator = 0;
    }
    if (run.hull <= 0) finishGame();
  }

  function updatePlayer(delta) {
    const accelerating = pressed.has("ArrowUp") || pressed.has("KeyW");
    const braking = pressed.has("ArrowDown") || pressed.has("KeyS");
    if (accelerating && !braking) {
      run.forwardSpeed = Math.min(FLIGHT.maximum, run.forwardSpeed + FLIGHT.acceleration * delta);
    } else if (braking && !accelerating) {
      run.forwardSpeed = Math.max(FLIGHT.minimum, run.forwardSpeed - FLIGHT.braking * delta);
    } else {
      run.forwardSpeed = approach(run.forwardSpeed, FLIGHT.cruise, FLIGHT.coasting * delta);
    }

    const horizontal = (pressed.has("ArrowRight") || pressed.has("KeyD") ? 1 : 0)
      - (pressed.has("ArrowLeft") || pressed.has("KeyA") ? 1 : 0);
    const vertical = (pressed.has("KeyF") ? 1 : 0) - (pressed.has("KeyR") ? 1 : 0);
    const steeringMagnitude = Math.hypot(horizontal, vertical) || 1;
    run.player.x += horizontal / steeringMagnitude * run.player.speed * delta;
    run.player.y += vertical / steeringMagnitude * run.player.speed * delta;
    run.player.x = clamp(run.player.x, 34, WIDTH - 34);
    run.player.y = clamp(run.player.y, 48, HEIGHT - 43);

    run.player.fireTimer -= delta;
    if (pressed.has("Space") && run.player.fireTimer <= 0) fireShot();
  }

  function updateSpawns(delta) {
    run.asteroidTimer -= delta;
    run.enemyTimer -= delta;
    run.pickupTimer -= delta;
    if (run.asteroidTimer <= 0) {
      spawnAsteroid();
      run.asteroidTimer = Math.max(0.37, 1.28 - run.elapsed * 0.0055) * randomBetween(0.78, 1.2);
    }
    if (run.enemyTimer <= 0) {
      spawnEnemy();
      run.enemyTimer = Math.max(1.55, 5.4 - run.elapsed * 0.018) * randomBetween(0.8, 1.2);
    }
    if (run.pickupTimer <= 0) {
      spawnPickup();
      run.pickupTimer = randomBetween(10, 16);
    }
  }

  function updateAsteroids(delta) {
    for (const asteroid of run.asteroids) {
      asteroid.x += asteroid.vx * delta;
      asteroid.y += (asteroid.vy + run.forwardSpeed * asteroid.worldFlow) * delta;
      asteroid.angle += asteroid.spin * delta;
      if (asteroid.x < asteroid.radius || asteroid.x > WIDTH - asteroid.radius) asteroid.vx *= -1;
    }
    run.asteroids = run.asteroids.filter((asteroid) => asteroid.y < HEIGHT + asteroid.radius);
  }

  function updateEnemies(delta) {
    for (const enemy of run.enemies) {
      enemy.clock += delta;
      enemy.x += enemy.vx * delta + Math.sin(enemy.clock * 1.8 + enemy.phase) * 18 * delta;
      enemy.y += (enemy.vy + run.forwardSpeed * enemy.worldFlow) * delta;
      if (enemy.x < 48 || enemy.x > WIDTH - 48) enemy.vx *= -1;
      enemy.x = clamp(enemy.x, 48, WIDTH - 48);
      enemy.fireTimer -= delta;
      if (enemy.y > 25 && enemy.fireTimer <= 0) {
        fireEnemyShot(enemy);
        enemy.fireTimer = randomBetween(1.5, 2.35) * Math.max(0.68, 1 - run.elapsed * 0.0015);
      }
    }
    run.enemies = run.enemies.filter((enemy) => enemy.y < HEIGHT + enemy.radius);
  }

  function updateShots(delta) {
    for (const shot of run.shots) {
      shot.y += (shot.vy + run.forwardSpeed * FLIGHT.projectileFlow) * delta;
    }
    for (const shot of run.enemyShots) {
      shot.x += shot.vx * delta;
      shot.y += (shot.vy + run.forwardSpeed * FLIGHT.projectileFlow) * delta;
    }
    run.shots = run.shots.filter((shot) => shot.y > -20);
    run.enemyShots = run.enemyShots.filter((shot) => shot.y < HEIGHT + 30 && shot.x > -30 && shot.x < WIDTH + 30);
  }

  function updatePickups(delta) {
    for (const pickup of run.pickups) {
      pickup.y += (pickup.vy + run.forwardSpeed * pickup.worldFlow) * delta;
      pickup.phase += delta * 2.4;
    }
    run.pickups = run.pickups.filter((pickup) => pickup.y < HEIGHT + 30);
  }

  function updateParticles(delta) {
    for (const particle of run.particles) {
      particle.x += particle.vx * delta;
      particle.y += particle.vy * delta;
      particle.vx *= Math.max(0, 1 - delta * 2.3);
      particle.vy *= Math.max(0, 1 - delta * 2.3);
      particle.life -= delta;
    }
    run.particles = run.particles.filter((particle) => particle.life > 0);
  }

  function checkCollisions() {
    for (const shot of run.shots) {
      if (shot.dead) continue;
      for (const asteroid of run.asteroids) {
        if (asteroid.dead) continue;
        if (touching(shot, asteroid, shot.radius)) {
          shot.dead = true;
          asteroid.hp -= 1;
          spawnBurst(shot.x, shot.y, "#69e8d4", 4, 0.44);
          if (asteroid.hp <= 0) {
            asteroid.dead = true;
            run.scoreBonus += 18;
            spawnBurst(asteroid.x, asteroid.y, "#ffb56f", 15, 0.75);
            if (Math.random() < 0.2) spawnPickup(asteroid.x, asteroid.y);
          }
          break;
        }
      }
      if (shot.dead) continue;
      for (const enemy of run.enemies) {
        if (enemy.dead) continue;
        if (touching(shot, enemy, shot.radius)) {
          shot.dead = true;
          enemy.hp -= 1;
          spawnBurst(shot.x, shot.y, "#69e8d4", 4, 0.44);
          if (enemy.hp <= 0) {
            enemy.dead = true;
            run.scoreBonus += 55;
            spawnBurst(enemy.x, enemy.y, "#ff806c", 22, 1.05);
          }
          break;
        }
      }
    }
    run.shots = run.shots.filter((shot) => !shot.dead);
    run.asteroids = run.asteroids.filter((asteroid) => !asteroid.dead);
    run.enemies = run.enemies.filter((enemy) => !enemy.dead);

    if (run.player.invulnerable <= 0) {
      for (const asteroid of run.asteroids) {
        if (touching(run.player, asteroid, -7)) {
          asteroid.dead = true;
          run.asteroids = run.asteroids.filter((item) => !item.dead);
          damagePlayer(22);
          spawnBurst(asteroid.x, asteroid.y, "#ffad70", 12, 0.8);
          break;
        }
      }
    }

    if (run.player.invulnerable <= 0) {
      for (const enemy of run.enemyShots) {
        if (touching(run.player, enemy, -7)) {
          enemy.dead = true;
          run.enemyShots = run.enemyShots.filter((item) => !item.dead);
          damagePlayer(14);
          spawnBurst(enemy.x, enemy.y, "#ff806c", 7, 0.6);
          break;
        }
      }
    }

    if (run.player.invulnerable <= 0) {
      for (const enemy of run.enemies) {
        if (touching(run.player, enemy, -3)) {
          enemy.dead = true;
          run.enemies = run.enemies.filter((item) => !item.dead);
          damagePlayer(25);
          break;
        }
      }
    }

    for (const pickup of run.pickups) {
      if (!pickup.dead && touching(run.player, pickup, 2)) {
        pickup.dead = true;
        const restored = Math.min(26, 100 - run.energy);
        run.energy += restored;
        run.scoreBonus += 12;
        spawnBurst(pickup.x, pickup.y, "#67e8d3", 13, 0.7);
        elements.announcer.textContent = `Energy cell collected. ${Math.round(run.energy)} percent energy.`;
      }
    }
    run.pickups = run.pickups.filter((pickup) => !pickup.dead);
  }

  function damagePlayer(amount) {
    run.hull = Math.max(0, run.hull - amount);
    run.player.invulnerable = 0.95;
    run.damageFlash = 1;
    spawnBurst(run.player.x, run.player.y, "#ff806c", 15, 0.82);
    elements.announcer.textContent = `Hull damaged. ${run.hull} percent integrity remains.`;
  }

  function touching(first, second, adjustment = 0) {
    const radius = Math.max(0, first.radius + second.radius + adjustment);
    const dx = first.x - second.x;
    const dy = first.y - second.y;
    return dx * dx + dy * dy < radius * radius;
  }

  function updateHud() {
    const score = getScore();
    elements.score.textContent = formatScore(score);
    elements.time.textContent = formatTime(run.elapsed);
    elements.hull.textContent = `${Math.ceil(run.hull)}%`;
    elements.hullFill.style.width = `${run.hull}%`;
    elements.hullFill.style.backgroundColor = run.hull < 30 ? "#ff655e" : "";
    elements.energy.textContent = `${Math.floor(run.energy)}%`;
    elements.energyFill.style.width = `${run.energy}%`;
    elements.level.textContent = String(Math.floor(run.elapsed / 30) + 1);
    elements.speed.textContent = `${(run.forwardSpeed / FLIGHT.cruise).toFixed(1)}x`;
    elements.speedFill.style.width = `${speedPercent(run.forwardSpeed)}%`;
  }

  function frame(timestamp) {
    const delta = lastFrame ? Math.min((timestamp - lastFrame) / 1000, 0.05) : 0;
    lastFrame = timestamp;
    if (state !== "paused") updateStars(delta);
    if (state === "playing") update(delta);
    else if (state !== "paused" && state !== "gameover") updateAtmosphere(delta);
    render(timestamp / 1000);
    requestAnimationFrame(frame);
  }

  function updateStars(delta) {
    const speed = state === "playing" ? 1.4 : 0.38;
    const forwardSpeed = state === "playing" && run ? run.forwardSpeed : FLIGHT.cruise * 0.38;
    for (const star of stars) {
      star.y += (star.speed * speed + forwardSpeed * FLIGHT.starFlow * star.depth) * delta;
      if (star.y > HEIGHT) {
        star.y = 0;
        star.x = Math.random() * WIDTH;
      }
    }
  }

  function render(clock) {
    context.clearRect(0, 0, WIDTH, HEIGHT);
    drawSpace(clock);
    if (run && (state === "playing" || state === "paused" || state === "gameover")) {
      drawPickups(clock);
      drawAsteroids();
      drawEnemies(clock);
      drawShots();
      drawParticles();
      if (state !== "gameover") drawPlayer(clock);
    } else {
      drawAsteroids(atmosphere.rocks);
      drawAmbientBolts();
      drawAmbientShips(clock);
      drawAttractShip(clock);
    }
    if (run?.damageFlash > 0 && state === "playing") {
      context.fillStyle = `rgba(255, 87, 77, ${run.damageFlash * 0.09})`;
      context.fillRect(0, 0, WIDTH, HEIGHT);
    }
  }

  function drawSpace(clock) {
    const background = context.createLinearGradient(0, 0, 0, HEIGHT);
    background.addColorStop(0, "#110b36");
    background.addColorStop(0.48, "#20104e");
    background.addColorStop(1, "#100d32");
    context.fillStyle = background;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    const forwardSpeed = state === "playing" && run ? run.forwardSpeed : FLIGHT.cruise * 0.38;
    const boost = state === "playing" && run
      ? clamp((run.forwardSpeed - FLIGHT.cruise) / (FLIGHT.maximum - FLIGHT.cruise), 0, 1)
      : 0;
    for (const cloud of nebulae) {
      const driftX = Math.sin(clock * (0.08 + forwardSpeed * 0.0003) + cloud.phase) * (26 + boost * 8);
      const driftY = Math.cos(clock * (0.06 + forwardSpeed * 0.00018) + cloud.phase) * (18 + boost * 5);
      const radius = WIDTH * cloud.radius;
      context.save();
      context.translate(WIDTH * cloud.x + driftX, HEIGHT * cloud.y + driftY);
      context.rotate(Math.sin(clock * 0.035 + cloud.phase) * 0.13);
      context.scale(1.7, 0.78);
      const cloudGlow = context.createRadialGradient(0, 0, 0, 0, 0, radius);
      cloudGlow.addColorStop(0, `rgba(${cloud.color}, .2)`);
      cloudGlow.addColorStop(0.27, `rgba(${cloud.color}, .12)`);
      cloudGlow.addColorStop(0.7, `rgba(${cloud.color}, .045)`);
      cloudGlow.addColorStop(1, `rgba(${cloud.color}, 0)`);
      context.fillStyle = cloudGlow;
      context.fillRect(-radius, -radius, radius * 2, radius * 2);
      context.restore();
    }

    const core = context.createRadialGradient(WIDTH * 0.49, HEIGHT * 0.52, 1, WIDTH * 0.49, HEIGHT * 0.52, WIDTH * 0.44);
    core.addColorStop(0, "rgba(52, 50, 165, .15)");
    core.addColorStop(0.42, "rgba(101, 37, 172, .1)");
    core.addColorStop(1, "rgba(101, 37, 172, 0)");
    context.fillStyle = core;
    context.fillRect(0, 0, WIDTH, HEIGHT);

    for (const star of stars) {
      const shimmer = 0.35 + (Math.sin(clock * 1.7 + star.phase) + 1) * 0.25;
      context.globalAlpha = shimmer;
      context.fillStyle = star.warmth ? "#ffc8a1" : (star.size > 1.5 ? "#77e9ff" : "#e3e7ff");
      context.beginPath();
      context.arc(star.x, star.y, star.size, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
    for (const star of stars) {
      if (star.size > 1.75) {
        const streak = 4 + boost * star.depth * 28;
        context.strokeStyle = `rgba(128, 193, 255, ${0.23 + boost * 0.32})`;
        context.lineWidth = 1 + boost;
        context.beginPath();
        context.moveTo(star.x - 4, star.y);
        context.lineTo(star.x + 4, star.y);
        context.moveTo(star.x, star.y - streak);
        context.lineTo(star.x, star.y + streak);
        context.stroke();
      }
    }
  }

  function drawPlayer(clock) {
    const player = run.player;
    if (player.invulnerable > 0 && Math.floor(clock * 14) % 2 === 0) return;
    context.save();
    context.translate(player.x, player.y);

    const boost = clamp((run.forwardSpeed - FLIGHT.cruise) / (FLIGHT.maximum - FLIGHT.cruise), 0, 1);
    const exhaust = 18 + Math.sin(clock * 31) * 6 + boost * 27;
    context.globalAlpha = 0.64 + boost * 0.3;
    context.shadowColor = "#29bfff";
    context.shadowBlur = 18 + boost * 22;
    context.fillStyle = "#70f5ff";
    for (const side of [-1, 1]) {
      context.beginPath();
      context.moveTo(side * 9, 16);
      context.lineTo(side * 7, 16 + exhaust);
      context.lineTo(side * 4, 17);
      context.closePath();
      context.fill();
    }

    context.globalAlpha = 1;
    context.shadowColor = "rgba(42, 189, 255, .83)";
    context.shadowBlur = 20;
    context.fillStyle = "#277bdb";
    context.strokeStyle = "#17245f";
    context.lineWidth = 4;
    context.beginPath();
    context.moveTo(0, -29);
    context.lineTo(10, -13);
    context.lineTo(23, 8);
    context.lineTo(20, 19);
    context.lineTo(8, 15);
    context.lineTo(0, 23);
    context.lineTo(-8, 15);
    context.lineTo(-20, 19);
    context.lineTo(-23, 8);
    context.lineTo(-10, -13);
    context.closePath();
    context.fill();
    context.stroke();

    context.shadowBlur = 0;
    context.fillStyle = "#50c9ff";
    context.beginPath();
    context.moveTo(0, -24);
    context.lineTo(8, -9);
    context.lineTo(0, -4);
    context.lineTo(-8, -9);
    context.closePath();
    context.fill();

    context.fillStyle = "#ffd878";
    context.strokeStyle = "#70418b";
    context.lineWidth = 1.5;
    context.beginPath();
    context.ellipse(0, -7, 5.5, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.stroke();

    context.fillStyle = "#f8e9a7";
    context.beginPath();
    context.arc(-15, 12, 2.1, 0, Math.PI * 2);
    context.arc(15, 12, 2.1, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawAttractShip(clock) {
    const y = HEIGHT * 0.61 + Math.sin(clock * 0.9) * 16;
    const x = WIDTH * 0.78 + Math.sin(clock * 0.44) * 30;
    context.save();
    context.translate(x, y);
    context.rotate(-0.16);
    context.scale(0.78, 0.78);
    context.globalAlpha = 0.86;
    context.fillStyle = "#277bdb";
    context.strokeStyle = "#17245f";
    context.lineWidth = 4;
    context.shadowColor = "#48caff";
    context.shadowBlur = 24;
    context.beginPath();
    context.moveTo(0, -29);
    context.lineTo(11, -10);
    context.lineTo(23, 13);
    context.lineTo(8, 12);
    context.lineTo(0, 22);
    context.lineTo(-8, 12);
    context.lineTo(-23, 13);
    context.closePath();
    context.fill();
    context.stroke();
    context.fillStyle = "#ffd878";
    context.beginPath();
    context.ellipse(0, -7, 5.5, 9, 0, 0, Math.PI * 2);
    context.fill();
    context.restore();
  }

  function drawAsteroids(asteroids = run.asteroids) {
    const stoneColors = [
      { base: "#817273", light: "#b3a09a", shadow: "#55454d", outline: "#332b45" },
      { base: "#78665f", light: "#ad9380", shadow: "#4c3c3d", outline: "#29253d" },
      { base: "#777a8c", light: "#b0b5c0", shadow: "#4e5064", outline: "#292641" },
    ];
    for (const asteroid of asteroids) {
      const palette = stoneColors[asteroid.tone ?? Math.floor(asteroid.radius / 12) % stoneColors.length];
      context.save();
      context.translate(asteroid.x, asteroid.y);
      context.rotate(asteroid.angle);
      context.shadowColor = "rgba(5, 4, 24, .62)";
      context.shadowBlur = asteroid.ambient ? 8 : 13;
      context.shadowOffsetY = 4;
      context.beginPath();
      for (let index = 0; index < asteroid.vertices.length; index += 1) {
        const angle = index / asteroid.vertices.length * Math.PI * 2;
        const radius = asteroid.radius * asteroid.vertices[index];
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius;
        if (index === 0) context.moveTo(x, y);
        else context.lineTo(x, y);
      }
      context.closePath();
      const rockFill = context.createLinearGradient(-asteroid.radius, -asteroid.radius, asteroid.radius, asteroid.radius);
      rockFill.addColorStop(0, palette.light);
      rockFill.addColorStop(0.45, palette.base);
      rockFill.addColorStop(1, palette.shadow);
      context.fillStyle = rockFill;
      context.strokeStyle = palette.outline;
      context.lineWidth = asteroid.ambient ? 2.5 : 3.5;
      context.fill();
      context.stroke();
      context.shadowColor = "transparent";
      context.shadowBlur = 0;
      context.shadowOffsetY = 0;
      context.lineJoin = "round";
      context.lineWidth = Math.max(1, asteroid.radius * 0.045);
      context.strokeStyle = "rgba(31, 24, 47, .56)";
      context.beginPath();
      context.moveTo(0, 0);
      for (let index = 1; index < asteroid.vertices.length; index += 3) {
        const angle = index / asteroid.vertices.length * Math.PI * 2;
        context.lineTo(Math.cos(angle) * asteroid.radius * asteroid.vertices[index], Math.sin(angle) * asteroid.radius * asteroid.vertices[index]);
        context.moveTo(0, 0);
      }
      context.stroke();
      context.fillStyle = "rgba(245, 209, 174, .18)";
      context.beginPath();
      context.moveTo(-asteroid.radius * 0.28, -asteroid.radius * 0.48);
      context.lineTo(asteroid.radius * 0.38, -asteroid.radius * 0.3);
      context.lineTo(asteroid.radius * 0.12, asteroid.radius * 0.08);
      context.closePath();
      context.fill();
      context.restore();
    }
  }

  function drawEnemies(clock, enemies = run.enemies) {
    for (const enemy of enemies) {
      context.save();
      context.translate(enemy.x, enemy.y);
      context.shadowColor = "rgba(255, 103, 104, .65)";
      context.shadowBlur = 18;
      context.fillStyle = "#d34b6d";
      context.strokeStyle = "#3f1c54";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(-25, -5);
      context.lineTo(-12, -16);
      context.lineTo(0, -10);
      context.lineTo(12, -16);
      context.lineTo(25, -5);
      context.lineTo(16, 11);
      context.lineTo(-16, 11);
      context.closePath();
      context.fill();
      context.stroke();
      context.shadowBlur = 0;
      context.fillStyle = "#ffb3cc";
      context.fillRect(-5, 2 + Math.sin(clock * 5 + enemy.phase) * 2, 10, 4);
      context.fillStyle = "#ffcb73";
      context.beginPath();
      context.arc(-13, 8, 2, 0, Math.PI * 2);
      context.arc(13, 8, 2, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawShots(playerShots = run.shots, hostileShots = run.enemyShots) {
    context.save();
    context.lineCap = "round";
    context.shadowBlur = 13;
    context.shadowColor = "#62f4e0";
    context.strokeStyle = "#9affee";
    context.lineWidth = 4;
    for (const shot of playerShots) {
      context.beginPath();
      context.moveTo(shot.x, shot.y + 13);
      context.lineTo(shot.x, shot.y - 8);
      context.stroke();
    }
    context.shadowColor = "#ff806f";
    context.strokeStyle = "#ffb16b";
    context.lineWidth = 4;
    for (const shot of hostileShots) {
      context.beginPath();
      context.moveTo(shot.x, shot.y - 7);
      context.lineTo(shot.x - shot.vx * 0.025, shot.y + shot.vy * 0.025);
      context.stroke();
    }
    context.restore();
  }

  function drawAmbientBolts() {
    context.save();
    context.lineCap = "round";
    context.lineWidth = 3;
    context.shadowBlur = 13;
    context.shadowColor = "#47c7ff";
    context.strokeStyle = "rgba(111, 229, 255, .88)";
    for (const bolt of atmosphere.bolts) {
      context.globalAlpha = Math.min(1, bolt.life / 0.45);
      context.beginPath();
      context.moveTo(bolt.x, bolt.y - 13);
      context.lineTo(bolt.x - bolt.vx * 0.05, bolt.y + 7);
      context.stroke();
    }
    context.restore();
  }

  function drawAmbientShips(clock) {
    for (const ship of atmosphere.ships) {
      if (ship.delay > 0) continue;
      const y = ship.y + Math.sin(clock * 1.4 + ship.phase) * 15;
      context.save();
      context.translate(ship.x, y);
      context.scale(ship.scale, ship.scale);
      context.globalAlpha = 0.8;
      context.shadowColor = "#38baff";
      context.shadowBlur = 12;
      context.fillStyle = ship.color;
      context.strokeStyle = "#241c68";
      context.lineWidth = 4;
      context.beginPath();
      context.moveTo(24, 0);
      context.lineTo(2, -12);
      context.lineTo(-8, -7);
      context.lineTo(-21, -15);
      context.lineTo(-17, 0);
      context.lineTo(-21, 15);
      context.lineTo(-8, 7);
      context.lineTo(2, 12);
      context.closePath();
      context.fill();
      context.stroke();
      context.fillStyle = "#89efff";
      context.beginPath();
      context.ellipse(2, 0, 5, 4, 0, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }
  }

  function drawPickups(clock) {
    for (const pickup of run.pickups) {
      const pulse = 1 + Math.sin(clock * 5 + pickup.phase) * 0.13;
      context.save();
      context.translate(pickup.x, pickup.y);
      context.rotate(clock * 0.8 + pickup.phase);
      context.scale(pulse, pulse);
      context.shadowColor = "#ffd34f";
      context.shadowBlur = 20;
      context.fillStyle = "rgba(255, 190, 48, .24)";
      context.strokeStyle = "#fff0a0";
      context.lineWidth = 2;
      context.beginPath();
      context.moveTo(0, -14);
      context.lineTo(12, 0);
      context.lineTo(0, 14);
      context.lineTo(-12, 0);
      context.closePath();
      context.fill();
      context.stroke();
      context.shadowBlur = 0;
      context.fillStyle = "#fff7c8";
      context.fillRect(-2, -7, 4, 14);
      context.fillRect(-7, -2, 14, 4);
      context.restore();
    }
  }

  function drawParticles() {
    for (const particle of run.particles) {
      context.globalAlpha = Math.max(0, particle.life / particle.maxLife);
      context.fillStyle = particle.color;
      context.beginPath();
      context.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
      context.fill();
    }
    context.globalAlpha = 1;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function approach(value, target, amount) {
    if (value < target) return Math.min(target, value + amount);
    return Math.max(target, value - amount);
  }

  function speedPercent(speed) {
    return clamp((speed - FLIGHT.minimum) / (FLIGHT.maximum - FLIGHT.minimum) * 100, 0, 100);
  }

  function randomBetween(minimum, maximum) {
    return minimum + Math.random() * (maximum - minimum);
  }

  function keyFromEvent(event) {
    if (event.code === "Space") return "Space";
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) return event.key;
    if (/^[wasdrf]$/i.test(event.key)) return `Key${event.key.toUpperCase()}`;
    return null;
  }

  document.addEventListener("keydown", (event) => {
    const key = keyFromEvent(event);
    if (key && state === "playing") {
      event.preventDefault();
      pressed.add(key);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      if (state === "playing") pauseGame();
      else if (state === "paused") resumeGame();
      else if (state !== "menu") showMenu();
    } else if ((event.key.toLowerCase() === "p" || event.code === "KeyP") && (state === "playing" || state === "paused")) {
      event.preventDefault();
      pauseGame();
    }
  });

  document.addEventListener("keyup", (event) => {
    const key = keyFromEvent(event);
    if (key) pressed.delete(key);
  });
  window.addEventListener("blur", () => {
    pressed.clear();
    if (state === "playing") pauseGame();
  });
  document.addEventListener("visibilitychange", () => {
    pressed.clear();
    if (document.hidden && state === "playing") pauseGame();
  });

  for (const button of document.querySelectorAll("[data-key]")) {
    const key = button.dataset.key === "Space" ? "Space" : button.dataset.key;
    button.addEventListener("pointerdown", (event) => {
      if (state !== "playing") return;
      event.preventDefault();
      pressed.add(key);
      button.setPointerCapture(event.pointerId);
    });
    const release = () => pressed.delete(key);
    button.addEventListener("pointerup", release);
    button.addEventListener("pointercancel", release);
    button.addEventListener("lostpointercapture", release);
  }

  elements.startButton.addEventListener("click", startGame);
  elements.playAgainButton.addEventListener("click", startGame);
  elements.restartButton.addEventListener("click", startGame);
  elements.pauseButton.addEventListener("click", pauseGame);
  elements.resumeButton.addEventListener("click", resumeGame);
  elements.instructionsButton.addEventListener("click", () => openMenuDialog("instructions", "instructions"));
  elements.highscoreButton.addEventListener("click", () => {
    updateRecordScreen();
    openMenuDialog("highscoreOverlay", "highscore");
  });
  elements.quitButton.addEventListener("click", () => openMenuDialog("quitOverlay", "quit"));
  elements.instructionsBackButton.addEventListener("click", showMenu);
  elements.highscoreBackButton.addEventListener("click", showMenu);
  elements.pauseMenuButton.addEventListener("click", showMenu);
  elements.quitReturnButton.addEventListener("click", showMenu);
  elements.quitCancelButton.addEventListener("click", showMenu);
  elements.gameoverMenuButton.addEventListener("click", showMenu);

  showMenu();
})();