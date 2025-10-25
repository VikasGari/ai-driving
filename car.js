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
    this.pathProgress = 0;

    // Player car has a full sensor array
    if (controlType === "PLAYER") {
      this.sensor = new Sensor(this); // Default is 16 rays
      this.acceleration = 0.2;
      this.friction = 0.05;
    }
    // DUMMY cars now get a single forward-facing sensor
    if (controlType === "DUMMY") {
      this.sensor = new Sensor(this, 1);
      this.stopDistance = height / 2 + 15; // Stop when something is 15px in front
    }
  }

  update(roadBorders, traffic, mode = "DRIVING", lanePath = null) {
    if (!this.damaged) {
      if (this.controls.type === "PLAYER") {
        if (mode === "DRIVING") {
          this.#move();
        }
      } else if (
        this.controls.type === "DUMMY" &&
        lanePath &&
        lanePath.length > 0
      ) {
        // Dummy cars must update their sensors BEFORE deciding to move
        this.sensor.update(roadBorders, [...traffic, car]);
        this.#snapToLane(lanePath);
      }
      this.polygon = this.#createPolygon();
      this.damaged = this.#assessDamage(roadBorders, traffic);
    }
    // Player car sensors update here
    if (this.controls.type === "PLAYER" && this.sensor) {
      this.sensor.update(roadBorders, traffic);
    }
  }

  // UPDATED: DUMMY cars now stop based on their sensor
  #snapToLane(lanePath) {
    let stopped = false;
    const sensorReading = this.sensor.readings[0];
    if (sensorReading && sensorReading.offset < this.stopDistance) {
      stopped = true;
    }

    // Only move forward if not stopped
    if (!stopped) {
      this.pathProgress += this.speed;
    }

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
    const p1 = lanePath[currentPointIndex - 1] || lanePath[0];
    const p2 = lanePath[currentPointIndex];
    this.x = p2.x;
    this.y = p2.y;
    this.angle = -(Math.atan2(p2.y - p1.y, p2.x - p1.x) - Math.PI / 2);
  }

  // UPDATED: New, robust collision logic
  #assessDamage(roadBorders, allOtherCars) {
    // Check against borders
    for (let i = 0; i < roadBorders.length; i++) {
      if (polyIntersectsPolyline(this.polygon, roadBorders[i])) {
        if (this.controls.type === "DUMMY") {
          this.toRemove = true;
        }
        return true;
      }
    }
    // Check against other cars
    for (let i = 0; i < allOtherCars.length; i++) {
      const otherCar = allOtherCars[i];
      if (this === otherCar) {
        continue;
      }

      if (polysIntersect(this.polygon, otherCar.polygon)) {
        // If a DUMMY car hits anything (that isn't the PLAYER)...
        if (
          this.controls.type === "DUMMY" &&
          otherCar.controls.type !== "PLAYER"
        ) {
          this.toRemove = true;
        }
        // Damage is always applied in any car-on-car collision
        return true;
      }
    }
    return false;
  }

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
        this.angle -= 0.03 * flip;
      }
      if (this.controls.right) {
        this.angle += 0.03 * flip;
      }
    }
    this.x -= Math.sin(this.angle) * this.speed;
    this.y -= Math.cos(this.angle) * this.speed;
  }
  #createPolygon() {
    /* ... unchanged ... */ const points = [];
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
    /* ... unchanged ... */ if (this.damaged) {
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
  /* ... unchanged ... */ if (!poly1 || !poly2) return false;
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
  /* ... unchanged ... */ if (!polygon) return false;
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
