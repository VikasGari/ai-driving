(function(global){
	function nowMs(){ return performance.now(); }

	class EventQueue{
		constructor(){ this.items = []; }
		add(event, triggerAtMs){ this.items.push({event, triggerAtMs}); }
		popDue(currentMs){
			const due = [];
			const rest = [];
			for (const it of this.items){ (it.triggerAtMs <= currentMs ? due : rest).push(it); }
			this.items = rest;
			return due.map(it=>it.event);
		}
	}

	class World{
		constructor(){
			this.cars = new Map(); // id -> car
			this.roadNetwork = null;
			this.tilemap = null;
			this.trafficLights = new Map(); // nodeId -> TrafficLight
			this.eventQueue = new EventQueue();
			this.timeMs = nowMs();
		}
	}

	global.__NewSim = { World, EventQueue };
})(window);
