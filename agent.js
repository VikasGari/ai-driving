class AgentUtils {
    static clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    static nearestPointAndTangentOnPath(point, path) {
        if (!path || path.length < 2) return { closest: point, tangent: { x: 0, y: -1 } };
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < path.length; i++) {
            const dx = path[i].x - point.x;
            const dy = path[i].y - point.y;
            const d2 = dx * dx + dy * dy;
            if (d2 < bestDist) {
                bestDist = d2;
                bestIdx = i;
            }
        }
        const i0 = Math.max(0, bestIdx - 1);
        const i1 = Math.min(path.length - 1, bestIdx + 1);
        const tangent = normalize(subtract(path[i1], path[i0]));
        return { closest: path[bestIdx], tangent };
    }
}

class ObservationBuilder {
    constructor(road, car) {
        this.road = road;
        this.car = car;
    }

    build(traffic, laneIndex = 1) {
        const obs = [];
        // Sensor distances
        const rays = this.car.sensor ? this.car.sensor.rays : [];
        const readings = this.car.sensor ? this.car.sensor.readings : [];
        for (let i = 0; i < rays.length; i++) {
            const reading = readings[i];
            if (!reading) {
                obs.push(1);
            } else {
                // reading.offset is normalized along the ray [0,1]
                obs.push(AgentUtils.clamp(1 - reading.offset, 0, 1));
            }
        }

        // Ego features
        obs.push(AgentUtils.clamp(this.car.speed / Math.max(0.0001, this.car.maxSpeed), -1, 1));

        const path = this.road.getLanePath(laneIndex);
        const { closest, tangent } = AgentUtils.nearestPointAndTangentOnPath({ x: this.car.x, y: this.car.y }, path || []);
        const lateralVec = subtract({ x: this.car.x, y: this.car.y }, closest);
        const rightNormal = { x: -tangent.y, y: tangent.x };
        const lateralOffset = (lateralVec.x * rightNormal.x + lateralVec.y * rightNormal.y) / (this.road.width / 2);
        obs.push(AgentUtils.clamp(lateralOffset, -1, 1));

        const heading = this.car.angle;
        const laneHeading = Math.atan2(tangent.y, tangent.x) + Math.PI / 2;
        let headingErr = heading - laneHeading;
        while (headingErr > Math.PI) headingErr -= 2 * Math.PI;
        while (headingErr < -Math.PI) headingErr += 2 * Math.PI;
        obs.push(AgentUtils.clamp(headingErr / Math.PI, -1, 1));

        return obs;
    }
}

class Policy {
    // Stub policy: keeps straight and slight throttle. Replace with PPO later.
    act(observation, mode = "NORMAL") {
        const steer = 0; // [-1,1]
        const accel = 0.2; // [-1,1]
        return { steer, accel };
    }
}


