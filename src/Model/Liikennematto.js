(function(global){
	const App = global.App || (global.App = {});
	App.Model = App.Model || {};
	App.Model.Liikennematto = {
		initial(flags){
			return {
				world: new (window.__NewSim||{}).World(),
				renderCache: { pixelsPerMeter: 8 },
				simulationActive: true,
				time: performance.now(),
				ui: {}
			};
		}
	};
})(window);
