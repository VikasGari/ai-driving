// Linear interpolation function
function lerp(A, B, t) {
    return A + (B - A) * t;
}

// Function to get the intersection point of two line segments
function getIntersection(A, B, C, D) {
    // ... (rest of the function is the same)
    const tTop = (D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x);
    const uTop = (C.y - A.y) * (A.x - B.x) - (C.x - A.x) * (A.y - B.y);
    const bottom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);

    if (bottom != 0) {
        const t = tTop / bottom;
        const u = uTop / bottom;
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                x: lerp(A.x, B.x, t),
                y: lerp(A.y, B.y, t),
                offset: t
            };
        }
    }
    return null;
}

// --- NEW: Vector Math Helpers ---
function subtract(p1, p2) {
    return { x: p1.x - p2.x, y: p1.y - p2.y };
}

function add(p1, p2) {
    return { x: p1.x + p2.x, y: p1.y + p2.y };
}

function scale(p, scaler) {
    return { x: p.x * scaler, y: p.y * scaler };
}

function normalize(p) {
    const mag = Math.hypot(p.x, p.y);
    return mag === 0 ? p : scale(p, 1 / mag);
}