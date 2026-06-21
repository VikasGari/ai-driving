(function(global){
	function makePolyline(world, fromId, toId){
		const a = world.roadNetwork.nodes.get(fromId);
		const b = world.roadNetwork.nodes.get(toId);
		if(!a||!b) return [];
		return [a.pos, b.pos];
	}
	function buildChain(world, startId, steps){
		const points = [];
		let cur = startId;
		let lastPos = null;
		for(let i=0;i<steps;i++){
			const node = world.roadNetwork.nodes.get(cur);
			if(!node) break;
			if(!lastPos || lastPos.x!==node.pos.x || lastPos.y!==node.pos.y){ points.push({x:node.pos.x,y:node.pos.y}); lastPos = node.pos; }
			const nbs = world.roadNetwork.neighbors(cur);
			if(!nbs || !nbs.length) break;
			cur = nbs[0];
		}
		return points;
	}
	function sample(route){
		if(!route || route.points.length===0) return null;
		const pts = route.points;
		const idx = Math.min(route.index, pts.length-1);
		const next = Math.min(idx+1, pts.length-1);
		const p1 = pts[idx];
		const p2 = pts[next];
		const dx = p2.x - p1.x, dy = p2.y - p1.y;
		const len = Math.hypot(dx,dy)||1;
		const t = Math.min(1, route.t);
		const x = p1.x + dx * t;
		const y = p1.y + dy * t;
		const tangent = { x: dx/len, y: dy/len };
		return { point:{x,y}, tangent };
	}
	function advance(route, dist){
		if(!route) return route;
		let d = dist;
		while(d>0 && route.index < route.points.length-1){
			const p1 = route.points[route.index];
			const p2 = route.points[route.index+1];
			const seg = Math.hypot(p2.x-p1.x, p2.y-p1.y)||1;
			const rem = (1 - route.t) * seg;
			if(d < rem){ route.t += d/seg; d = 0; }
			else { route.index++; route.t = 0; d -= rem; }
		}
		return route;
	}
	function atEnd(route){ return !route || route.index >= route.points.length-1; }
	global.__NewSim = Object.assign(global.__NewSim||{}, { makePolyline, buildChain, sample, advance, atEnd });
})(window);
