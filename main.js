const canvasContainer = document.getElementById("canvas-container");
const canvas = document.getElementById("simulationCanvas");
const ctx = canvas.getContext("2d");

// UPDATED: Zoom is now a variable that can be changed.
let zoom = 0.7;
let cameraTarget = null; 

function resizeCanvas() { canvas.width = canvasContainer.offsetWidth; canvas.height = canvasContainer.offsetHeight; }
window.addEventListener('resize', resizeCanvas);
resizeCanvas(); 

let mode = "EDITING";

// UPDATED: Road width is now increased to 150.
const road = new Road(canvas.width / 2, 150, 3); 

const startPose = road.getStartPose();
const car = new Car(startPose.x, startPose.y, 30, 50, "PLAYER");
car.angle = startPose.angle;
const trafficStartPos = road.getLaneCenter(0);
const traffic = [new Car(trafficStartPos.x, trafficStartPos.y - 200, 30, 50, "DUMMY", 2)];

const showPolygonCheckbox = document.getElementById("showPolygon");
const drivingBtn = document.getElementById("drivingBtn");
const editingBtn = document.getElementById("editingBtn");
const resetBtn = document.getElementById("resetBtn");
// NEW: Get the zoom slider element
const zoomSlider = document.getElementById("zoomSlider");
zoomSlider.value = zoom; // Set initial value

// NEW: Event listener for the zoom slider
zoomSlider.addEventListener("input", (event) => {
    zoom = parseFloat(event.target.value);
});

drivingBtn.addEventListener("click", () => { mode = "DRIVING"; drivingBtn.classList.add("active"); editingBtn.classList.remove("active"); });
editingBtn.addEventListener("click", () => { mode = "EDITING"; editingBtn.classList.add("active"); drivingBtn.classList.remove("active"); });
resetBtn.addEventListener("click", resetCar);

function resetCar() {
    const newStartPose = road.getStartPose();
    car.x = newStartPose.x;
    car.y = newStartPose.y;
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
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseup', () => { isDragging = false; dragTarget = null; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
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
        if (event.button === 2) { road.addPoint(mouse.x, mouse.y); } 
        else { isDragging = true; dragTarget = mouse; }
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
    // 1. Update object states
    for (let i = 0; i < traffic.length; i++) {
        traffic[i].update(road.borders, []);
    }
    car.update(road.borders, traffic, mode);
    
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

    // 2. Determine the camera's target
    if (mode === "DRIVING") {
        cameraTarget = car;
    } else {
        cameraTarget = road.points[road.points.length - 1];
    }

    // 3. Apply camera transformations
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.scale(zoom, zoom);
    ctx.translate(-cameraTarget.x, -cameraTarget.y);

    // 4. Draw all world objects
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