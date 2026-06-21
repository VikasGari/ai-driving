(function(global){
	let NEXT_ID = 1;
	class Car{
		constructor(pos, dir){
			this.id = NEXT_ID++;
			this.position = { x: pos.x, y: pos.y };
			this.orientation = Math.atan2(dir.y, dir.x);
			this.velocity = 0;
			this.maxSpeed = 1.2;
			this.route = null; // {points, index, t}
			this.fsm = { state: 'Driving' };
			this.waitingTimeMs = 0;
		}
		isMoving(){ return this.velocity > 0.02; }
	}
	global.__NewSim = Object.assign(global.__NewSim||{}, { Car });
})(window);
