(function(global){
	const { World, Scheduler, RoadNetwork, buildFromTilemap, sample, advance, atEnd, Steering, Events, processDue } = (function(){
		const NS = window.__NewSim||{};
		return {
			World: NS.World,
			Scheduler: NS.Scheduler,
			RoadNetwork: NS.RoadNetwork,
			buildFromTilemap: NS.buildFromTilemap,
			sample: (route)=>NS.sample(route),
			advance: (route,dist)=>NS.advance(route,dist),
			atEnd: (route)=>NS.atEnd(route),
			Steering: NS.Steering,
			Events: NS.Events,
			processDue: NS.processDue
		};
	})();

	class NewTrafficManager{
		constructor(tileEditor, spawnTiles = []){
			this.tileEditor = tileEditor;
			this.spawnTiles = Array.isArray(spawnTiles)? spawnTiles:[];
			this.world = new World();
			this.scheduler = new Scheduler();
			this._initNetwork();
			// initial spawn event
			this.world.eventQueue.add(Events.SpawnTestCar(this.world), performance.now());
		}
		_initNetwork(){
			this.world.roadNetwork = buildFromTilemap(this.tileEditor);
			// add traffic lights at some nodes (every 4th as a placeholder)
			let idx=0;
			for(const node of this.world.roadNetwork.nodes.values()){
				if((idx++ % 4)===0){
					const TL = (window.__NewSim||{}).TrafficLight;
					if(TL){ this.world.trafficLights.set(node.id, new TL(node.pos)); }
				}
			}
		}
		update(){
			this.scheduler.step(
				this.world,
				(deltaMs, world)=>{ // per-frame traffic update
					processDue(world);
					for(const car of world.cars.values()){
						if(!car.route || car.route.points.length<2){ car.velocity = 0; continue; }
						// rules → steering
						if(window.__NewSim && window.__NewSim.computeSteering && window.__NewSim.toSteering){
							const rs = window.__NewSim.computeSteering(world, car);
							car._steer = window.__NewSim.toSteering(car, rs);
						}else{
							car._steer = Steering.accelerate();
						}
						Steering.applySteering(car, deltaMs, ()=>{
							const s = sample(car.route);
							return s ? { point:s.point, tangent:s.tangent } : null;
						});
						car.route = advance(car.route, car.velocity * (deltaMs/16.666));
						const s = sample(car.route);
						if(s){ car.position = s.point; car.orientation = Math.atan2(s.tangent.y,s.tangent.x); }
						if(atEnd(car.route)){
							// simple continuation: try first neighbor
							const last = car.route.points[car.route.points.length-1];
							// find nearest node id to last point
							let best=null,bd=1e9;
							for(const node of world.roadNetwork.nodes.values()){
								const d = Math.hypot(node.pos.x-last.x, node.pos.y-last.y);
								if(d<bd){ bd=d; best=node; }
							}
							if(best){
								const nbs = world.roadNetwork.neighbors(best.id);
								if(nbs && nbs.length){
									car.route = { points: window.__NewSim.makePolyline(world, best.id, nbs[0]), index:0, t:0 };
								}
							}
						}
						// waiting time update
						if(car.isMoving && car.isMoving()) car.waitingTimeMs = 0; else car.waitingTimeMs += deltaMs;
						if(car.waitingTimeMs > 8000){
							// despawn if stuck too long
							world.cars.delete(car.id);
						}
					}
				},
				(world)=>{ // environment update: tick traffic lights
					for(const tl of world.trafficLights.values()) tl.update(this.scheduler.envEveryMs);
				},
				(deltaMs, world)=>{ /* check queues placeholder */ }
			);
		}
		draw(ctx){
			ctx.save();
			ctx.fillStyle = '#2e7d32';
			for(const car of this.world.cars.values()){
				ctx.save();
				ctx.translate(car.position.x, car.position.y);
				ctx.rotate(car.orientation);
				ctx.fillRect(-6, -10, 12, 20);
				ctx.restore();
			}
			ctx.restore();
		}
	}

	window.NewTrafficManager = NewTrafficManager;
})(window);
