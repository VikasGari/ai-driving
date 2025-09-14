class Road {
    constructor(x, width, laneCount = 3) {
        this.width = width;
        this.laneCount = laneCount;
        this.points = [ { x: x, y: 500 }, { x: x, y: 100 } ];

        this.path = []; // The center path, for reference
        this.roadPolygon = [];
        this.borders = [];
        this.#generateRoad();
    }

    addPoint(x, y) {
        this.points.push({ x, y });
        this.#generateRoad();
    }

    moveLastPoint(x, y) {
        if (this.points.length > 0) {
            this.points[this.points.length - 1] = { x, y };
            this.#generateRoad();
        }
    }

    getStartPose() {
        const laneIndex = 1;
        const startPos = this.getLaneCenter(laneIndex);
        if (this.path.length < 2) {
            return { x: startPos.x, y: startPos.y, angle: -Math.PI / 2 };
        }
        const p1 = this.path[0];
        const p2 = this.path[1];
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) - Math.PI / 2;
        return { x: startPos.x, y: startPos.y, angle: angle };
    }

    #generateRoad() {
        const { left, right } = this.#generateSplineControlPoints(this.points);
        const leftBorder = this.#generateSplinePath(left, 15);
        const rightBorder = this.#generateSplinePath(right, 15);
        this.path = this.#generateSplinePath(this.points, 15);

        this.borders = [leftBorder, rightBorder];
        this.roadPolygon = [...rightBorder, ...leftBorder.reverse()];
    }

    #generateSplineControlPoints(points) {
        const left = [];
        const right = [];
        for (let i = 0; i < points.length; i++) {
            const p = points[i];
            const prev = points[i - 1];
            const next = points[i + 1];

            let tangent;
            if (prev && next) {
                const dirToPrev = normalize(subtract(p, prev));
                const dirToNext = normalize(subtract(next, p));
                tangent = normalize(add(dirToPrev, dirToNext));
            } else if (next) {
                tangent = normalize(subtract(next, p));
            } else if (prev) {
                tangent = normalize(subtract(p, prev));
            }

            const perp = { x: -tangent.y, y: tangent.x };
            left.push(add(p, scale(perp, this.width / 2)));
            right.push(add(p, scale(perp, -this.width / 2)));
        }
        return { left, right };
    }

    #generateSplinePath(points, segmentsPerCurve) {
        if (points.length < 2) return points;
        
        const splinePoints = [];
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i > 0 ? i - 1 : 0];
            const p1 = points[i];
            const p2 = points[i + 1];
            // --- THIS IS THE CORRECTED LINE ---
            // It correctly handles the end of the curve by duplicating the last point.
            const p3 = (i + 1 >= points.length - 1) ? p2 : points[i + 2];
            // ------------------------------------

            for (let j = 0; j < segmentsPerCurve; j++) {
                const t = j / segmentsPerCurve;
                const point = this.#catmullRom(p0, p1, p2, p3, t);
                splinePoints.push(point);
            }
        }
        splinePoints.push(points[points.length-1]);
        return splinePoints;
    }

    #catmullRom(p0, p1, p2, p3, t) {
        const t2 = t * t;
        const t3 = t2 * t;
        const x = 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
        const y = 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
        return { x, y };
    }

    getLaneCenter(laneIndex) {
        const laneWidth = this.width / this.laneCount;
        const offset = lerp(-this.width / 2 + laneWidth / 2, this.width / 2 - laneWidth / 2, this.laneCount > 1 ? laneIndex / (this.laneCount - 1) : 0.5);
        const p1 = this.points[0];
        const p2 = this.points[1];
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        return {
            x: p1.x + Math.cos(angle - Math.PI / 2) * offset,
            y: p1.y + Math.sin(angle - Math.PI / 2) * offset
        };
    }

    draw(ctx) {
        ctx.fillStyle = "#777";
        ctx.beginPath();
        if (this.roadPolygon.length > 0) {
            ctx.moveTo(this.roadPolygon[0].x, this.roadPolygon[0].y);
            for (let i = 1; i < this.roadPolygon.length; i++) {
                ctx.lineTo(this.roadPolygon[i].x, this.roadPolygon[i].y);
            }
        }
        ctx.fill();

        ctx.setLineDash([20, 20]);
        ctx.strokeStyle = "white";
        ctx.lineWidth = 5;
        for (let i = 1; i < this.laneCount; i++) {
            const offset = lerp(-this.width / 2, this.width / 2, i / this.laneCount);
            const lanePoints = [];
            for (let j = 0; j < this.path.length; j++) {
                const prev = this.path[j-1] || this.path[j];
                const next = this.path[j+1] || this.path[j];
                const dir = normalize(subtract(next,prev));
                const perp = {x:-dir.y, y:dir.x};
                lanePoints.push(add(this.path[j], scale(perp,offset)));
            }
            ctx.beginPath();
            if(lanePoints.length > 0){
                ctx.moveTo(lanePoints[0].x, lanePoints[0].y);
                for (let j = 1; j < lanePoints.length; j++) {
                    ctx.lineTo(lanePoints[j].x, lanePoints[j].y);
                }
            }
            ctx.stroke();
        }

        ctx.setLineDash([]);
        this.borders.forEach(border => {
            ctx.beginPath();
            ctx.moveTo(border[0].x, border[0].y);
            for (let i = 1; i < border.length; i++) {
                ctx.lineTo(border[i].x, border[i].y);
            }
            ctx.stroke();
        });
    }
}