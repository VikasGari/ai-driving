(function(global){
	const { World } = window.__NewSim;

	class Scheduler{
		constructor(){
			this.lastFrameMs = performance.now();
			this.envAccumMs = 0;
			this.secondaryAccumMs = 0;
			this.envEveryMs = 1000;
			this.secondaryEveryMs = Math.floor(1000/30);
		}
		step(world, onUpdateTraffic, onUpdateEnvironment, onCheckQueues){
			const now = performance.now();
			const delta = now - this.lastFrameMs;
			this.lastFrameMs = now;
			// per-frame traffic
			onUpdateTraffic(delta, world);
			// accumulators
			this.envAccumMs += delta;
			this.secondaryAccumMs += delta;
			if (this.envAccumMs >= this.envEveryMs){
				onUpdateEnvironment(world);
				this.envAccumMs = 0;
			}
			while (this.secondaryAccumMs >= this.secondaryEveryMs){
				onCheckQueues(this.secondaryEveryMs, world);
				this.secondaryAccumMs -= this.secondaryEveryMs;
			}
		}
	}

	global.__NewSim = Object.assign(global.__NewSim||{}, { Scheduler });
})(window);
