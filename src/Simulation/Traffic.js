(function(global){
	const App = global.App || (global.App = {});
	App.Simulation = App.Simulation || {};
	App.Simulation.Traffic = {
		updateTraffic(model, deltaMs){
			// no-op here; handled in NewTrafficManager
			return model;
		}
	};
})(window);
