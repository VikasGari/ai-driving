## AI Driving Simulation

Lightweight browser-based driving sim with a player car, spline road editor, raycast sensors, and AI control. This document captures the MVP scope vs. the ideal system for future development.

### Core Concepts
- **Sensors**: The car perceives with 16 raycasts (distances to borders/traffic).
- **Policy/Model**: Produces control decisions from current sensor state only (no map memory).
- **Modes**:
  - **Normal Mode**: Maximize safe progress using reward for staying on road and avoiding collisions.
  - **Speed Mode**: Prioritize travel speed and time-to-goal while still avoiding collisions.
- **Traffic**: Slow-moving vehicles at varying speeds to encourage overtaking; count scales with road length.

---

## MVP (Current Phase)

Focused, single-road prototype to validate core driving behavior and reward shaping.

### In Scope
- Single continuous road (no intersections).
- Start = beginning of road; End = end of road.
- Player car controlled by a simple reward-based policy using 16-ray sensor readings.
- Two modes: Normal vs. Speed (different reward weighting).
- Traffic cars slower than the player with varying speeds in a preset range.
- Traffic density proportional to total road length (e.g., carsPerMeter scaling).
- Collision handling with road borders and traffic.
- Editor: adjust road spline in Edit mode; drive in Driving mode.

### Out of Scope (for MVP)
- Multiple roads or intersections.
- Explicit draggable Start/End markers.
- Traffic signals.
- Long-term memory or map-based planning.

### MVP Acceptance Criteria
- Car can traverse a user-shaped single road without collisions for a meaningful distance in Normal mode.
- Speed mode measurably increases average speed and reduces time-to-end versus Normal mode (while maintaining low collision rate).
- Traffic cars spawn with speeds below player’s typical max and vary within a configured range.
- Total number of traffic cars ≈ k × totalRoadLength, capped for performance.

### Suggested MVP Reward Design
- Let d be forward progress along the road centerline; v be speed.
- Collision penalty: large negative terminal reward.
- Off-road/near-border penalty: small continuous penalty as distance-to-border shrinks.
- Normal mode reward: r = α·Δd − β·collision − γ·border_penalty.
- Speed mode reward: r = α·Δd + λ·v − β·collision − γ·border_penalty, with λ > 0.

---

## Ideal System (Post-MVP)

Richer environment with explicit goals, overtaking logic, and signals.

### Target Capabilities
- Map editor supports draggable Start and End markers constrained to road surface.
- Multiple connected roads and intersections.
- Traffic signal system at intersections, with signal states affecting agent reward and legality.
- Enhanced policy options: imitation learning, on-policy RL, or model-based planners.
- Curriculum training: start simple roads → complex with traffic and signals.
- Telemetry and replay: record episodes, visualize rewards, collisions, and policy decisions.

### Expanded Rewards/Constraints
- Goal-directed reward: time-to-goal and path efficiency.
- Legal behavior: penalties for red-light violations and unsafe overtakes.
- Comfort: jerk/acceleration penalties.

---

## Architecture Snapshot
- `road.js`: Spline road generation, lane paths, borders, and drawing.
- `car.js`: Vehicle state, physics, polygon for collisions, sensor hookup.
- `sensor.js`: 16-ray casting and nearest-intersection readings.
- `controls.js`: Player controls wiring (also supports simple dummy behavior).
- `main.js`: Modes, loop, camera/zoom, traffic spawn/despawn tied to road length.
- `utils.js`: Geometry and vector helpers.

### Model Interface (MVP)
- Observation: 16 distances (normalized), optional speed and angle-to-centerline.
- Action: discrete {left, right, forward, reverse} or continuous steering/throttle.
- Update step: each frame, read sensors → compute action → apply → compute reward.

---

## Configuration Defaults (Guidance)
- Sensor rays: 16, length ~150px, 180° spread.
- Player max speed > traffic speed range.
- Traffic speed range: e.g., [0.6, 0.85] × player max.
- Traffic density: MAX_TRAFFIC ≈ floor(totalRoadLength / carsPerMeters).

---

## Roadmap
1) MVP
   - Implement mode-specific rewards and policy loop using current sensors.
   - Ensure traffic scaling by road length and variable speeds below player.
   - Tune rewards to achieve stable no-collision driving and overtaking.
2) Post-MVP
   - Start/End markers constrained to road; path progress-to-goal metric.
   - Multiple roads, intersections, and traffic signals with compliance rewards.
   - Data collection, telemetry dashboard, and episode replay.
   - Advanced training strategies (IL/RL) and curriculum.

---

## Getting Started
1. Open `index.html` in a modern browser.
2. Use Edit mode to shape the road; use Driving mode to run the sim.
3. Toggle polygon visualization and adjust zoom as needed.

Notes: Keep frame time stable; cap max traffic if FPS drops. Persist configurations and seeds for reproducibility when training.


