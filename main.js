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

let traffic = [];
const MAX_TRAFFIC = 10;
const TRAFFIC_SPAWN_RATE = 0.02;
const TRAFFIC_SPEED = 2.0;

const showPolygonCheckbox = document.getElementById("showPolygon");
const drivingBtn = document.getElementById("drivingBtn");
const editingBtn = document.getElementById("editingBtn");
const resetBtn = document.getElementById("resetBtn");
const zoomSlider = document.getElementById("zoomSlider");
zoomSlider.value = zoom;
zoomSlider.addEventListener("input", (event) => {
  zoom = parseFloat(event.target.value);
});
drivingBtn.addEventListener("click", () => {
  mode = "DRIVING";
  drivingBtn.classList.add("active");
  editingBtn.classList.remove("active");
});
editingBtn.addEventListener("click", () => {
  mode = "EDITING";
  editingBtn.classList.add("active");
  drivingBtn.classList.remove("active");
  traffic = [];
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
  const lastPoint = road.points[road.points.length - 1];
  const dist = Math.hypot(mouse.x - lastPoint.x, mouse.y - lastPoint.y);
  if (dist < draggerSize / zoom) {
    if (event.button === 2) {
      road.addPoint(mouse.x, mouse.y);
    } else {
      isDragging = true;
      dragTarget = mouse;
    }
  }
}
function handleMouseMove(event) {
  mouse = getMousePos(event);
  if (isDragging) {
    dragTarget = mouse;
  }
}

animate();

function animate() {
  for (let i = 0; i < traffic.length; i++) {
    const lanePath = road.getLanePath(traffic[i].lane);
    traffic[i].update(road.borders, traffic, "DRIVING", lanePath);
  }
  car.update(road.borders, traffic, mode);

  if (mode === "DRIVING") {
    traffic = traffic.filter((c) => !c.toRemove);
    if (traffic.length < MAX_TRAFFIC && Math.random() < TRAFFIC_SPAWN_RATE) {
      const laneIndex = Math.floor(Math.random() * road.laneCount);
      const spawnPose = road.getLaneStartPose(laneIndex);

      // --- THIS IS THE CORRECTED SPAWNING LOGIC ---
      const startOffset = carHeight / 2 + SPAWN_PADDING;
      const offsetX = Math.sin(spawnPose.angle) * startOffset;
      const offsetY = -Math.cos(spawnPose.angle) * startOffset;

      const newCar = new Car(
        spawnPose.x + offsetX,
        spawnPose.y + offsetY,
        30,
        carHeight,
        "DUMMY",
        TRAFFIC_SPEED
      );
      newCar.angle = spawnPose.angle;
      newCar.lane = laneIndex;
      newCar.speed = TRAFFIC_SPEED;
      // Set the initial progress to match the padded offset
      newCar.pathProgress = startOffset;
      traffic.push(newCar);
      // ---------------------------------------------
    }
  }

  if (isDragging && dragTarget) {
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
    }
  }

  if (mode === "DRIVING") {
    cameraTarget = car;
  } else {
    cameraTarget = road.points[road.points.length - 1];
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-cameraTarget.x, -cameraTarget.y);

  road.draw(ctx);
  for (let i = 0; i < traffic.length; i++) {
    traffic[i].draw(ctx, "gray", showPolygonCheckbox.checked);
  }
  car.draw(ctx, "blue", showPolygonCheckbox.checked);

  if (mode === "EDITING") {
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
