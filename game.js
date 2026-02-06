const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const speedEl = document.getElementById("speed");
const orbsEl = document.getElementById("orbs");
const pulseEl = document.getElementById("pulse");
const beatFill = document.getElementById("beat-fill");

const keys = new Set();
let lastTime = 0;

const state = {
  kart: {
    x: 0,
    y: 0,
    angle: -Math.PI / 2,
    speed: 0,
  },
  track: {
    a: 260,
    b: 180,
    width: 120,
  },
  beat: {
    phase: 0,
    speed: 1.6,
  },
  pulse: {
    active: false,
    timer: 0,
    cooldown: 0,
  },
  orbs: [],
  gates: [],
  score: 0,
};

const createOrb = (angleOffset) => ({
  angle: angleOffset,
  collected: false,
});

const createGate = (angleOffset) => ({
  angle: angleOffset,
  flashed: false,
});

const initTrackItems = () => {
  state.orbs = [];
  state.gates = [];
  for (let i = 0; i < 12; i += 1) {
    state.orbs.push(createOrb((Math.PI * 2 * i) / 12));
  }
  for (let i = 0; i < 6; i += 1) {
    state.gates.push(createGate((Math.PI * 2 * i) / 6 + Math.PI / 12));
  }
};

const resize = () => {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  state.kart.x = canvas.width / 2;
  state.kart.y = canvas.height / 2 - state.track.b + state.track.width / 2;
};

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const isOnTrack = (x, y) => {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const outerA = state.track.a + state.track.width / 2;
  const outerB = state.track.b + state.track.width / 2;
  const innerA = state.track.a - state.track.width / 2;
  const innerB = state.track.b - state.track.width / 2;
  const outerValue = (dx * dx) / (outerA * outerA) + (dy * dy) / (outerB * outerB);
  const innerValue = (dx * dx) / (innerA * innerA) + (dy * dy) / (innerB * innerB);
  return outerValue <= 1 && innerValue >= 1;
};

const pointOnCenterline = (angle) => {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;
  return {
    x: cx + Math.cos(angle) * state.track.a,
    y: cy + Math.sin(angle) * state.track.b,
  };
};

const updateBeat = (dt) => {
  state.beat.phase += dt * state.beat.speed;
  const value = (Math.sin(state.beat.phase) + 1) / 2;
  beatFill.style.width = `${value * 100}%`;
  return value;
};

const triggerPulse = (beatValue) => {
  if (state.pulse.cooldown > 0 || state.pulse.active) {
    return;
  }
  if (beatValue > 0.72) {
    state.pulse.active = true;
    state.pulse.timer = 2.2;
    state.pulse.cooldown = 3.5;
  }
};

const updateKart = (dt, beatValue) => {
  const steering = (keys.has("ArrowLeft") || keys.has("a") ? -1 : 0) +
    (keys.has("ArrowRight") || keys.has("d") ? 1 : 0);
  const throttle = (keys.has("ArrowUp") || keys.has("w") ? 1 : 0) -
    (keys.has("ArrowDown") || keys.has("s") ? 1 : 0);

  if (keys.has(" ")) {
    triggerPulse(beatValue);
  }

  const acceleration = throttle * 260;
  state.kart.speed += acceleration * dt;
  state.kart.speed *= 0.98;
  state.kart.speed = clamp(state.kart.speed, -120, 320);

  const turnStrength = 2.4 + Math.abs(state.kart.speed) / 120;
  state.kart.angle += steering * turnStrength * dt * (state.kart.speed / 200 + 0.8);

  if (state.pulse.active) {
    state.kart.speed += 120 * dt;
  }

  state.kart.x += Math.cos(state.kart.angle) * state.kart.speed * dt;
  state.kart.y += Math.sin(state.kart.angle) * state.kart.speed * dt;

  if (!isOnTrack(state.kart.x, state.kart.y)) {
    state.kart.speed *= 0.92;
  }
};

const updatePulse = (dt) => {
  if (state.pulse.cooldown > 0) {
    state.pulse.cooldown = Math.max(0, state.pulse.cooldown - dt);
  }
  if (state.pulse.active) {
    state.pulse.timer -= dt;
    if (state.pulse.timer <= 0) {
      state.pulse.active = false;
    }
  }
};

const updateItems = () => {
  state.orbs.forEach((orb) => {
    if (orb.collected) {
      return;
    }
    const pos = pointOnCenterline(orb.angle);
    const dx = state.kart.x - pos.x;
    const dy = state.kart.y - pos.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 26) {
      orb.collected = true;
      state.score += 1;
      state.kart.speed += 40;
    }
  });

  state.gates.forEach((gate) => {
    const pos = pointOnCenterline(gate.angle);
    const dx = state.kart.x - pos.x;
    const dy = state.kart.y - pos.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 32 && state.pulse.active && !gate.flashed) {
      gate.flashed = true;
      state.kart.speed += 80;
    }
    if (distance > 60) {
      gate.flashed = false;
    }
  });
};

const drawTrack = () => {
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  ctx.fillStyle = "#0c1020";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.fillStyle = "#1b223a";
  ctx.beginPath();
  ctx.ellipse(cx, cy, state.track.a + state.track.width / 2, state.track.b + state.track.width / 2, 0, 0, Math.PI * 2);
  ctx.ellipse(cx, cy, state.track.a - state.track.width / 2, state.track.b - state.track.width / 2, 0, 0, Math.PI * 2, true);
  ctx.fill("evenodd");

  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.ellipse(cx, cy, state.track.a, state.track.b, 0, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
};

const drawItems = (beatValue) => {
  state.orbs.forEach((orb) => {
    if (orb.collected) {
      return;
    }
    const pos = pointOnCenterline(orb.angle);
    ctx.beginPath();
    ctx.fillStyle = "rgba(108, 255, 214, 0.9)";
    ctx.shadowColor = "rgba(108, 255, 214, 0.8)";
    ctx.shadowBlur = 12;
    ctx.arc(pos.x, pos.y, 12, 0, Math.PI * 2);
    ctx.fill();
  });

  state.gates.forEach((gate) => {
    const pos = pointOnCenterline(gate.angle);
    const glow = 0.4 + beatValue * 0.6;
    ctx.beginPath();
    ctx.strokeStyle = `rgba(131, 94, 255, ${glow})`;
    ctx.lineWidth = 5 + beatValue * 3;
    ctx.shadowColor = "rgba(131, 94, 255, 0.7)";
    ctx.shadowBlur = 16;
    ctx.arc(pos.x, pos.y, 22, 0, Math.PI * 2);
    ctx.stroke();
  });
  ctx.shadowBlur = 0;
};

const drawKart = () => {
  ctx.save();
  ctx.translate(state.kart.x, state.kart.y);
  ctx.rotate(state.kart.angle + Math.PI / 2);

  ctx.fillStyle = state.pulse.active ? "#ff85f7" : "#4ed1ff";
  ctx.shadowColor = state.pulse.active ? "rgba(255, 133, 247, 0.8)" : "rgba(78, 209, 255, 0.8)";
  ctx.shadowBlur = state.pulse.active ? 18 : 10;

  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(14, 18);
  ctx.lineTo(0, 10);
  ctx.lineTo(-14, 18);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = "rgba(0,0,0,0.4)";
  ctx.fillRect(-6, 0, 12, 14);

  ctx.restore();
  ctx.shadowBlur = 0;
};

const drawHud = () => {
  speedEl.textContent = Math.round(Math.abs(state.kart.speed));
  orbsEl.textContent = state.score;
  if (state.pulse.active) {
    pulseEl.textContent = "Active";
  } else if (state.pulse.cooldown > 0) {
    pulseEl.textContent = `Cooldown ${state.pulse.cooldown.toFixed(1)}s`;
  } else {
    pulseEl.textContent = "Ready";
  }
};

const tick = (time) => {
  const dt = Math.min((time - lastTime) / 1000, 0.033) || 0;
  lastTime = time;

  const beatValue = updateBeat(dt);
  updatePulse(dt);
  updateKart(dt, beatValue);
  updateItems();

  drawTrack();
  drawItems(beatValue);
  drawKart();
  drawHud();

  requestAnimationFrame(tick);
};

window.addEventListener("keydown", (event) => {
  keys.add(event.key);
});

window.addEventListener("keyup", (event) => {
  keys.delete(event.key);
});

window.addEventListener("resize", resize);

initTrackItems();
resize();
requestAnimationFrame(tick);
