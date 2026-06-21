(function(global){
	function accelerate(){ return { linear: 0.4, angular: 0 }; }
	function stop(){ return { linear: -0.6, angular: 0 }; }
	function goSlow(v, max){ return { linear: (max? Math.min(0.2, max - v): 0.2), angular: 0 }; }
	function applySteering(car, deltaMs, sampleFn){
		const s = sampleFn();
		if(!s) return car;
		car.orientation = Math.atan2(s.tangent.y, s.tangent.x);
		car.velocity = Math.max(0, Math.min(car.maxSpeed, car.velocity + (car._steer.linear||0) * (deltaMs/1000)));
		return car;
	}
	global.__NewSim = Object.assign(global.__NewSim||{}, { Steering:{ accelerate, stop, goSlow, applySteering } });
})(window);
