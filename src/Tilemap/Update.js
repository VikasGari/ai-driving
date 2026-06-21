(function(global){
	const App = global.App || (global.App = {});
	App.Tilemap = App.Tilemap || {};
	App.Tilemap.Update = {
		update(msg, model){ return { model, cmd:null }; }
	};
})(window);
