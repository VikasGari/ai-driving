const canvasContainer = document.getElementById("canvas-container");
const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d");

let zoom = 0.7;
let cameraTarget = null;

function resizeCanvas() {
  canvas.width = canvasContainer.offsetWidth;
  canvas.height = canvasContainer.offsetHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

let mode = "EDITING";
const road = new Road(canvas.width / 2, 200, 3);
let useNetwork = true; // enable road network editing by default
let roadNetwork = new RoadNetwork(canvas.width / 2, canvas.height / 2, road.width);
let useTilemap = true; // enable tilemap road editor
let tilemapEditor = new TilemapRoadEditor(60);
const carHeight = 50;
const SPAWN_PADDING = 5;
let startPose = road.getLaneStartPose(1);
let offsetX = Math.sin(startPose.angle) * (carHeight / 2 + SPAWN_PADDING);
let offsetY = -Math.cos(startPose.angle) * (carHeight / 2 + SPAWN_PADDING);
const car = new Car(
  startPose.x + offsetX,
  startPose.y + offsetY,
  30,
  carHeight,
  "PLAYER"
);
car.angle = startPose.angle;
const agent = new Policy();
const obsBuilder = new ObservationBuilder(road, car);

let traffic = [];
let MAX_TRAFFIC = 10;
const CAR_DENSITY = 300; // cars per pixels of lane length
const TRAFFIC_SPAWN_RATE = 0.02;
const TRAFFIC_SPEED_MIN_FACTOR = 0.6; // fraction of player max
const TRAFFIC_SPEED_MAX_FACTOR = 0.85; // fraction of player max
const SPAWN_SAFE_DISTANCE = 80;

const showPolygonCheckbox = document.getElementById("showPolygon");
const drivingBtn = document.getElementById("drivingBtn");
const editingBtn = document.getElementById("editingBtn");
const resetBtn = document.getElementById("resetBtn");
const zoomSlider = document.getElementById("zoomSlider");
const spawnRateSlider = document.getElementById("spawnRateSlider");
const spawnRateValue = document.getElementById("spawnRateValue");
const saveMapBtn = document.getElementById("saveMapBtn");
const loadMapBtn = document.getElementById("loadMapBtn");
const mapFileInput = document.getElementById("mapFileInput");
zoomSlider.value = zoom;
zoomSlider.addEventListener("input", (event) => {
  zoom = parseFloat(event.target.value);
});
if (spawnRateSlider && spawnRateValue) {
  spawnRateValue.textContent = spawnRateSlider.value;
  spawnRateSlider.addEventListener("input", () => {
    spawnRateValue.textContent = spawnRateSlider.value;
    if (trafficManager) trafficManager.spawnRate = parseFloat(spawnRateSlider.value) / 100;
  });
}

// Map save/load functionality
if (saveMapBtn) {
  saveMapBtn.addEventListener("click", () => {
    if (useTilemap && tilemapEditor) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `map_${timestamp}.json`;
      tilemapEditor.downloadMap(filename);
    }
  });
}

if (loadMapBtn) {
  loadMapBtn.addEventListener("click", () => {
    if (mapFileInput) {
      mapFileInput.click();
    }
  });
}

if (mapFileInput) {
  mapFileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file && useTilemap && tilemapEditor) {
      tilemapEditor.loadMapFromFile(file);
    }
  });
}
function updateTilePropsUI() {
  const el = document.getElementById("tileProps");
  if (!useTilemap || !el) return;
  const key = tilemapEditor.selectedKey;
  if (!key || !tilemapEditor.tiles.has(key)) {
    el.textContent = "No tile selected";
    return;
  }
  const t = tilemapEditor.tiles.get(key);
  const deg = Math.round((t.baseOrientationAngle * 180) / Math.PI) % 360;
  let html = `Grid: (${t.gridX}, ${t.gridY})<br>Orientation: ${deg}°<br>isTurn: ${t.isTurn}<br>isLShape: ${t.isLShape}`;
  // Show button nextTileOrientationBaseAngle for all four buttons
  html += '<br><b>Button nextTileOrientationBaseAngle:</b><br>';
  const btns = t.getButtons(tilemapEditor);
  for (const b of btns) {
    const nextDeg = Math.round((b.nextAngle * 180) / Math.PI) % 360;
    html += `${b.key}: ${nextDeg}°`;
    if (b.active) html += ' (active)';
    html += '<br>';
  }
  el.innerHTML = html;
}

function updateCarPropsUI(car) {
  const el = document.getElementById("carProps");
  if (!el) return;
  if (!car) {
    el.textContent = "No car selected";
    return;
  }
  el.innerHTML = `Position: (${car.x.toFixed(1)}, ${car.y.toFixed(1)})<br>` +
    `Heading: ${(car.heading * 180 / Math.PI).toFixed(0)}°<br>` +
    `Speed: ${car.speed.toFixed(2)} (target ${car.targetSpeed.toFixed(2)})<br>` +
    `Reason: ${car.stopReason}<br>` +
    `FrontRay: ${isFinite(car.frontRay) ? car.frontRay.toFixed(1) : '∞'} px<br>` +
    `RearRay: ${isFinite(car.rearRay) ? car.rearRay.toFixed(1) : '∞'} px`;
}
let trafficManager = null;
drivingBtn.addEventListener("click", () => {
  mode = "DRIVING";
  drivingBtn.classList.add("active");
  editingBtn.classList.remove("active");
  if (useTilemap) {
    // UI: hide tile panel, show car panel; hide tile buttons/selection
    const tileInfo = document.getElementById("tile-info");
    const carInfo = document.getElementById("car-info");
    if (tileInfo) tileInfo.style.display = 'none';
    if (carInfo) carInfo.style.display = '';
    tilemapEditor.showButtons = false;
    tilemapEditor.showTileSelection = false;
    trafficManager = new TrafficManager(tilemapEditor);
    if (spawnRateSlider) trafficManager.spawnRate = parseFloat(spawnRateSlider.value) / 100; // Convert to probability
    trafficManager.reset();
    // Place player car at first tile center with orientation east by default
    const firstKey = tilemapEditor.tiles.keys().next().value;
    if (firstKey) {
      const t = tilemapEditor.tiles.get(firstKey);
      const c = t.getCenter();
      car.x = c.x; car.y = c.y;
      // car angle from tile baseOrientationAngle (Cartesian) to car physics angle
      car.angle = t.baseOrientationAngle - Math.PI / 2;
      car.speed = 0; car.damaged = false;
    }
  }
});
editingBtn.addEventListener("click", () => {
  mode = "EDITING";
  editingBtn.classList.add("active");
  drivingBtn.classList.remove("active");
  traffic = [];
  trafficManager = null;
  // UI: show tile panel, hide car panel; show tile buttons/selection
  const tileInfo = document.getElementById("tile-info");
  const carInfo = document.getElementById("car-info");
  if (tileInfo) tileInfo.style.display = '';
  if (carInfo) carInfo.style.display = 'none';
  tilemapEditor.showButtons = true;
  tilemapEditor.showTileSelection = true;
  updateCarPropsUI(null);
});
resetBtn.addEventListener("click", resetCar);
function resetCar() {
  const newStartPose = road.getLaneStartPose(1);
  const offsetX =
    Math.sin(newStartPose.angle) * (carHeight / 2 + SPAWN_PADDING);
  const offsetY =
    -Math.cos(newStartPose.angle) * (carHeight / 2 + SPAWN_PADDING);
  car.x = newStartPose.x + offsetX;
  car.y = newStartPose.y + offsetY;
  car.angle = newStartPose.angle;
  car.speed = 0;
  car.damaged = false;
}

function updateMaxTraffic() {
  const roadLength = road.getLanePathLength(1);
  MAX_TRAFFIC = Math.max(0, Math.floor(roadLength / CAR_DENSITY));
}
updateMaxTraffic();

let isDragging = false;
let mouse = { x: 0, y: 0 };
let dragTarget = null;
const dragSmoothingFactor = 0.1;
const draggerSize = 20;
addEventListeners();
function addEventListeners() {
  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("mouseup", () => {
    isDragging = false;
    dragTarget = null;
  });
  canvas.addEventListener("contextmenu", (e) => e.preventDefault());
  // Zoom with wheel
  canvas.addEventListener("wheel", (e) => {
    const prevZoom = zoom;
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    zoom = Math.max(0.3, Math.min(1.5, zoom + delta));
    // Keep mouse position stable (simple recenter towards cursor)
    const rect = canvas.getBoundingClientRect();
    const mouseScreenX = e.clientX - rect.left;
    const mouseScreenY = e.clientY - rect.top;
    const cx = cameraTarget ? cameraTarget.x : 0;
    const cy = cameraTarget ? cameraTarget.y : 0;
    const worldBefore = { x: cx + (mouseScreenX - canvas.width / 2) / prevZoom, y: cy + (mouseScreenY - canvas.height / 2) / prevZoom };
    const worldAfter = { x: cx + (mouseScreenX - canvas.width / 2) / zoom, y: cy + (mouseScreenY - canvas.height / 2) / zoom };
    // Shift camera to keep world point under cursor approximately stationary
    if (cameraTarget && typeof cameraTarget.x === "number") {
      cameraTarget.x += worldBefore.x - worldAfter.x;
      cameraTarget.y += worldBefore.y - worldAfter.y;
    }
    e.preventDefault();
  }, { passive: false });
  // Middle mouse drag to pan when editing with network
  let panning = false;
  let panStart = { x: 0, y: 0 };
  let cameraStart = { x: 0, y: 0 };
  canvas.addEventListener("mousedown", (e) => {
    if (mode === "EDITING" && useNetwork && e.button === 1) {
      panning = true;
      panStart = { x: e.clientX, y: e.clientY };
      cameraStart = cameraTarget ? { x: cameraTarget.x, y: cameraTarget.y } : { x: 0, y: 0 };
      e.preventDefault();
    }
    if (mode === "EDITING" && useTilemap && e.button === 2) {
      const m = getMousePos(e);
      const removed = tilemapEditor.removeTileAtWorld(m.x, m.y);
      if (removed) {
        updateTilePropsUI();
      }
    }
    if (mode === "DRIVING" && useTilemap && e.button === 0 && trafficManager) {
      const m = getMousePos(e);
      const selected = trafficManager.selectCarAt(m.x, m.y);
      updateCarPropsUI(selected);
    }
  });
  window.addEventListener("mouseup", () => { panning = false; });
  window.addEventListener("mousemove", (e) => {
    if (panning && cameraTarget) {
      const dx = (e.clientX - panStart.x) / zoom;
      const dy = (e.clientY - panStart.y) / zoom;
      cameraTarget.x = cameraStart.x - dx;
      cameraTarget.y = cameraStart.y - dy;
    }
  });
}
function getMousePos(event) {
  const rect = canvas.getBoundingClientRect();
  const mouseScreenX = event.clientX - rect.left;
  const mouseScreenY = event.clientY - rect.top;
  const mouseCenterX = mouseScreenX - canvas.width / 2;
  const mouseCenterY = mouseScreenY - canvas.height / 2;
  const worldX = cameraTarget.x + mouseCenterX / zoom;
  const worldY = cameraTarget.y + mouseCenterY / zoom;
  return { x: worldX, y: worldY };
}
function handleMouseDown(event) {
  if (mode !== "EDITING") return;
  mouse = getMousePos(event);
  if (useTilemap) {
    const handled = tilemapEditor.handleClick(mouse.x, mouse.y);
    if (handled) {
      updateTilePropsUI();
      return;
    }
    // Select tile if clicking inside tile body (not on buttons)
    const selected = tilemapEditor.selectByWorld(mouse.x, mouse.y);
    if (selected) {
      updateTilePropsUI();
      return;
    }
  }
  if (useNetwork) {
    const handled = roadNetwork.handleClick(mouse.x, mouse.y);
    if (handled) return;
  }
  const lastPoint = road.points[road.points.length - 1];
  const dist = Math.hypot(mouse.x - lastPoint.x, mouse.y - lastPoint.y);
  if (dist < draggerSize / zoom) {
    if (event.button === 2) {
      road.addPoint(mouse.x, mouse.y);
      updateMaxTraffic();
    } else {
      isDragging = true;
      dragTarget = mouse;
    }
  }
}
function handleMouseMove(event) {
  mouse = getMousePos(event);
  if (!useNetwork && isDragging) {
    dragTarget = mouse;
  }
}

animate();

function animate() {
  // --- THIS IS THE CORRECTED STRUCTURE ---
  // ALWAYS update cars to calculate their state (polygons, sensors) for drawing.
  // The internal logic of car.update() already handles not moving them in EDIT mode.
  if (!useTilemap) {
    for (let i = 0; i < traffic.length; i++) {
      const lanePath = road.getLanePath(traffic[i].lane);
      traffic[i].update(road.borders, [...traffic, car], "DRIVING", lanePath);
    }
    car.update(road.borders, traffic, mode);
  }

  // Agent control in DRIVING mode (disabled when tilemap traffic is active)
  if (mode === "DRIVING" && !useTilemap) {
    const obs = obsBuilder.build(traffic, 1);
    const action = agent.act(obs, "NORMAL");
    const steer = AgentUtils.clamp(action.steer, -1, 1);
    const accel = AgentUtils.clamp(action.accel, -1, 1);
    car.controls.left = steer < -0.2;
    car.controls.right = steer > 0.2;
    car.controls.forward = accel > 0.05;
    car.controls.reverse = accel < -0.05;
  }

  // Only run spawning/despawning and other GAMEPLAY logic in DRIVING mode
  if (mode === "DRIVING" && !useTilemap) {
    traffic = traffic.filter((c) => !c.toRemove);
    if (traffic.length < MAX_TRAFFIC && Math.random() < TRAFFIC_SPAWN_RATE) {
      const laneIndex = Math.floor(Math.random() * road.laneCount);
      const spawnPose = road.getLaneStartPose(laneIndex);
      let spawnPointClear = true;
      for (let i = 0; i < traffic.length; i++) {
        const dist = Math.hypot(
          traffic[i].x - spawnPose.x,
          traffic[i].y - spawnPose.y
        );
        if (dist < SPAWN_SAFE_DISTANCE) {
          spawnPointClear = false;
          break;
        }
      }
      if (spawnPointClear) {
        const startOffset = carHeight / 2 + SPAWN_PADDING;
        const offsetX = Math.sin(spawnPose.angle) * startOffset;
        const offsetY = -Math.cos(spawnPose.angle) * startOffset;
        const newCar = new Car(
          spawnPose.x + offsetX,
          spawnPose.y + offsetY,
          30,
          carHeight,
          "DUMMY",
          2.0
        );
        newCar.angle = spawnPose.angle;
        newCar.lane = laneIndex;
        // Sample speed as a fraction of player max
        const minV = car.maxSpeed * TRAFFIC_SPEED_MIN_FACTOR;
        const maxV = car.maxSpeed * TRAFFIC_SPEED_MAX_FACTOR;
        const sampled = minV + Math.random() * (maxV - minV);
        newCar.speed = sampled;
        newCar.maxSpeed = sampled;
        newCar.pathProgress = startOffset;
        traffic.push(newCar);
      }
    }
  }

  if (!useTilemap && isDragging && dragTarget) {
    const lastPoint = road.points[road.points.length - 1];
    const newX = lerp(lastPoint.x, dragTarget.x, dragSmoothingFactor);
    const newY = lerp(lastPoint.y, dragTarget.y, dragSmoothingFactor);
    const newPos = { x: newX, y: newY };
    let angleIsValid = true;
    if (road.points.length >= 3) {
      const p_anchor = road.points[road.points.length - 2];
      const p_before_anchor = road.points[road.points.length - 3];
      const v1 = subtract(p_before_anchor, p_anchor);
      const v2 = subtract(newPos, p_anchor);
      const dotProduct = v1.x * v2.x + v1.y * v2.y;
      if (dotProduct > 0) {
        angleIsValid = false;
      }
    }
    if (angleIsValid) {
      road.moveLastPoint(newPos.x, newPos.y);
      updateMaxTraffic();
    }
  }

  if (mode === "DRIVING") {
    cameraTarget = car;
  } else if (useTilemap) {
    const bounds = tilemapEditor.getBounds();
    cameraTarget = {
      x: (bounds.minX + bounds.maxX) / 2,
      y: (bounds.minY + bounds.maxY) / 2
    };
    // snap to grid center for nicer panning baseline
  } else {
    cameraTarget = road.points[road.points.length - 1];
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cameraTarget.x, -cameraTarget.y);

  if (useTilemap) {
    tilemapEditor.draw(ctx);
  } else if (useNetwork && roadNetwork) {
    roadNetwork.draw(ctx);
  } else {
    road.draw(ctx);
  }
  if (mode === "DRIVING" && useTilemap && trafficManager) {
    // Update traffic manager with a fixed timestep approximation
    trafficManager.update(1); // dt ~ 1 frame units; speed scaled internally
    trafficManager.draw(ctx);
  }
  for (let i = 0; i < traffic.length; i++) {
    traffic[i].draw(ctx, "gray", showPolygonCheckbox.checked);
  }
  if (mode === "DRIVING" && !useTilemap) {
    car.draw(ctx, "blue", showPolygonCheckbox.checked);
  }

  if (mode === "EDITING" && !useTilemap) {
    const lastPoint = road.points[road.points.length - 1];
    ctx.beginPath();
    ctx.arc(lastPoint.x, lastPoint.y, draggerSize / zoom, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 0, 0.7)";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.5)";
    ctx.lineWidth = 3 / zoom;
    ctx.stroke();
  }

  ctx.restore();

  requestAnimationFrame(animate);
}
