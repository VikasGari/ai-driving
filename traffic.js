class PathUtils {
    static neighborsFor(tileEditor, gx, gy, allowed) {
        const dirs = [
            { key: 'top', dx: 0, dy: -1 },
            { key: 'right', dx: 1, dy: 0 },
            { key: 'bottom', dx: 0, dy: 1 },
            { key: 'left', dx: -1, dy: 0 },
        ];
        const res = [];
        for (const d of dirs) {
            const nk = tileEditor.getTileKey(gx + d.dx, gy + d.dy);
            if (!tileEditor.tiles.has(nk)) continue;
            if (allowed) {
                const edgeKey = `${gx},${gy}:${d.key}`;
                if (!allowed.has(edgeKey)) continue;
            }
            res.push({ dir: d.key, gx: gx + d.dx, gy: gy + d.dy, dx: d.dx, dy: d.dy });
        }
        return res;
    }

    static canvasCenterOf(tileEditor, gx, gy) {
        const t = tileEditor.tiles.get(tileEditor.getTileKey(gx, gy));
        return t ? t.getCenter() : null;
    }

    static buildSpawnPoints(tileEditor) {
        const spawns = [];
        for (const tile of tileEditor.tiles.values()) {
            const nbs = this.neighborsFor(tileEditor, tile.gridX, tile.gridY);
            if (nbs.length === 1) {
                spawns.push({ gx: tile.gridX, gy: tile.gridY, dir: nbs[0] });
            }
        }
        return spawns;
    }

    static turnPolyline(entry, pivot, exit, radius, segments = 6) {
        // entry, pivot, exit are canvas points, with entry->pivot and pivot->exit perpendicular
        const v1 = { x: pivot.x - entry.x, y: pivot.y - entry.y };
        const v2 = { x: exit.x - pivot.x, y: exit.y - pivot.y };
        const n1 = Math.hypot(v1.x, v1.y);
        const n2 = Math.hypot(v2.x, v2.y);
        if (n1 === 0 || n2 === 0) return [pivot];
        const u1 = { x: v1.x / n1, y: v1.y / n1 };
        const u2 = { x: v2.x / n2, y: v2.y / n2 };
        const p1 = { x: pivot.x - u1.x * radius, y: pivot.y - u1.y * radius };
        const p2 = { x: pivot.x + u2.x * radius, y: pivot.y + u2.y * radius };
        // compute arc center as intersection of lines perpendicular to u1 at p1 and to u2 at p2
        const nPerp1 = { x: -u1.y, y: u1.x };
        const nPerp2 = { x: -u2.y, y: u2.x };
        const center = PathUtils.lineIntersection(p1, { x: p1.x + nPerp1.x, y: p1.y + nPerp1.y }, p2, { x: p2.x + nPerp2.x, y: p2.y + nPerp2.y });
        if (!center) return [p1, pivot, p2];
        const a1 = Math.atan2(p1.y - center.y, p1.x - center.x);
        const a2 = Math.atan2(p2.y - center.y, p2.x - center.x);
        // choose shortest arc direction
        let delta = a2 - a1;
        if (delta > Math.PI) delta -= 2 * Math.PI;
        if (delta < -Math.PI) delta += 2 * Math.PI;
        const pts = [];
        for (let i = 0; i <= segments; i++) {
            const a = a1 + (delta * i) / segments;
            pts.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
        }
        return pts;
    }

    static lineIntersection(A, B, C, D) {
        const denom = (D.y - C.y) * (B.x - A.x) - (D.x - C.x) * (B.y - A.y);
        if (denom === 0) return null;
        const t = ((D.x - C.x) * (A.y - C.y) - (D.y - C.y) * (A.x - C.x)) / denom;
        return { x: A.x + t * (B.x - A.x), y: A.y + t * (B.y - A.y) };
    }
}

class TrafficCar {
    constructor(x, y, heading = 0, color = 'gray', width = 16, height = 36) {
        this.x = x; this.y = y; this.heading = heading;
        this.speed = 1.6 + Math.random() * 0.8;
        this.maxSpeed = this.speed * 1.1;
        this.width = width; this.height = height;
        this.path = [];
        this.segmentIndex = 0; // index into path points
        this.progress = 0; // 0..1 along current segment
        this.safeGap = 35;
        this.color = color;
        // diagnostics
        this.stopReason = 'none'; // none | car_ahead | path_end
        this.targetSpeed = this.maxSpeed;
        this.frontRay = Infinity;
        this.rearRay = Infinity;
        this.accelGain = 0.6; // responsiveness factor
        this.spawnAge = 0; // frames since spawn
        this.junctionCooldown = 0; // seconds until next junction re-route allowed
    }

    setPath(points) {
        this.path = points;
        this.segmentIndex = 0;
        this.progress = 0;
    }

    update(dt, others) {
        if (!this.path || this.path.length < 2) return;
        this.spawnAge += dt;
        if (this.junctionCooldown > 0) this.junctionCooldown -= dt;
        // compute forward direction of current segment
        const idx = this.segmentIndex;
        const pA = this.path[idx];
        const pB = this.path[idx + 1];
        const segLen = Math.hypot(pB.x - pA.x, pB.y - pA.y) || 1;
        const forward = { x: (pB.x - pA.x) / segLen, y: (pB.y - pA.y) / segLen };
        // raycast to other cars along forward/backward (projected distance)
        let front = Infinity;
        let rear = Infinity;
        for (const o of others) {
            if (o === this) continue;
            const ahead = { x: o.x - this.x, y: o.y - this.y };
            const proj = ahead.x * forward.x + ahead.y * forward.y; // signed distance along forward
            const lateral = Math.abs(ahead.x * (-forward.y) + ahead.y * forward.x);
            if (lateral < this.width) {
                if (proj > 0) front = Math.min(front, proj);
                if (proj < 0) rear = Math.min(rear, -proj);
            }
        }
        this.frontRay = front;
        this.rearRay = rear;

        const safeFront = this.safeGap;
        const safeRear = this.safeGap * 0.8;
        const slowTerm = isFinite(front) ? Math.max(0, (safeFront - front) / safeFront) : 0;
        const speedTerm = isFinite(rear) ? Math.max(0, (safeRear - rear) / safeRear) : 0;
        const accel = this.accelGain * (speedTerm - slowTerm);
        // integrate speed
        this.speed = Math.max(0, Math.min(this.maxSpeed, this.speed + accel * dt));
        this.targetSpeed = this.speed;
        this.stopReason = slowTerm > 0.5 && this.speed < 0.2 ? 'car_ahead' : 'none';
        let move = this.speed * dt;
        // advance along polyline, consuming move
        while (this.path && this.segmentIndex < this.path.length - 1 && move > 0) {
            const a = this.path[this.segmentIndex];
            const b = this.path[this.segmentIndex + 1];
            const segLen = Math.hypot(b.x - a.x, b.y - a.y);
            if (segLen === 0) { this.segmentIndex++; this.progress = 0; continue; }
            const remaining = segLen * (1 - this.progress);
            if (move < remaining) {
                const t = this.progress + move / segLen;
                this.x = a.x + (b.x - a.x) * t;
                this.y = a.y + (b.y - a.y) * t;
                this.heading = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
                this.progress = t;
                move = 0;
                break;
            } else {
                // move to next segment
                this.x = b.x; this.y = b.y;
                this.segmentIndex++;
                this.progress = 0;
                move -= remaining;
            }
        }
        if (this.segmentIndex >= this.path.length - 1) this.stopReason = 'path_end';
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.heading);
        ctx.fillStyle = this.color;
        ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);
        // draw rays (unit length scaled for visibility)
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // forward ray: from nose outward by 1 tile size unit
        ctx.moveTo(0, -this.height / 2);
        ctx.lineTo(0, -this.height / 2 - Math.min(60, Math.max(20, this.frontRay || 0)));
        ctx.stroke();
        // rear ray
        ctx.beginPath();
        ctx.moveTo(0, this.height / 2);
        ctx.lineTo(0, this.height / 2 + Math.min(60, Math.max(20, this.rearRay || 0)));
        ctx.stroke();
        ctx.restore();
    }
}

class TrafficManager {
    constructor(tileEditor) {
        this.tileEditor = tileEditor;
        this.cars = [];
        this.paths = []; // array of polyline paths from endpoints into the network
        this.tileSize = tileEditor.tileSize;
        this.turnRadius = this.tileSize * 0.35;
        this.maxCars = 20;
        this.minCars = 5;
        this.selectedCar = null;
        this.allowedEdges = new Set();
        this.travelDirections = new Map(); // Store travel direction for each segment
        this.seeded = false;
        this.spawnRate = 0.1; // probability per frame (0.1 = 10% chance per frame)

        // Segments: contiguous runs of non-turn tiles between turn tiles
        this.segments = []; // { id, tiles:Set<tileKey>, corners:Array<{gx,gy}> }
        this.tileKeyToSegmentId = new Map();
        this.segmentsDirty = true;
    }

    buildPaths() {
        this.buildDirectedEdges();
        this.paths = [];
        
        // Only build paths from base tile (single spawn point)
        if (this.tileEditor.baseKey) {
            const [bx, by] = this.tileEditor.baseKey.split(',').map(Number);
            const basePath = this.buildRandomWalkPath(bx, by, 60);
            if (basePath.length >= 3) {
                this.paths.push(basePath);
            }
        }

        // Build segments for dynamic routing and counting
        this.buildSegments();
    }

    buildDirectedEdges() {
        this.allowedEdges.clear();
        this.travelDirections = new Map(); // Store travel direction for each segment
        
        // BFS from base tile to establish one-way flow
        const baseKey = this.tileEditor.baseKey || this.tileEditor.getTileKey(0,0);
        const baseForward = this.tileEditor.baseForwardDir || 'right';
        const [bx, by] = baseKey.split(',').map(Number);
        const q = [{ gx: bx, gy: by, fromDir: null }];
        const visited = new Set([baseKey]);
        
        while (q.length) {
            const cur = q.shift();
            const nbs = PathUtils.neighborsFor(this.tileEditor, cur.gx, cur.gy);
            
            for (const n of nbs) {
                const nk = this.tileEditor.getTileKey(n.gx, n.gy);
                if (visited.has(nk)) continue;
                
                // Only allow forward direction from base tile
                if (cur.gx === bx && cur.gy === by) {
                    // Base tile: only allow the configured forward direction
                    if (n.dir === baseForward) {
                        const edgeKey = `${cur.gx},${cur.gy}:${n.dir}`;
                        this.allowedEdges.add(edgeKey);
                        this.travelDirections.set(edgeKey, 'forward');
                        visited.add(nk);
                        q.push({ gx: n.gx, gy: n.gy, fromDir: n.dir });
                    }
                } else {
                    // Other tiles: allow all directions except going back to parent
                    if (n.dir !== this.getOppositeDirection(cur.fromDir)) {
                        const edgeKey = `${cur.gx},${cur.gy}:${n.dir}`;
                        this.allowedEdges.add(edgeKey);
                        this.travelDirections.set(edgeKey, 'forward');
                        visited.add(nk);
                        q.push({ gx: n.gx, gy: n.gy, fromDir: n.dir });
                    }
                }
            }
        }
    }
    
    getOppositeDirection(dir) {
        const opposites = { 'top': 'bottom', 'bottom': 'top', 'left': 'right', 'right': 'left' };
        return opposites[dir] || null;
    }

    buildRandomWalkPath(startGx, startGy, maxSteps = 60) {
        const pts = [];
        let prev = null;
        let gx = startGx, gy = startGy;
        const center0 = PathUtils.canvasCenterOf(this.tileEditor, gx, gy);
        if (!center0) return pts;
        pts.push(center0);
        for (let step = 0; step < maxSteps; step++) {
            const nbs = PathUtils.neighborsFor(this.tileEditor, gx, gy, this.allowedEdges).filter(n => !prev || !(n.gx === prev.gx && n.gy === prev.gy));
            if (nbs.length === 0) break;
            const n = nbs[Math.floor(Math.random() * nbs.length)];
            const nextC = PathUtils.canvasCenterOf(this.tileEditor, n.gx, n.gy);
            const curC = PathUtils.canvasCenterOf(this.tileEditor, gx, gy);
            if (!nextC || !curC) break;
            // Always push centers (no arc smoothing), so junction tiles appear explicitly
            pts.push(nextC);
            prev = { gx, gy };
            gx = n.gx; gy = n.gy;
        }
        // Validate path has minimum distance (at least 3 tiles worth)
        if (pts.length < 3) return [];
        let totalDist = 0;
        for (let i = 1; i < pts.length; i++) {
            totalDist += Math.hypot(pts[i].x - pts[i-1].x, pts[i].y - pts[i-1].y);
        }
        if (totalDist < this.tileSize * 2.5) return [];
        return pts;
    }

    reset() {
        this.cars = [];
        this.buildPaths();
        this.computeCarCountTargets();
        this.spawnCooldown = 0;
        // initial seeding across network
        if (!this.seeded) {
            // Only seed if we have valid paths
            if (this.paths.length > 0) {
                const keys = Array.from(this.tileEditor.tiles.keys());
                for (let i = 0; i < keys.length; i++) {
                    if (Math.random() < 0.35 && this.cars.length < this.maxCars) {
                        this.trySpawnSafe();
                    }
                }
            }
            this.seeded = true;
        }
    }

    computeCarCountTargets() {
        const tilesCount = this.tileEditor.tiles.size;
        // Desired range: [0.5 * tiles, 0.75 * tiles]
        const min = Math.floor(0.5 * tilesCount);
        const max = Math.ceil(0.75 * tilesCount);
        this.minCars = Math.max(0, min);
        this.maxCars = Math.max(this.minCars, max);
    }

    spawnCar() {
        if (this.paths.length === 0) return false;
        
        // Only spawn from base tile
        const baseKey = this.tileEditor.baseKey;
        if (!baseKey) return false;
        
        const path = this.paths[0]; // Only one path from base tile
        if (!path || path.length < 3) return false;
        
        const a = path[0], b = path[1];
        const heading = Math.atan2(b.y - a.y, b.x - a.x) + Math.PI / 2;
        const carW = Math.max(8, Math.floor(this.tileSize / 4.5));
        const carH = Math.max(12, Math.floor(carW * 1.5));
        const hue = Math.floor(Math.random() * 360);
        const color = `hsl(${hue}, 65%, 55%)`;
        const car = new TrafficCar(a.x, a.y, heading, color, carW, carH);
        car.setPath(path);
        this.cars.push(car);
        console.log('[spawn]', { pos: { x: car.x.toFixed(1), y: car.y.toFixed(1) } });
        return true;
    }

    update(dt) {
        // Simple spawning: try to spawn if under max cars
        if (this.cars.length < this.maxCars && Math.random() < this.spawnRate) {
            this.spawnCar();
        }
        
        // Update all cars
        for (const c of this.cars) {
            c.update(dt, this.cars);
        }
        
        // Build edge occupancy counts for dynamic splitting
        const edgeCount = new Map(); // key: "gx,gy:dir" -> count
        const centerToGrid = (pt) => {
            const gx = Math.round((pt.x - this.tileSize / 2) / this.tileSize);
            const gy = Math.round((pt.y - this.tileSize / 2) / this.tileSize);
            return { gx, gy };
        };
        const dirFromDelta = (dx, dy) => {
            if (dx === 0 && dy === -1) return 'top';
            if (dx === 1 && dy === 0) return 'right';
            if (dx === 0 && dy === 1) return 'bottom';
            if (dx === -1 && dy === 0) return 'left';
            return null;
        };
        for (const c of this.cars) {
            if (!c.path || c.segmentIndex >= c.path.length - 1) continue;
            const a = c.path[c.segmentIndex];
            const b = c.path[c.segmentIndex + 1];
            // Determine grid edge if a and b are tile centers
            const ga = centerToGrid(a);
            const gb = centerToGrid(b);
            const dx = gb.gx - ga.gx;
            const dy = gb.gy - ga.gy;
            const dir = dirFromDelta(dx, dy);
            if (dir) {
                const key = `${ga.gx},${ga.gy}:${dir}`;
                edgeCount.set(key, (edgeCount.get(key) || 0) + 1);
            }
        }

        // Dynamic routing at intersections: when the car ARRIVES at a junction center, choose least-loaded outgoing
        const segmentCounts = this.countCarsPerSegment();
        const atPoint = (car, pt) => Math.hypot(car.x - pt.x, car.y - pt.y) <= Math.max(4, this.tileSize * 0.1);
        for (const car of this.cars) {
            if (!car.path || car.segmentIndex >= car.path.length) continue;
            const curPt = car.path[car.segmentIndex];
            const curGrid = centerToGrid(curPt);
            const tKey = this.tileEditor.getTileKey(curGrid.gx, curGrid.gy);
            const t = this.tileEditor.tiles.get(tKey);
            if (!t || !t.isTurn) continue;
            // Only reroute once the car is actually at the junction center
            if (!atPoint(car, curPt)) continue;
            // Avoid re-routing loop: require cooldown
            if (car.junctionCooldown > 0) continue;
            // Determine where we came from to avoid U-turns
            let fromGrid = null;
            if (car.segmentIndex > 0) {
                const prevPt = car.path[car.segmentIndex - 1];
                fromGrid = centerToGrid(prevPt);
            }
            // Outgoing options from the junction to non-turn tiles
            const outNbs = PathUtils.neighborsFor(this.tileEditor, curGrid.gx, curGrid.gy, this.allowedEdges)
                .filter(n => !(fromGrid && n.gx === fromGrid.gx && n.gy === fromGrid.gy))
                .filter(n => {
                    const nk = this.tileEditor.getTileKey(n.gx, n.gy);
                    const nt = this.tileEditor.tiles.get(nk);
                    return nt && !nt.isTurn;
                });
            if (outNbs.length === 0) continue;
            // Choose the least populated segment
            let best = null; let bestCnt = Infinity;
            for (const n of outNbs) {
                const segId = this.tileKeyToSegmentId.get(this.tileEditor.getTileKey(n.gx, n.gy));
                const cnt = segId != null ? (segmentCounts.get(segId) || 0) : 0;
                if (cnt < bestCnt) { bestCnt = cnt; best = n; }
            }
            if (best) {
                const nextCenter = PathUtils.canvasCenterOf(this.tileEditor, best.gx, best.gy);
                if (nextCenter) {
                    // If we already plan to go there, do nothing
                    const hasNext = car.segmentIndex + 1 < car.path.length ? car.path[car.segmentIndex + 1] : null;
                    const sameNext = hasNext && Math.hypot(hasNext.x - nextCenter.x, hasNext.y - nextCenter.y) < 1e-3;
                    if (!sameNext) {
                        // Replace remainder of path: stay at current junction center then go into chosen segment
                        car.path = [curPt, nextCenter];
                        car.segmentIndex = 0;
                        car.progress = 0;
                    }
                    car.junctionCooldown = 0.6; // small delay before allowing another reroute
                }
            }
        }

        // On path end, attempt to extend forward; only remove if truly no continuation
        for (const car of this.cars) {
            if (!car.path) continue;
            if (car.segmentIndex < car.path.length - 1) continue;
            const last = car.path[car.path.length - 1];
            if (!last) continue;
            const { gx, gy } = centerToGrid(last);
            const lastTile = this.tileEditor.tiles.get(this.tileEditor.getTileKey(gx, gy));
            if (!lastTile) continue;
            // If we are on a segment tile, try to continue towards the next tile along allowed edges
            const prev = car.path.length >= 2 ? car.path[car.path.length - 2] : null;
            let extended = false;
            if (prev) {
                const gp = centerToGrid(prev);
                // neighbors from current tile within allowed edges
                const nbs = PathUtils.neighborsFor(this.tileEditor, gx, gy, this.allowedEdges) || [];
                // prefer continuing direction (avoid going back to prev)
                const candidates = nbs.filter(n => !(n.gx === gp.gx && n.gy === gp.gy));
                // If next is a junction, choose least-populated outgoing after passing through junction
                if (candidates.length > 0) {
                    // Sort to prefer non-turn tiles first
                    const nonTurn = candidates.filter(n => {
                        const t = this.tileEditor.tiles.get(this.tileEditor.getTileKey(n.gx, n.gy));
                        return t && !t.isTurn;
                    });
                    const turnTiles = candidates.filter(n => {
                        const t = this.tileEditor.tiles.get(this.tileEditor.getTileKey(n.gx, n.gy));
                        return t && t.isTurn;
                    });
                    if (nonTurn.length > 0) {
                        const n = nonTurn[0];
                        const nc = PathUtils.canvasCenterOf(this.tileEditor, n.gx, n.gy);
                        if (nc) {
                            car.path.push(nc);
                            extended = true;
                        }
                    } else if (turnTiles.length > 0) {
                        // Go to junction center, then choose least-populated outgoing segment
                        const j = turnTiles[0];
                        const jc = PathUtils.canvasCenterOf(this.tileEditor, j.gx, j.gy);
                        if (jc) {
                            // choose outgoing from junction
                            const outNbs = PathUtils.neighborsFor(this.tileEditor, j.gx, j.gy, this.allowedEdges)
                                .filter(n => !(n.gx === gx && n.gy === gy))
                                .filter(n => {
                                    const t = this.tileEditor.tiles.get(this.tileEditor.getTileKey(n.gx, n.gy));
                                    return t && !t.isTurn;
                                });
                            if (outNbs.length > 0) {
                                let best = null; let bestCnt = Infinity;
                                for (const n of outNbs) {
                                    const segId = this.tileKeyToSegmentId.get(this.tileEditor.getTileKey(n.gx, n.gy));
                                    const cnt = segId != null ? (segmentCounts.get(segId) || 0) : 0;
                                    if (cnt < bestCnt) { bestCnt = cnt; best = n; }
                                }
                                if (best) {
                                    const nc2 = PathUtils.canvasCenterOf(this.tileEditor, best.gx, best.gy);
                                    if (nc2) {
                                        car.path.push(jc, nc2);
                                        extended = true;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            // If could not extend, flag for removal by keeping path as-is (end reached)
        }
        this.cars = this.cars.filter(c => c.segmentIndex < (c.path.length - 1));
        
        // Remove colliding cars
        const n = this.cars.length;
        const toRemove = new Array(n).fill(false);
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                const a = this.cars[i], b = this.cars[j];
                const dx = a.x - b.x, dy = a.y - b.y;
                const dist = Math.hypot(dx, dy);
                const ra = Math.max(a.width, a.height) * 0.5;
                const rb = Math.max(b.width, b.height) * 0.5;
                if (dist < ra + rb) {
                    toRemove[i] = true; toRemove[j] = true;
                }
            }
        }
        if (toRemove.some(v => v)) {
            this.cars = this.cars.filter((_, idx) => !toRemove[idx]);
        }
    }


    draw(ctx) {
        // Draw direction arrows on segments
        this.drawDirectionArrows(ctx);
        // Draw floating text: number of segments
        this.drawSegmentsHud(ctx);
        
        // Draw cars
        for (const c of this.cars) c.draw(ctx);
        
        // Draw selected car highlight
        if (this.selectedCar) {
            ctx.save();
            ctx.strokeStyle = '#ff9800';
            ctx.lineWidth = 2;
            ctx.setLineDash([6, 4]);
            ctx.beginPath();
            ctx.arc(this.selectedCar.x, this.selectedCar.y, this.tileSize * 0.4, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }
    }
    
    drawDirectionArrows(ctx) {
        ctx.save();
        ctx.strokeStyle = '#00ff00';
        ctx.fillStyle = '#00ff00';
        ctx.lineWidth = 3;
        
        for (const [edgeKey, direction] of this.travelDirections) {
            const [from, to] = edgeKey.split(':');
            const [fx, fy] = from.split(',').map(Number);
            const dir = to;
            
            // Get tile centers
            const fromCenter = PathUtils.canvasCenterOf(this.tileEditor, fx, fy);
            if (!fromCenter) continue;
            
            // Calculate arrow position and direction
            let arrowX, arrowY, arrowAngle;
            const arrowSize = this.tileSize * 0.15;
            
            switch (dir) {
                case 'top':
                    arrowX = fromCenter.x;
                    arrowY = fromCenter.y - this.tileSize * 0.3;
                    arrowAngle = -Math.PI / 2;
                    break;
                case 'right':
                    arrowX = fromCenter.x + this.tileSize * 0.3;
                    arrowY = fromCenter.y;
                    arrowAngle = 0;
                    break;
                case 'bottom':
                    arrowX = fromCenter.x;
                    arrowY = fromCenter.y + this.tileSize * 0.3;
                    arrowAngle = Math.PI / 2;
                    break;
                case 'left':
                    arrowX = fromCenter.x - this.tileSize * 0.3;
                    arrowY = fromCenter.y;
                    arrowAngle = Math.PI;
                    break;
                default:
                    continue;
            }
            
            // Draw arrow
            ctx.save();
            ctx.translate(arrowX, arrowY);
            ctx.rotate(arrowAngle);
            
            // Arrow body
            ctx.beginPath();
            ctx.moveTo(-arrowSize, 0);
            ctx.lineTo(arrowSize, 0);
            ctx.stroke();
            
            // Arrow head
            ctx.beginPath();
            ctx.moveTo(arrowSize, 0);
            ctx.lineTo(arrowSize * 0.6, -arrowSize * 0.4);
            ctx.lineTo(arrowSize * 0.6, arrowSize * 0.4);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
        }
        
        ctx.restore();
    }

    // Build segments as connected components of non-turn tiles, bounded by turn tiles
    buildSegments() {
        this.segments = [];
        this.tileKeyToSegmentId.clear();
        const visited = new Set();
        const dirs = [
            { key: 'top', dx: 0, dy: -1 },
            { key: 'right', dx: 1, dy: 0 },
            { key: 'bottom', dx: 0, dy: 1 },
            { key: 'left', dx: -1, dy: 0 }
        ];
        for (const [key, tile] of this.tileEditor.tiles) {
            if (tile.isTurn) continue; // junctions are not segments
            if (visited.has(key)) continue;
            // BFS to collect contiguous non-turn tiles
            const segId = this.segments.length;
            const segTiles = new Set();
            const corners = [];
            const q = [key];
            visited.add(key);
            segTiles.add(key);
            while (q.length) {
                const k = q.shift();
                const [gx, gy] = k.split(',').map(Number);
                for (const d of dirs) {
                    const nk = this.tileEditor.getTileKey(gx + d.dx, gy + d.dy);
                    const nt = this.tileEditor.tiles.get(nk);
                    if (!nt) continue;
                    if (nt.isTurn) {
                        // Boundary between segment and junction; record as corner
                        corners.push({ gx, gy });
                        continue;
                    }
                    if (!visited.has(nk)) {
                        visited.add(nk);
                        segTiles.add(nk);
                        q.push(nk);
                    }
                }
            }
            // Map tiles to segment id
            for (const tk of segTiles) this.tileKeyToSegmentId.set(tk, segId);
            this.segments.push({ id: segId, tiles: segTiles, corners });
        }
        this.segmentsDirty = false;
    }

    // Count cars per segment using car positions -> nearest tile -> segment id
    countCarsPerSegment() {
        const counts = new Map();
        for (const c of this.cars) {
            const gx = Math.round((c.x - this.tileSize / 2) / this.tileSize);
            const gy = Math.round((c.y - this.tileSize / 2) / this.tileSize);
            const tk = this.tileEditor.getTileKey(gx, gy);
            const segId = this.tileKeyToSegmentId.get(tk);
            if (segId != null) counts.set(segId, (counts.get(segId) || 0) + 1);
        }
        return counts;
    }

    drawSegmentsHud(ctx) {
        ctx.save();
        ctx.resetTransform();
        ctx.font = '14px Arial';
        ctx.fillStyle = '#111';
        const pad = 8;
        const text = `Segments: ${this.segments.length}`;
        ctx.fillText(text, pad, 22);
        ctx.restore();
    }

    selectCarAt(x, y) {
        let best = null, bestD = Infinity;
        for (const c of this.cars) {
            const d = Math.hypot(c.x - x, c.y - y);
            if (d < bestD) { bestD = d; best = c; }
        }
        if (best && bestD <= this.tileSize * 0.6) {
            this.selectedCar = best;
            return best;
        }
        this.selectedCar = null;
        return null;
    }
}


