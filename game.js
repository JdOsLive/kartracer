const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const speedEl = document.getElementById("speed");
const orbsEl = document.getElementById("orbs");
const pulseEl = document.getElementById("pulse");
const beatFill = document.getElementById("beat-fill");

const keys = new Set();
let lastTime = 0;

const config = {
  segmentLength: 180,
  roadWidth: 2000,
  cameraHeight: 1100,
  cameraDepth: 0.85,
  drawDistance: 240,
  maxSpeed: 7200,
  accel: 4200,
  brake: 6400,
  decel: 2400,
  offRoadDecel: 3600,
  driftGrip: 0.6,
};

const state = {
  position: 0,
  speed: 0,
  playerX: 0,
  drift: 0,
  driftHeat: 0,
  beatPhase: 0,
  score: 0,
  sparks: [],
  segments: [],
};

const colors = {
  skyTop: "#4c1c7a",
  skyBottom: "#0a0b18",
  roadDark: "#141427",
  roadLight: "#1e1f38",
  rumble: "#8bd6ff",
  grassDark: "#0e2c25",
  grassLight: "#123a2f",
  lane: "rgba(255,255,255,0.2)",
  glow: "rgba(255,255,255,0.12)",
};

const makeSegments = () => {
  const segments = [];
  const total = 500;
  for (let i = 0; i < total; i += 1) {
    const curve = Math.sin(i / 28) * 0.9 + Math.sin(i / 11) * 0.4;
    const hill = Math.sin(i / 18) * 80;
    segments.push({
      index: i,
      curve,
      hill,
      color: i % 2 === 0 ? colors.roadDark : colors.roadLight,
      grass: i % 2 === 0 ? colors.grassDark : colors.grassLight,
    });
  }
  return segments;
};

const wrapPosition = () => {
  const trackLength = state.segments.length * config.segmentLength;
  state.position = (state.position + trackLength) % trackLength;
};

const resize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
};

const reset = () => {
  state.segments = makeSegments();
  state.position = 0;
  state.speed = 0;
  state.playerX = 0;
  state.drift = 0;
  state.driftHeat = 0;
  state.score = 0;
  state.sparks = [];
};

const findSegment = (z) => {
  const index = Math.floor(z / config.segmentLength) % state.segments.length;
  return state.segments[index];
};

const project = (x, y, z) => {
  const scale = config.cameraDepth / z;
  return {
    x: (1 + x * scale) * canvas.width / 2,
    y: (1 - y * scale) * canvas.height / 2,
    w: scale * config.roadWidth * canvas.width / 2,
  };
};

const addSpark = (x, y) => {
  state.sparks.push({
    x,
    y,
    life: 0.6,
    size: 4 + Math.random() * 4,
    hue: 300 + Math.random() * 40,
  });
};

const updateSparks = (dt) => {
  state.sparks = state.sparks
    .map((spark) => ({
      ...spark,
      life: spark.life - dt,
      y: spark.y + 40 * dt,
    }))
    .filter((spark) => spark.life > 0);
};

const updateBeat = (dt) => {
  state.beatPhase += dt * 3.2 + state.speed / config.maxSpeed * 3.6;
  const value = (Math.sin(state.beatPhase) + 1) / 2;
  beatFill.style.width = `${value * 100}%`;
  return value;
};

const updatePlayer = (dt) => {
  const steerInput = (keys.has("ArrowLeft") || keys.has("a") ? -1 : 0) +
    (keys.has("ArrowRight") || keys.has("d") ? 1 : 0);
  const throttle = (keys.has("ArrowUp") || keys.has("w") ? 1 : 0);
  const braking = (keys.has("ArrowDown") || keys.has("s") ? 1 : 0);
  const drifting = keys.has("Shift");

  if (throttle) {
    state.speed += config.accel * dt;
  } else if (braking) {
    state.speed -= config.brake * dt;
  } else {
    state.speed -= config.decel * dt;
  }

  state.speed = Math.max(0, Math.min(state.speed, config.maxSpeed));

  const speedPercent = state.speed / config.maxSpeed;
  const driftStrength = drifting ? 1.4 : 1;
  const steer = steerInput * (2.2 + speedPercent * 3.4) * dt * driftStrength;
  const grip = drifting ? config.driftGrip : 1;

  state.drift += steer * (1 - grip);
  state.drift *= 0.92;
  state.playerX += steer * grip + state.drift * 0.4;

  const maxX = 2.1;
  if (Math.abs(state.playerX) > maxX) {
    state.speed -= config.offRoadDecel * dt;
  }

  state.playerX = Math.max(-2.6, Math.min(2.6, state.playerX));

  state.position += state.speed * dt;
  wrapPosition();

  if (drifting && state.speed > config.maxSpeed * 0.35 && Math.abs(state.drift) > 0.02) {
    state.driftHeat = Math.min(1, state.driftHeat + dt * 1.4);
    if (Math.random() < 0.3) {
      addSpark(canvas.width / 2 + state.playerX * 120, canvas.height * 0.8);
    }
  } else {
    state.driftHeat = Math.max(0, state.driftHeat - dt * 0.8);
  }

  state.score += Math.floor(state.speed * dt * 0.02);
};

const drawBackground = (beatValue) => {
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, colors.skyTop);
  gradient.addColorStop(1, colors.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.fillStyle = "rgba(255,255,255,0.12)";
  ctx.beginPath();
  ctx.arc(canvas.width * 0.78, canvas.height * 0.22, 80 + beatValue * 20, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
};

const drawRoad = () => {
  const baseSegment = findSegment(state.position);
  const baseIndex = baseSegment.index;

  let x = 0;
  let dx = 0;
  let maxY = canvas.height;

  for (let n = 0; n < config.drawDistance; n += 1) {
    const segment = state.segments[(baseIndex + n) % state.segments.length];
    const z = (n + 1) * config.segmentLength;
    const curve = segment.curve;
    const hill = segment.hill;
    const segmentX = x;
    const segmentDx = dx;

    x += dx;
    dx += curve;

    const worldX = segmentX - state.playerX * config.roadWidth;
    const worldY = hill - config.cameraHeight;
    const projected = project(worldX, worldY, z);

    if (projected.y >= maxY) {
      continue;
    }

    const prevZ = n * config.segmentLength;
    const prevX = segmentX - state.playerX * config.roadWidth;
    const prevY = worldY + 40;
    const prevProjected = project(prevX, prevY, prevZ + config.segmentLength);

    const rumbleW = projected.w * 1.12;
    const laneW = projected.w * 0.08;

    ctx.fillStyle = segment.grass;
    ctx.fillRect(0, projected.y, canvas.width, maxY - projected.y);

    ctx.fillStyle = segment.color;
    ctx.beginPath();
    ctx.moveTo(projected.x - projected.w, projected.y);
    ctx.lineTo(projected.x + projected.w, projected.y);
    ctx.lineTo(prevProjected.x + prevProjected.w, prevProjected.y);
    ctx.lineTo(prevProjected.x - prevProjected.w, prevProjected.y);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = colors.rumble;
    ctx.beginPath();
    ctx.moveTo(projected.x - rumbleW, projected.y);
    ctx.lineTo(projected.x - projected.w, projected.y);
    ctx.lineTo(prevProjected.x - prevProjected.w, prevProjected.y);
    ctx.lineTo(prevProjected.x - rumbleW, prevProjected.y);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(projected.x + rumbleW, projected.y);
    ctx.lineTo(projected.x + projected.w, projected.y);
    ctx.lineTo(prevProjected.x + prevProjected.w, prevProjected.y);
    ctx.lineTo(prevProjected.x + rumbleW, prevProjected.y);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = colors.lane;
    ctx.lineWidth = laneW;
    ctx.beginPath();
    ctx.moveTo(projected.x, projected.y);
    ctx.lineTo(prevProjected.x, prevProjected.y);
    ctx.stroke();

    maxY = projected.y;
  }
};

const drawSpeedLines = (beatValue) => {
  const count = 40;
  ctx.save();
  ctx.strokeStyle = `rgba(120, 226, 255, ${0.12 + beatValue * 0.2})`;
  for (let i = 0; i < count; i += 1) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height * 0.6;
    const length = 40 + beatValue * 80;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y + length);
    ctx.stroke();
  }
  ctx.restore();
};

const drawKart = () => {
  const baseX = canvas.width / 2 + state.playerX * 120;
  const baseY = canvas.height * 0.78;
  const tilt = state.drift * 12;

  ctx.save();
  ctx.translate(baseX, baseY);
  ctx.rotate(tilt * 0.01);

  const glow = 0.6 + state.driftHeat * 0.6;
  ctx.shadowColor = `rgba(255, 140, 255, ${glow})`;
  ctx.shadowBlur = 20 + state.driftHeat * 15;
  ctx.fillStyle = state.driftHeat > 0.2 ? "#ff7cf7" : "#61d3ff";

  ctx.beginPath();
  ctx.moveTo(0, -50);
  ctx.lineTo(40, 40);
  ctx.lineTo(0, 20);
  ctx.lineTo(-40, 40);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(-12, -6, 24, 28);
  ctx.restore();
};

const drawSparks = () => {
  state.sparks.forEach((spark) => {
    ctx.save();
    ctx.globalAlpha = spark.life;
    ctx.fillStyle = `hsl(${spark.hue}, 90%, 70%)`;
    ctx.beginPath();
    ctx.arc(spark.x + (Math.random() - 0.5) * 8, spark.y, spark.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
};

const updateHud = (beatValue) => {
  speedEl.textContent = Math.round(state.speed / 20);
  orbsEl.textContent = Math.floor(state.score / 100);
  pulseEl.textContent = state.driftHeat > 0.15 ? "Drifting" : "Grip";
  beatFill.style.boxShadow = `0 0 ${12 + beatValue * 18}px rgba(115, 179, 255, 0.9)`;
};

const tick = (time) => {
  const dt = Math.min((time - lastTime) / 1000, 0.033) || 0;
  lastTime = time;

  const beatValue = updateBeat(dt);
  updatePlayer(dt);
  updateSparks(dt);

  drawBackground(beatValue);
  drawRoad();
  drawSpeedLines(beatValue);
  drawKart();
  drawSparks();
  updateHud(beatValue);

  requestAnimationFrame(tick);
};

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

window.addEventListener("resize", resize);

reset();
resize();
requestAnimationFrame(tick);
