class Car {
  // ... constructor is unchanged ...
  constructor(x, y, width, height, controlType, maxSpeed = 3) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.speed = 0;
    this.acceleration = 0.2;
    this.maxSpeed = maxSpeed;
    this.friction = 0.05;
    this.angle = 0;
    this.damaged = false;
    this.controls = new Controls(controlType);
    this.controls.type = controlType;
    if (controlType !== "DUMMY") {
      this.sensor = new Sensor(this);
    }
  }
  update(roadBorders, traffic, mode = "DRIVING") {
    if (!this.damaged) {
      if (this.controls.type !== "DUMMY" && mode === "DRIVING") {
        this.#move();
      } else if (this.controls.type === "DUMMY") {
        this.#move();
      }
      this.polygon = this.#createPolygon();
      this.damaged = this.#assessDamage(roadBorders, traffic);
    }
    if (this.sensor) {
      this.sensor.update(roadBorders, traffic);
    }
  }

  // UPDATED assessDamage method
  #assessDamage(roadBorders, traffic) {
    // Use the new, correct function for road borders (open lines)
    for (let i = 0; i < roadBorders.length; i++) {
      if (polyIntersectsPolyline(this.polygon, roadBorders[i])) {
        return true;
      }
    }
    // Use the old function for traffic cars (closed shapes)
    for (let i = 0; i < traffic.length; i++) {
      if (polysIntersect(this.polygon, traffic[i].polygon)) {
        return true;
      }
    }
    return false;
  }

  // ... #createPolygon, #move, and draw methods are unchanged ...
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
  #move() {
    if (this.controls.forward) {
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

// This is the old function, still needed for car-on-car collisions
function polysIntersect(poly1, poly2) {
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

// NEW FUNCTION: Checks a polygon against an open line
function polyIntersectsPolyline(polygon, polyline) {
  for (let i = 0; i < polygon.length; i++) {
    // Note: The loop for the polyline only goes to length-2 to get segments
    for (let j = 0; j < polyline.length - 1; j++) {
      const touch = getIntersection(
        polygon[i],
        polygon[(i + 1) % polygon.length], // Car segment
        polyline[j],
        polyline[j + 1] // Road border segment
      );
      if (touch) {
        return true;
      }
    }
  }
  return false;
}
