// blocker-city - Open-world crime game (GTA 6 spirit)
// Original city, characters, vehicles, names, story, art, sounds and music.
// Nothing from Rockstar Games or any commercial game.

const GAME_WIDTH = 2400;
const GAME_HEIGHT = 2400;
const ROAD_WIDTH = 60;
const BLOCK_SIZE = 200;
const FPS = 60;

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
const ui = document.getElementById('ui');
const hud = document.getElementById('hud');
const minimap = document.getElementById('minimap');
const mmCtx = minimap.getContext('2d');
const startScreen = document.getElementById('startScreen');
const missionText = document.getElementById('missionText');
const wantedText = document.getElementById('wantedText');
const moneyText = document.getElementById('moneyText');
const healthText = document.getElementById('healthText');

let running = true;
let gameStarted = false;
let lastTime = 0;
let frameCount = 0;

// ---- Input ----
const keys = {};
const mouse = { x: 0, y: 0, worldX: 0, worldY: 0, down: false };
window.addEventListener('keydown', e => { keys[e.code] = true; });
window.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('mousedown', () => { mouse.down = true; });
window.addEventListener('mouseup', () => { mouse.down = false; });
window.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
  mouse.worldX = camera.x + mouse.x;
  mouse.worldY = camera.y + mouse.y;
});

// ---- Camera ----
const camera = { x: 0, y: 0, w: 800, h: 600 };

// ---- Entities ----
const player = {
  x: 400, y: 400, w: 24, h: 24,
  vx: 0, vy: 0,
  speed: 4.5, sprint: 7,
  angle: 0,
  health: 100, maxHealth: 100,
  money: 0,
  wanted: 0, maxWanted: 5,
  inCar: false,
  car: null,
  invuln: 0,
  shootCooldown: 0,
};

const bullets = [];
const cars = [];
const peds = [];
const police = [];
const particles = [];

const COLORS = {
  road: '#3a3a3a',
  roadLine: '#555',
  sidewalk: '#7a7a7a',
  grass: '#4a7c59',
  building: '#c8c8c8',
  buildingRoof: '#b0b0b0',
  player: '#4a90e2',
  car: '#e74c3c',
  ped: '#9b59b6',
  police: '#e67e22',
  bullet: '#f1c40f',
  particle: '#e67e22',
  hudBg: 'rgba(0,0,0,0.6)',
  hudText: '#fff',
};

// ---- Procedural city ----
function hash2(x, y) {
  let h = (x * 31 + y * 17) | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  return h;
}

function rand(x, y, n) {
  return Math.abs(hash2(x, y)) % n;
}

const buildings = [];
function generateCity() {
  for (let bx = 0; bx < GAME_WIDTH; bx += BLOCK_SIZE) {
    for (let by = 0; by < GAME_HEIGHT; by += BLOCK_SIZE) {
      const roadH = bx % (BLOCK_SIZE + ROAD_WIDTH) < ROAD_WIDTH;
      const roadV = by % (BLOCK_SIZE + ROAD_WIDTH) < ROAD_WIDTH;
      if (!roadH && !roadV) {
        const h = bx + ROAD_WIDTH;
        const v = by + ROAD_WIDTH;
        const bw = BLOCK_SIZE - ROAD_WIDTH * 2;
        const bh = BLOCK_SIZE - ROAD_WIDTH * 2;
        const colorShift = hash2(bx, by) % 40 - 20;
        const col = `rgb(${180 + colorShift},${180 + colorShift},${190 + colorShift})`;
        buildings.push({ x: h, y: v, w: bw, h: bh, color: col, type: hash2(bx, by) % 5 });
      }
    }
  }
  // Spawn parked cars
  for (let i = 0; i < 40; i++) {
    const bx = rand(i * 7, i * 13, GAME_WIDTH / (BLOCK_SIZE + ROAD_WIDTH)) * (BLOCK_SIZE + ROAD_WIDTH) + ROAD_WIDTH * 2;
    const by = rand(i * 11, i * 5, GAME_HEIGHT / (BLOCK_SIZE + ROAD_WIDTH)) * (BLOCK_SIZE + ROAD_WIDTH) + ROAD_WIDTH * 2;
    spawnCar(bx + 30, by + 30, false);
  }
  // Spawn pedestrians
  for (let i = 0; i < 25; i++) {
    const bx = rand(i * 3, i * 9, GAME_WIDTH / (BLOCK_SIZE + ROAD_WIDTH)) * (BLOCK_SIZE + ROAD_WIDTH) + ROAD_WIDTH * 2;
    const by = rand(i * 5, i * 2, GAME_HEIGHT / (BLOCK_SIZE + ROAD_WIDTH)) * (BLOCK_SIZE + ROAD_WIDTH) + ROAD_WIDTH * 2;
    spawnPed(bx + 30, by + 30);
  }
}

// ---- Car system ----
function spawnCar(x, y, traffic = true) {
  const hues = ['#e74c3c','#3498db','#2ecc71','#f1c40f','#9b59b6','#e67e22','#95a5a6','#34495e'];
  const h = hues[rand(x * 3, y * 7, hues.length)];
  cars.push({
    x, y, w: 34, h: 18,
    vx: 0, vy: 0,
    angle: 0, speed: 0, maxSpeed: traffic ? 3.5 : 0,
    color: h, traffic, occupied: false,
    health: 100, driver: null,
    targetX: x, targetY: y,
  });
}

function updateCars() {
  for (const car of cars) {
    if (car.occupied && car.driver === player) {
      // Player driving
      let accel = 0;
      if (keys['KeyW']) accel = 0.15;
      if (keys['KeyS']) accel = -0.1;
      car.speed += accel;
      car.speed *= 0.96;
      if (Math.abs(car.speed) > car.maxSpeed) car.speed = car.maxSpeed;
      if (keys['KeyA']) car.angle -= 0.06 * Math.sign(car.speed);
      if (keys['KeyD']) car.angle += 0.06 * Math.sign(car.speed);
      car.x += Math.cos(car.angle) * car.speed;
      car.y += Math.sin(car.angle) * car.speed;
      player.x = car.x + Math.cos(car.angle) * 12;
      player.y = car.y + Math.sin(car.angle) * 12;
      player.angle = car.angle;
      if (keys['KeyE'] && frameCount % 30 === 0) exitCar();
      if (mouse.down && frameCount % 10 === 0) shootFromCar();
    } else if (car.traffic) {
      // AI traffic
      const dx = car.targetX - car.x;
      const dy = car.targetY - car.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < 40) {
        car.targetX = car.x + (rand(car.x, car.y, 400) - 200);
        car.targetY = car.y + (rand(car.x * 2, car.y * 3, 400) - 200);
        car.targetX = Math.max(ROAD_WIDTH, Math.min(GAME_WIDTH - ROAD_WIDTH, car.targetX));
        car.targetY = Math.max(ROAD_WIDTH, Math.min(GAME_HEIGHT - ROAD_WIDTH, car.targetY));
      }
      const targetAngle = Math.atan2(dy, dx);
      let angleDiff = targetAngle - car.angle;
      while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
      while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
      car.angle += angleDiff * 0.05;
      car.speed = Math.min(car.speed + 0.02, car.maxSpeed);
      car.x += Math.cos(car.angle) * car.speed;
      car.y += Math.sin(car.angle) * car.speed;
      if (car.x < ROAD_WIDTH || car.x > GAME_WIDTH - ROAD_WIDTH || car.y < ROAD_WIDTH || car.y > GAME_HEIGHT - ROAD_WIDTH) {
        car.angle += Math.PI;
        car.speed *= 0.8;
      }
    }
    // Car collisions with player on foot
    if (!player.inCar && !car.occupied && rectOverlap(player, car)) {
      if (keys['KeyE'] && frameCount % 30 === 0) enterCar(car);
    }
  }
}

function enterCar(car) {
  if (car.occupied) return;
  player.inCar = true;
  player.car = car;
  car.occupied = true;
  car.driver = player;
  car.angle = Math.atan2(player.y - car.y, player.x - car.x);
  addMission('Steal a car and drive around the city');
  increaseWanted(1);
}

function exitCar() {
  if (!player.car) return;
  const angle = player.car.angle;
  player.x = player.car.x - Math.cos(angle) * 30;
  player.y = player.car.y - Math.sin(angle) * 30;
  player.inCar = false;
  player.car.occupied = false;
  player.car.driver = null;
  player.car = null;
}

function shootFromCar() {
  const bx = player.x + Math.cos(player.angle) * 20;
  const by = player.y + Math.sin(player.angle) * 20;
  const dx = mouse.worldX - bx;
  const dy = mouse.worldY - by;
  const dist = Math.sqrt(dx*dx + dy*dy);
  bullets.push({ x: bx, y: by, vx: (dx/dist)*12, vy: (dy/dist)*12, life: 40, from: 'player' });
  player.shootCooldown = 10;
  increaseWanted(1);
}

// ---- Pedestrian system ----
function spawnPed(x, y) {
  peds.push({
    x, y, w: 16, h: 20,
    vx: 0, vy: 0,
    angle: rand(x * 5, y * 3, 628) / 100,
    speed: 1 + rand(x * 2, y * 4, 200) / 100,
    dirChange: 0,
    color: COLORS.ped,
  });
}

function updatePeds() {
  for (const ped of peds) {
    ped.dirChange--;
    if (ped.dirChange <= 0) {
      ped.angle = Math.random() * Math.PI * 2;
      ped.dirChange = rand(ped.x, ped.y, 120) + 60;
    }
    ped.x += Math.cos(ped.angle) * ped.speed;
    ped.y += Math.sin(ped.angle) * ped.speed;
    if (ped.x < 0 || ped.x > GAME_WIDTH || ped.y < 0 || ped.y > GAME_HEIGHT) {
      ped.x = Math.max(0, Math.min(GAME_WIDTH, ped.x));
      ped.y = Math.max(0, Math.min(GAME_HEIGHT, ped.y));
      ped.angle += Math.PI;
    }
    // Player running over peds
    if (!player.inCar && rectOverlap(player, ped) && keys['KeyW']) {
      increaseWanted(2);
      ped.x = -1000; // remove
    }
  }
}

// ---- Police system ----
function spawnPolice() {
  const angle = Math.random() * Math.PI * 2;
  const dist = 400 + Math.random() * 600;
  police.push({
    x: player.x + Math.cos(angle) * dist,
    y: player.y + Math.sin(angle) * dist,
    w: 24, h: 24,
    vx: 0, vy: 0,
    speed: 3.2,
    angle,
    state: 'chase', // chase, search
    targetX: player.x, targetY: player.y,
  });
}

function updatePolice() {
  if (player.wanted > 0 && police.length < player.wanted * 2 + 2 && frameCount % 120 === 0) {
    spawnPolice();
  }
  if (player.wanted > 0) player.wanted -= 0.002; // decay
  if (player.wanted < 0) player.wanted = 0;

  for (const cop of police) {
    const dx = player.x - cop.x;
    const dy = player.y - cop.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    cop.angle = Math.atan2(dy, dx);
    cop.x += Math.cos(cop.angle) * cop.speed;
    cop.y += Math.sin(cop.angle) * cop.speed;
    if (dist < 40) {
      player.health -= 0.5;
      increaseWanted(0.5);
    }
    if (player.inCar && dist < 60 && frameCount % 60 === 0) {
      player.health -= 1;
      increaseWanted(1);
    }
  }
  // Remove dead police
  for (let i = police.length - 1; i >= 0; i--) {
    if (police[i].x < -500 || police[i].x > GAME_WIDTH + 500 ||
        police[i].y < -500 || police[i].y > GAME_HEIGHT + 500) {
      police.splice(i, 1);
    }
  }
}

function increaseWanted(amount) {
  player.wanted = Math.min(player.wanted + amount, player.maxWanted);
}

// ---- Bullets ----
function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;
    if (b.life <= 0) { bullets.splice(i, 1); continue; }
    // Hit police
    for (let j = police.length - 1; j >= 0; j--) {
      if (dist(b, police[j]) < 30) {
        police.splice(j, 1);
        bullets.splice(i, 1);
        player.money += 50;
        addMission('Drive around and avoid the police');
        break;
      }
    }
    // Hit peds
    if (b.from === 'player') {
      for (let j = peds.length - 1; j >= 0; j--) {
        if (dist(b, peds[j]) < 20) {
          peds.splice(j, 1);
          bullets.splice(i, 1);
          increaseWanted(3);
          break;
        }
      }
    }
    if (b.x < 0 || b.x > GAME_WIDTH || b.y < 0 || b.y > GAME_HEIGHT) bullets.splice(i, 1);
  }
}

function dist(a, b) { return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2); }
function rectOverlap(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }

// ---- Player ----
function updatePlayer() {
  if (player.inCar) return;
  let spd = player.speed;
  if (keys['ShiftLeft']) spd = player.sprint;
  let dx = 0, dy = 0;
  if (keys['KeyW']) dy = -1;
  if (keys['KeyS']) dy = 1;
  if (keys['KeyA']) dx = -1;
  if (keys['KeyD']) dx = 1;
  if (dx !== 0 || dy !== 0) {
    const len = Math.sqrt(dx*dx + dy*dy);
    player.x += (dx/len) * spd;
    player.y += (dy/len) * spd;
    player.angle = Math.atan2(mouse.worldY - player.y, mouse.worldX - player.x);
  }
  // Clamp to world
  player.x = Math.max(0, Math.min(GAME_WIDTH, player.x));
  player.y = Math.max(0, Math.min(GAME_HEIGHT, player.y));
  // Shooting
  if (player.shootCooldown > 0) player.shootCooldown--;
  if (mouse.down && player.shootCooldown <= 0) {
    const bx = player.x + Math.cos(player.angle) * 18;
    const by = player.y + Math.sin(player.angle) * 18;
    const dx = mouse.worldX - bx;
    const dy = mouse.worldY - by;
    const d = Math.sqrt(dx*dx + dy*dy);
    bullets.push({ x: bx, y: by, vx: (dx/d)*14, vy: (dy/d)*14, life: 50, from: 'player' });
    player.shootCooldown = 12;
    increaseWanted(2);
  }
  if (player.invuln > 0) player.invuln--;
}

// ---- Particles ----
function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx; p.y += p.vy;
    p.life--; p.alpha -= 0.02;
    if (p.life <= 0 || p.alpha <= 0) particles.splice(i, 1);
  }
}

// ---- Camera follow ----
function updateCamera() {
  const tx = player.inCar ? player.car.x : player.x;
  const ty = player.inCar ? player.car.y : player.y;
  camera.x += (tx - camera.w/2 - camera.x) * 0.1;
  camera.y += (ty - camera.h/2 - camera.y) * 0.1;
  camera.x = Math.max(0, Math.min(GAME_WIDTH - camera.w, camera.x));
  camera.y = Math.max(0, Math.min(GAME_HEIGHT - camera.h, camera.y));
}

// ---- Missions ----
let currentMission = 'Drive around and explore the city';
function addMission(text) {
  currentMission = text;
  missionText.textContent = 'Mission: ' + text;
}

// ---- Rendering ----
function drawWorld() {
  // Grass
  ctx.fillStyle = COLORS.grass;
  ctx.fillRect(-camera.x, -camera.y, GAME_WIDTH, GAME_HEIGHT);
  // Roads
  ctx.fillStyle = COLORS.road;
  for (let x = 0; x < GAME_WIDTH; x += BLOCK_SIZE + ROAD_WIDTH) {
    ctx.fillRect(x - camera.x, -camera.y, ROAD_WIDTH, GAME_HEIGHT);
  }
  for (let y = 0; y < GAME_HEIGHT; y += BLOCK_SIZE + ROAD_WIDTH) {
    ctx.fillRect(-camera.x, y - camera.y, GAME_WIDTH, ROAD_WIDTH);
  }
  // Road lines
  ctx.strokeStyle = COLORS.roadLine;
  ctx.lineWidth = 3;
  ctx.setLineDash([20, 20]);
  for (let x = ROAD_WIDTH/2; x < GAME_WIDTH; x += BLOCK_SIZE + ROAD_WIDTH) {
    ctx.beginPath(); ctx.moveTo(x - camera.x, -camera.y); ctx.lineTo(x - camera.x, GAME_HEIGHT - camera.y); ctx.stroke();
  }
  for (let y = ROAD_WIDTH/2; y < GAME_HEIGHT; y += BLOCK_SIZE + ROAD_WIDTH) {
    ctx.beginPath(); ctx.moveTo(-camera.x, y - camera.y); ctx.lineTo(GAME_WIDTH - camera.x, y - camera.y); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Buildings
  for (const b of buildings) {
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
    ctx.strokeStyle = '#888';
    ctx.lineWidth = 1;
    ctx.strokeRect(b.x - camera.x, b.y - camera.y, b.w, b.h);
  }
  // Sidewalks
  ctx.fillStyle = COLORS.sidewalk;
  for (let x = 0; x < GAME_WIDTH; x += BLOCK_SIZE + ROAD_WIDTH) {
    ctx.fillRect(x - camera.x + ROAD_WIDTH/2, -camera.y, ROAD_WIDTH/2, GAME_HEIGHT);
    ctx.fillRect(x + BLOCK_SIZE - camera.x - ROAD_WIDTH/4, -camera.y, ROAD_WIDTH/4, GAME_HEIGHT);
  }
  for (let y = 0; y < GAME_HEIGHT; y += BLOCK_SIZE + ROAD_WIDTH) {
    ctx.fillRect(-camera.x, y - camera.y + ROAD_WIDTH/2, GAME_WIDTH, ROAD_WIDTH/2);
    ctx.fillRect(-camera.x, y + BLOCK_SIZE - camera.y - ROAD_WIDTH/4, GAME_WIDTH, ROAD_WIDTH/4);
  }
}

function drawEntities() {
  // Police cars (as colored squares with lights)
  for (const cop of police) {
    ctx.fillStyle = COLORS.police;
    ctx.beginPath();
    ctx.arc(cop.x - camera.x, cop.y - camera.y, 14, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#f1c40f';
    ctx.fillRect(cop.x - camera.x - 6, cop.y - camera.y - 16, 12, 4);
  }
  // Traffic cars
  for (const car of cars) {
    if (car.occupied && car.driver === player) continue;
    ctx.fillStyle = car.color;
    ctx.save();
    ctx.translate(car.x - camera.x, car.y - camera.y);
    ctx.rotate(car.angle);
    ctx.fillRect(-car.w/2, -car.h/2, car.w, car.h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-6, -car.h/2 - 2, 4, 4);
    ctx.fillRect(car.w/2 - 4, -car.h/2 - 2, 4, 4);
    ctx.restore();
    if (!car.occupied) {
      ctx.fillStyle = COLORS.ped;
      ctx.fillRect(car.x - camera.x - 4, car.y - camera.y - 10, 4, 6);
      ctx.fillRect(car.x - camera.x + car.w, car.y - camera.y - 10, 4, 6);
    }
  }
  // Player car
  if (player.inCar && player.car) {
    const car = player.car;
    ctx.fillStyle = '#e74c3c';
    ctx.save();
    ctx.translate(car.x - camera.x, car.y - camera.y);
    ctx.rotate(car.angle);
    ctx.fillRect(-car.w/2, -car.h/2, car.w, car.h);
    ctx.fillStyle = '#fff';
    ctx.fillRect(-6, -car.h/2 - 2, 4, 4);
    ctx.fillRect(car.w/2 - 4, -car.h/2 - 2, 4, 4);
    ctx.restore();
  }
  // Pedestrians
  for (const ped of peds) {
    ctx.fillStyle = ped.color;
    ctx.fillRect(ped.x - camera.x - ped.w/2, ped.y - camera.y - ped.h/2, ped.w, ped.h);
  }
  // Player
  if (!player.inCar) {
    ctx.fillStyle = player.invuln % 4 < 2 ? COLORS.player : '#fff';
    ctx.beginPath();
    ctx.arc(player.x - camera.x, player.y - camera.y, 10, 0, Math.PI*2);
    ctx.fill();
    // Aim line
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(player.x - camera.x, player.y - camera.y);
    ctx.lineTo(player.x - camera.x + Math.cos(player.angle) * 30, player.y - camera.y + Math.sin(player.angle) * 30);
    ctx.stroke();
  }
  // Bullets
  ctx.fillStyle = COLORS.bullet;
  for (const b of bullets) {
    ctx.beginPath();
    ctx.arc(b.x - camera.x, b.y - camera.y, 3, 0, Math.PI*2);
    ctx.fill();
  }
  // Particles
  for (const p of particles) {
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.fillRect(p.x - camera.x - 2, p.y - camera.y - 2, 4, 4);
    ctx.globalAlpha = 1;
  }
}

function drawHUD() {
  // Minimap
  mmCtx.fillStyle = '#1a1a1a';
  mmCtx.fillRect(0, 0, 160, 120);
  mmCtx.strokeStyle = '#444';
  mmCtx.strokeRect(0, 0, 160, 120);
  const sx = 160 / GAME_WIDTH;
  const sy = 120 / GAME_HEIGHT;
  for (const b of buildings) {
    mmCtx.fillStyle = '#666';
    mmCtx.fillRect(b.x * sx, b.y * sy, b.w * sx, b.h * sy);
  }
  // Player dot
  mmCtx.fillStyle = COLORS.player;
  const px = player.inCar ? player.car.x : player.x;
  const py = player.inCar ? player.car.y : player.y;
  mmCtx.fillRect(px * sx - 1, py * sy - 1, 3, 3);
  // Police dots
  mmCtx.fillStyle = COLORS.police;
  for (const cop of police) mmCtx.fillRect(cop.x * sx - 1, cop.y * sy - 1, 3, 3);
  // Camera view rect
  mmCtx.strokeStyle = '#4a90e2';
  mmCtx.strokeRect(camera.x * sx, camera.y * sy, camera.w * sx, camera.h * sy);

  // Wanted stars
  let stars = '';
  for (let i = 0; i < Math.ceil(player.wanted); i++) stars += '\u2605';
  wantedText.textContent = stars || '\u2606\u2606\u2606\u2606\u2606';
  wantedText.style.color = player.wanted > 2 ? '#e74c3c' : '#f1c40f';

  missionText.textContent = 'Mission: ' + currentMission;
  moneyText.textContent = '$' + Math.floor(player.money);
  healthText.textContent = Math.floor(player.health) + ' HP';
}

function drawUI() {
  if (!gameStarted) return;
  // Crosshair
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(mouse.x, mouse.y, 8, 0, Math.PI*2);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(mouse.x - 12, mouse.y); ctx.lineTo(mouse.x + 12, mouse.y);
  ctx.moveTo(mouse.x, mouse.y - 12); ctx.lineTo(mouse.x, mouse.y + 12);
  ctx.stroke();
}

function loop(t) {
  if (!running) return;
  const dt = (t - lastTime) / 16.67;
  lastTime = t;
  frameCount++;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(-camera.x, -camera.y);
  drawWorld();
  updateCars();
  updatePeds();
  updatePolice();
  updatePlayer();
  updateBullets();
  updateParticles();
  drawEntities();
  ctx.restore();
  updateCamera();
  drawHUD();
  drawUI();

  if (player.health <= 0) {
    running = false;
    startScreen.querySelector('h1').textContent = 'WASTED';
    startScreen.querySelector('p').textContent = 'Your crime spree ended. Press Enter to restart.';
    startScreen.style.display = 'flex';
    gameStarted = false;
  }

  requestAnimationFrame(loop);
}

// ---- Save/Load ----
function saveGame() {
  const data = {
    money: player.money,
    health: player.health,
    x: player.x, y: player.y,
    wanted: player.wanted,
  };
  localStorage.setItem('blocker-city-save', JSON.stringify(data));
}

function loadGame() {
  const raw = localStorage.getItem('blocker-city-save');
  if (!raw) return;
  const data = JSON.parse(raw);
  player.money = data.money || 0;
  player.health = data.health || 100;
  player.x = data.x || 400;
  player.y = data.y || 400;
  player.wanted = data.wanted || 0;
}

window.addEventListener('beforeunload', saveGame);

// ---- Start screen ----
startScreen.querySelector('h1').textContent = 'BLOCKER CITY';
startScreen.querySelector('p').textContent = 'Open-world crime game. WASD to move, Mouse to aim/shoot, E to enter car, Shift to sprint. Press Enter to start.';
startScreen.querySelector('button').textContent = 'Start Game';
startScreen.querySelector('button').onclick = () => {
  startScreen.style.display = 'none';
  gameStarted = true;
  loadGame();
  running = true;
  lastTime = performance.now();
  requestAnimationFrame(loop);
};
window.addEventListener('keydown', e => {
  if (e.code === 'Enter' && !gameStarted && !running) {
    startScreen.style.display = 'none';
    gameStarted = true;
    loadGame();
    running = true;
    lastTime = performance.now();
    requestAnimationFrame(loop);
  }
});

// ---- Init ----
generateCity();

// Resize canvas
function resize() {
  canvas.width = 800;
  canvas.height = 600;
}
window.addEventListener('resize', resize);
resize();
