class Car {
  constructor(x, y, width, height, controlType, maxSpeed = 3) {
    this.toRemove = false;
    this.lane = 0;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = 0;
    this.maxSpeed = maxSpeed;
    this.angle = 0;
    this.damaged = false;
    this.controls = new Controls(controlType);
    this.controls.type = controlType;
    // NEW: Progress along the path in pixels
    this.pathProgress = 0;
    if (controlType !== "DUMMY") {
      this.sensor = new Sensor(this);
      // Physics properties are now ONLY for the player car
      this.acceleration = 0.2;
      this.friction = 0.05;
    }
  }

  update(roadBorders, traffic, mode = "DRIVING", lanePath = null) {
    if (!this.damaged) {
      // Player car uses physics-based movement
      if (this.controls.type !== "DUMMY") {
        if (mode === "DRIVING") {
          this.#move();
        }
      }
      // Traffic cars are snapped to their path
      else if (lanePath && lanePath.length > 0) {
        this.#snapToLane(lanePath);
      }

      // Polygon and damage checks are still needed for all cars
      this.polygon = this.#createPolygon();
      this.damaged = this.#assessDamage(roadBorders, traffic);
    }

    // Only player car has sensors
    if (this.sensor) {
      this.sensor.update(roadBorders, traffic);
    }
  }

  // NEW: The logic to snap a car to a pre-calculated path
  #snapToLane(lanePath) {
    this.pathProgress += this.speed;

    let currentPointIndex = 0;
    let dist = 0;
    while (
      dist < this.pathProgress &&
      currentPointIndex < lanePath.length - 1
    ) {
      dist += Math.hypot(
        lanePath[currentPointIndex + 1].x - lanePath[currentPointIndex].x,
        lanePath[currentPointIndex + 1].y - lanePath[currentPointIndex].y
      );
      currentPointIndex++;
    }

    if (currentPointIndex >= lanePath.length - 1) {
      this.toRemove = true;
      return;
    }

    const p1 = lanePath[currentPointIndex - 1];
    const p2 = lanePath[currentPointIndex];

    // Set the car's position directly on the path segment
    this.x = p2.x;
    this.y = p2.y;

    // Set the car's angle to match the path segment's direction
    this.angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) + Math.PI / 2;
  }

  // This method is now ONLY used by the player car
  #move() {
    /* ... unchanged ... */ if (this.controls.forward) {
      this.speed += this.acceleration;
    }
    if (this.controls.reverse) {
      this.speed -= this.acceleration;
    }
    if (this.speed > this.maxSpeed) {
      this.speed = this.maxSpeed;
    }
    if (this.speed < -this.maxSpeed / 2) {
      this.speed = -this.maxSpeed / 2;
    }
    if (this.speed > 0) {
      this.speed -= this.friction;
    }
    if (this.speed < 0) {
      this.speed += this.friction;
    }
    if (Math.abs(this.speed) < this.friction) {
      this.speed = 0;
    }
    if (this.speed !== 0) {
      const flip = this.speed > 0 ? 1 : -1;
      if (this.controls.left) {
        this.angle += 0.03 * flip;
      }
      if (this.controls.right) {
        this.angle -= 0.03 * flip;
      }
    }
    this.x -= Math.sin(this.angle) * this.speed;
    this.y -= Math.cos(this.angle) * this.speed;
  }

  // All other methods and helper functions are unchanged
  #findClosestPathIndex(path) {
    let closestDist = Infinity;
    let closestIndex = 0;
    for (let i = 0; i < path.length; i++) {
      const dist = Math.hypot(this.x - path[i].x, this.y - path[i].y);
      if (dist < closestDist) {
        closestDist = dist;
        closestIndex = i;
      }
    }
    return closestIndex;
  }
  #assessDamage(roadBorders, traffic) {
    for (let i = 0; i < roadBorders.length; i++) {
      if (polyIntersectsPolyline(this.polygon, roadBorders[i])) {
        return true;
      }
    }
    for (let j = 0; j < traffic.length; j++) {
      if (
        this != traffic[j] &&
        polysIntersect(this.polygon, traffic[j].polygon)
      ) {
        return true;
      }
    }
    return false;
  }
  #createPolygon() {
    const points = [];
    const rad = Math.hypot(this.width, this.height) / 2;
    const alpha = Math.atan2(this.width, this.height);
    points.push({
      x: this.x - Math.sin(this.angle - alpha) * rad,
      y: this.y - Math.cos(this.angle - alpha) * rad,
    });
    points.push({
      x: this.x - Math.sin(this.angle + alpha) * rad,
      y: this.y - Math.cos(this.angle + alpha) * rad,
    });
    points.push({
      x: this.x - Math.sin(Math.PI + this.angle - alpha) * rad,
      y: this.y - Math.cos(Math.PI + this.angle - alpha) * rad,
    });
    points.push({
      x: this.x - Math.sin(Math.PI + this.angle + alpha) * rad,
      y: this.y - Math.cos(Math.PI + this.angle + alpha) * rad,
    });
    return points;
  }
  draw(ctx, color, drawPolygon = false) {
    if (this.damaged) {
      ctx.fillStyle = "red";
    } else {
      ctx.fillStyle = color;
    }
    if (this.polygon) {
      ctx.beginPath();
      ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
      for (let i = 1; i < this.polygon.length; i++) {
        ctx.lineTo(this.polygon[i].x, this.polygon[i].y);
      }
      ctx.fill();
    }
    if (this.polygon && drawPolygon) {
      ctx.strokeStyle = "rgba(0, 255, 0, 0.8)";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(this.polygon[0].x, this.polygon[0].y);
      for (let i = 1; i < this.polygon.length + 1; i++) {
        ctx.lineTo(
          this.polygon[i % this.polygon.length].x,
          this.polygon[i % this.polygon.length].y
        );
      }
      ctx.stroke();
    }
    if (this.sensor) {
      this.sensor.draw(ctx);
    }
  }
}
function polysIntersect(poly1, poly2) {
  if (!poly1 || !poly2) return false;
  for (let i = 0; i < poly1.length; i++) {
    for (let j = 0; j < poly2.length; j++) {
      const touch = getIntersection(
        poly1[i],
        poly1[(i + 1) % poly1.length],
        poly2[j],
        poly2[(j + 1) % poly2.length]
      );
      if (touch) {
        return true;
      }
    }
  }
  return false;
}
function polyIntersectsPolyline(polygon, polyline) {
  if (!polygon) return false;
  for (let i = 0; i < polygon.length; i++) {
    for (let j = 0; j < polyline.length - 1; j++) {
      const touch = getIntersection(
        polygon[i],
        polygon[(i + 1) % polygon.length],
        polyline[j],
        polyline[j + 1]
      );
      if (touch) {
        return true;
      }
    }
  }
  return false;
}
