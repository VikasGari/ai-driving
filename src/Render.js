(function(global){
	const App = global.App || (global.App = {});
	App.Render = {
		view(model){ return function(){ /* drawing handled in main animation */ }; }
	};
})(window);
