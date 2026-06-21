(function(global){
	const { Car } = window.__NewSim;
	const Events = {
		SpawnTestCar: (world)=>({ kind:'SpawnTestCar' }),
		CreateRouteFromNode: (carId, fromId, toId)=>({ kind:'CreateRouteFromNode', carId, fromId, toId })
	};
	function processDue(world){
		const now = performance.now();
		const due = world.eventQueue.popDue(now);
		for(const ev of due){
			if(ev.kind==='SpawnTestCar'){
				const nodes = Array.from(world.roadNetwork.nodes.values());
				if(nodes.length<2) continue;
				const a = nodes[Math.floor(Math.random()*nodes.length)];
				const cand = (nid)=> world.roadNetwork.neighbors(nid)[0];
				const to = cand(a.id);
				if(!to) continue;
				const car = new Car(a.pos, a.dir);
				world.cars.set(car.id, car);
				world.eventQueue.add(Events.CreateRouteFromNode(car.id, a.id, to), now);
			}
			if(ev.kind==='CreateRouteFromNode'){
				const car = world.cars.get(ev.carId);
				if(!car) continue;
				const chain = window.__NewSim.buildChain(world, ev.fromId, 8);
				car.route = { points: chain, index: 0, t: 0 };
			}
		}
	}
	global.__NewSim = Object.assign(global.__NewSim||{}, { Events, processDue });
})(window);
