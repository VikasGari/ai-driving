(function(global){
	class FSM{
		constructor(state){ this.state = state || 'Idle'; }
		update(deltaMs, ctx){
			// Placeholder: keep state
			return this.state;
		}
	}
	global.__NewSim = Object.assign(global.__NewSim||{}, { FSM });
})(window);
