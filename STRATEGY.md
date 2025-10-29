## Implementation Strategies (MVP)

### Inputs (state)
- 15 ray distances, normalized to [0,1] (1 = no hit), FOV 150°, length ~150px
- Ego features: speed/maxSpeed, lateral offset to lane center, heading error to lane tangent
- Optional later: lookahead curvature scalar

### Model
- PPO with small MLP (2–3 layers, 64–128 units, ReLU/SiLU), memoryless
- Continuous actions

### Outputs (action)
- Steering in [-1,1]
- Acceleration in [-1,1] (negative = brake)

### Reward (per mode)
- Normal: r = α·forward_progress − β·collision − γ·border_penalty − δ·oscillation
- Speed: r = α·forward_progress + λ·speed − β·collision − γ·border_penalty
- Episode terminates on collision or hard off-road

### Sensors (FOV/rays)
- FOV = 150°, 15 rays, length ~150px
- Normalize or log-encode distances; optionally add short side whiskers later

### Traffic (MVP, single lane)
- Represent cars by Frenet s along lanePath
- Target speeds sampled in [0.6, 0.85] × player maxSpeed
- Simple car-following (time headway + min gap), no overtakes
- Count = floor(totalRoadLength / carsPerMeters), with performance cap

### Road geometry (constant width)
- Generate high-res centerline spline
- Offset borders and lane centers via Frenet normals (no re-spline after offset)
- Resample to uniform arc length

### Stability/safety
- Action smoothing (EMA on steering/accel)
- Emergency brake if front ray < stop threshold
- Reward clipping; early termination on repeated off-road penalties

### Training robustness
- Mild domain randomization: traffic speeds, spawn gaps, sensor noise
- Curriculum: start no-traffic; then add slow traffic


