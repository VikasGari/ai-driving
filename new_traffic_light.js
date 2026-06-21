(function(global){
	class TrafficLight{
		constructor(position){
			this.position = { x: position.x, y: position.y };
			this.state = 'Green';
			this.elapsedMs = 0;
			this.greenMs = 5000;
			this.redMs = 5000;
		}
		update(deltaMs){
			this.elapsedMs += deltaMs;
			if(this.state==='Green' && this.elapsedMs >= this.greenMs){ this.state='Red'; this.elapsedMs=0; }
			else if(this.state==='Red' && this.elapsedMs >= this.redMs){ this.state='Green'; this.elapsedMs=0; }
		}
		isRed(){ return this.state==='Red'; }
	}
	global.__NewSim = Object.assign(global.__NewSim||{}, { TrafficLight });
})(window);
