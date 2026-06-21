(function(global){
	const App = global.App || (global.App = {});
	App.Simulation = App.Simulation || {};
	App.Simulation.Update = {
		update(msg, model){
			// For now just return model; integration done in our new_traffic manager elsewhere
			return { model, cmd: null };
		}
	};
})(window);
