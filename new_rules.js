(function(global){
	function distance(a,b){ return Math.hypot(a.x-b.x,a.y-b.y); }
	function projectForward(car, other){
		const dx = other.position.x - car.position.x;
		const dy = other.position.y - car.position.y;
		const fx = Math.cos(car.orientation), fy = Math.sin(car.orientation);
		const along = dx*fx + dy*fy;
		const lateral = Math.abs(-dx*fy + dy*fx);
		return { along, lateral };
	}
	function nearRouteEnd(car, pixels){
		if(!car.route || car.route.points.length<2) return true;
		// remaining distance on current segment only (simple)
		const pts = car.route.points;
		const i = Math.min(car.route.index, pts.length-2);
		const p1 = pts[i], p2 = pts[i+1];
		const seg = Math.hypot(p2.x-p1.x, p2.y-p1.y)||1;
		const rem = (1 - car.route.t) * seg;
		return (i >= pts.length-2) && rem <= pixels;
	}
	function redLightAhead(world, car){
		// find nearest node ahead within reaction distance; stop if red
		let nearest = null, best = Infinity;
		for(const [nodeId, node] of world.roadNetwork.nodes){
			const dx = node.pos.x - car.position.x;
			const dy = node.pos.y - car.position.y;
			const fx = Math.cos(car.orientation), fy = Math.sin(car.orientation);
			const along = dx*fx + dy*fy;
			const lateral = Math.abs(-dx*fy + dy*fx);
			if(along > 0 && along < 60 && lateral < 12){
				if(along < best){ best = along; nearest = nodeId; }
			}
		}
		if(nearest!=null){
			const tl = world.trafficLights.get(nearest);
			if(tl && tl.isRed()) return { kind:'StopAtDistance', dist: best };
		}
		return null;
	}

	function computeSteering(world, car){
		// Check simple forward collision
		let steer = null;
		let minAhead = Infinity;
		for(const other of world.cars.values()){
			if(other===car) continue;
			const { along, lateral } = projectForward(car, other);
			if(along > 0 && along < 30 && lateral < 10){
				if(along < minAhead) minAhead = along;
			}
		}
		if(minAhead < Infinity){
			return { kind:'StopAtDistance', dist:minAhead };
		}
		const tlRule = redLightAhead(world, car);
		if(tlRule) return tlRule;
		if(nearRouteEnd(car, 20)){
			return { kind:'GoSlow', max: 0.6 };
		}
		return { kind:'Accelerate' };
	}
	function toSteering(car, ruleSteer){
		const S = (window.__NewSim||{}).Steering;
		if(!S) return { linear:0, angular:0 };
		switch(ruleSteer.kind){
			case 'StopAtDistance':
				return S.stop();
			case 'GoSlow':
				return S.goSlow(car.velocity, ruleSteer.max||0.6);
			case 'Accelerate':
			default:
				return S.accelerate();
		}
	}
	global.__NewSim = Object.assign(global.__NewSim||{}, { computeSteering, toSteering });
})(window);
