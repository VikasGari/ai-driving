(function(global){
	const App = global.App || (global.App = {});
	const { Scheduler } = window.__NewSim||{};

	const Message = {
		AnimationFrameReceived: 'AnimationFrameReceived',
		UpdateTraffic: 'UpdateTraffic',
		UpdateEnvironment: 'UpdateEnvironment',
		CheckQueues: 'CheckQueues'
	};

	App.Main = {
		init(flags){
			return { model: App.Model.Liikennematto.initial(flags), cmd: null };
		},
		view(model){ return App.UI.view(model, App.Render.view(model)); },
		update(msg, model){ return App.Simulation.Update.update(msg, model); },
		subscriptions(model){ return App.UI.subscriptions(model); }
	};
})(window);
