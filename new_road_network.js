(function(global){
	class RoadNetwork{
		constructor(){
			this.nodes = new Map(); // id -> {id, pos:{x,y}, dir:{x,y}}
			this.edges = new Map(); // fromId -> Set(toId)
		}
		addNode(id, pos, dir){ this.nodes.set(id, {id, pos, dir}); }
		addEdge(a,b){ if(!this.edges.has(a)) this.edges.set(a,new Set()); this.edges.get(a).add(b); }
		neighbors(id){ return Array.from(this.edges.get(id)||[]); }
	}
	function buildFromTilemap(tileEditor){
		const rn = new RoadNetwork();
		if(!tileEditor) return rn;
		let idCounter=1;
		const idAt = new Map();
		for(const tile of tileEditor.tiles.values()){
			if(!tile.laneTiles) continue;
			const f = { x: Math.cos(tile.baseOrientationAngle), y: Math.sin(tile.baseOrientationAngle) };
			for(const lt of tile.laneTiles){
				const dir = lt.isLeft ? f : { x: -f.x, y: -f.y };
				const id = idCounter++;
				idAt.set(`${tile.gridX},${tile.gridY},${lt.index}`, id);
				rn.addNode(id, {x:lt.center.x, y:lt.center.y}, dir);
			}
		}
		// connect to forward-adjacent tile's matching lane index
		for(const tile of tileEditor.tiles.values()){
			if(!tile.laneTiles) continue;
			const f = { x: Math.cos(tile.baseOrientationAngle), y: Math.sin(tile.baseOrientationAngle) };
			const step = { gx: Math.round(f.x), gy: Math.round(f.y) };
			const nx = tile.gridX + step.gx;
			const ny = tile.gridY + step.gy;
			const nk = tileEditor.getTileKey(nx, ny);
			const next = tileEditor.tiles.get(nk);
			if(!next || !next.laneTiles) continue;
			for(const lt of tile.laneTiles){
				const fromId = idAt.get(`${tile.gridX},${tile.gridY},${lt.index}`);
				const toId = idAt.get(`${nx},${ny},${lt.index}`);
				if(fromId && toId) rn.addEdge(fromId, toId);
			}
		}
		return rn;
	}
	global.__NewSim = Object.assign(global.__NewSim||{}, { RoadNetwork, buildFromTilemap });
})(window);
