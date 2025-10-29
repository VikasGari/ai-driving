class Road {
  constructor(x, width, laneCount = 3) {
    this.width = width;
    this.laneCount = laneCount;
    this.points = [
      { x: x, y: 500 },
      { x: x, y: 100 },
    ];
    this.centerline = [];
    this.roadPolygon = [];
    this.borders = [];
    this.lanePaths = [];
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
  getLaneStartPose(laneIndex) {
    const startPos = this.getLaneCenter(laneIndex);
    if (this.lanePaths.length === 0 || this.lanePaths[laneIndex].length < 2) {
      return { x: startPos.x, y: startPos.y, angle: -Math.PI / 2 };
    }
    const p1 = this.lanePaths[laneIndex][0];
    const p2 = this.lanePaths[laneIndex][1];
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) + Math.PI / 2;
    return { x: startPos.x, y: startPos.y, angle: angle };
  }
  getLanePath(laneIndex) {
    return this.lanePaths[laneIndex];
  }

  // --- THIS IS THE MISSING FUNCTION, NOW RESTORED ---
  getLanePathLength(laneIndex) {
    const path = this.lanePaths[laneIndex];
    if (!path || path.length < 2) return 0;
    let length = 0;
    for (let i = 1; i < path.length; i++) {
      length += Math.hypot(
        path[i].x - path[i - 1].x,
        path[i].y - path[i - 1].y
      );
    }
    return length;
  }
  // --------------------------------------------------------

  #generateRoad() {
    // 1) Build a high-resolution centerline from the control points
    const centerlinePath = this.#generateSplinePath(this.points, 15);
    this.centerline = centerlinePath;

    if (centerlinePath.length < 2) {
      this.borders = [];
      this.lanePaths = [];
      this.roadPolygon = [];
      return;
    }

    // 2) Compute per-point normals for Frenet offsets
    const normals = [];
    for (let i = 0; i < centerlinePath.length; i++) {
      const pPrev = centerlinePath[Math.max(0, i - 1)];
      const pNext = centerlinePath[Math.min(centerlinePath.length - 1, i + 1)];
      const tangent = normalize(subtract(pNext, pPrev));
      const normal = { x: -tangent.y, y: tangent.x };
      normals.push(normalize(normal));
    }

    // 3) Generate borders by offsetting centerline
    const halfWidth = this.width / 2;
    const leftBorder = [];
    const rightBorder = [];
    for (let i = 0; i < centerlinePath.length; i++) {
      const p = centerlinePath[i];
      const n = normals[i];
      leftBorder.push(add(p, scale(n, halfWidth)));
      rightBorder.push(add(p, scale(n, -halfWidth)));
    }

    this.borders = [leftBorder, rightBorder];

    // 4) Generate lane center paths by offsets
    this.lanePaths = [];
    for (let i = 0; i < this.laneCount; i++) {
      const laneWidth = this.width / this.laneCount;
      const lateralOffset = lerp(
        -this.width / 2 + laneWidth / 2,
        this.width / 2 - laneWidth / 2,
        this.laneCount > 1 ? i / (this.laneCount - 1) : 0.5
      );
      const lanePath = [];
      for (let j = 0; j < centerlinePath.length; j++) {
        lanePath.push(add(centerlinePath[j], scale(normals[j], lateralOffset)));
      }
      this.lanePaths.push(lanePath);
    }

    // 5) Road polygon for fill
    this.roadPolygon = [...rightBorder, ...leftBorder.slice().reverse()];
  }

  #generateSplineControlPoints(points, offset) {
    const controlPoints = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i];
      const prev = points[i - 1];
      const next = points[i + 1];
      let tangent;
      if (prev && next) {
        tangent = normalize(
          add(normalize(subtract(p, prev)), normalize(subtract(next, p)))
        );
      } else if (next) {
        tangent = normalize(subtract(next, p));
      } else if (prev) {
        tangent = normalize(subtract(p, prev));
      }
      const perp = { x: -tangent.y, y: tangent.x };
      controlPoints.push(add(p, scale(perp, offset)));
    }
    return { left: controlPoints, right: controlPoints };
  }

  #generateSplinePath(points, segmentsPerCurve) {
    if (points.length < 2) return points;
    const splinePoints = [];
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i > 0 ? i - 1 : 0];
      const p1 = points[i];
      const p2 = points[i + 1];
      const p3 = i + 1 >= points.length - 1 ? p2 : points[i + 2];
      for (let j = 0; j < segmentsPerCurve; j++) {
        const t = j / segmentsPerCurve;
        const point = this.#catmullRom(p0, p1, p2, p3, t);
        splinePoints.push(point);
      }
    }
    splinePoints.push(points[points.length - 1]);
    return splinePoints;
  }
  #catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    const x =
      0.5 *
      (2 * p1.x +
        (-p0.x + p2.x) * t +
        (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 +
        (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3);
    const y =
      0.5 *
      (2 * p1.y +
        (-p0.y + p2.y) * t +
        (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
        (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);
    return { x, y };
  }
  getLaneCenter(laneIndex) {
    const laneWidth = this.width / this.laneCount;
    const offset = lerp(
      -this.width / 2 + laneWidth / 2,
      this.width / 2 - laneWidth / 2,
      this.laneCount > 1 ? laneIndex / (this.laneCount - 1) : 0.5
    );
    const p1 = this.points[0];
    const p2 = this.points[1];
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    return {
      x: p1.x + Math.cos(angle - Math.PI / 2) * offset,
      y: p1.y + Math.sin(angle - Math.PI / 2) * offset,
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
    if (this.laneCount > 1) {
      for (let i = 1; i < this.laneCount; i++) {
        const laneWidth = this.width / this.laneCount;
        const offset = -this.width / 2 + laneWidth * i;
        const { left: lineControlPoints } = this.#generateSplineControlPoints(
          this.points,
          offset
        );
        const linePath = this.#generateSplinePath(lineControlPoints, 15);
        ctx.beginPath();
        if (linePath.length > 0) {
          ctx.moveTo(linePath[0].x, linePath[0].y);
          for (let j = 1; j < linePath.length; j++) {
            ctx.lineTo(linePath[j].x, linePath[j].y);
          }
        }
        ctx.stroke();
      }
    }
    ctx.setLineDash([]);
    this.borders.forEach((border) => {
      ctx.beginPath();
      ctx.moveTo(border[0].x, border[0].y);
      for (let i = 1; i < border.length; i++) {
        ctx.lineTo(border[i].x, border[i].y);
      }
      ctx.stroke();
    });
  }
}
