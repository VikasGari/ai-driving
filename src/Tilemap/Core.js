(function(global){
	const App = global.App || (global.App = {});
	App.Tilemap = App.Tilemap || {};
	App.Tilemap.Core = App.Tilemap.Core || {};

	class LaneTile {
		constructor(parent, index, center, isLeft) {
			this.parent = parent;
			this.index = index;
			this.center = center;
			this.isLeft = !!isLeft;
		}
	}
	class RoadTile {
		constructor(gridX, gridY, tileSize = 60, baseOrientationAngle = 0) {
			this.gridX = gridX;
			this.gridY = gridY;
			this.tileSize = tileSize;
			this.worldX = gridX * tileSize;
			this.worldY = gridY * tileSize;
			this.baseOrientationAngle = baseOrientationAngle;
			this.borders = { top: true, right: true, bottom: true, left: true };
			this.buttons = { top: true, right: true, bottom: true, left: true };
			this.isLShape = false;
			this.isTurn = false;
			this.isSpawn = false;
			this.laneTiles = this.buildLaneTiles();
		}
		getCenter() {
			return { x: this.worldX + this.tileSize / 2, y: this.worldY + this.tileSize / 2 };
		}
		buildLaneTiles() {
			const laneTiles = [];
			const center = this.getCenter();
			const f = { x: Math.cos(this.baseOrientationAngle), y: Math.sin(this.baseOrientationAngle) };
			const n = { x: -f.y, y: f.x };
			const offsetMag = this.tileSize * 0.25;
			const offsets = [ -offsetMag, +offsetMag ];
			for (let i = 0; i < 2; i++) {
				const off = offsets[i];
				const cx = center.x + n.x * off;
				const cy = center.y + n.y * off;
				const isLeft = off < 0;
				laneTiles.push(new LaneTile(this, i, { x: cx, y: cy }, isLeft));
			}
			return laneTiles;
		}
		draw(ctx) {
			ctx.fillStyle = "#777";
			ctx.fillRect(this.worldX, this.worldY, this.tileSize, this.tileSize);
		}
	}

	class Editor {
		constructor(tileSize = 60) {
			this.tileSize = tileSize;
			this.tiles = new Map();
			this.buttonRadius = 8;
			global.__tileEditorRef = this;
			this.selectedKey = null;
			this.showButtons = false;
			this.showTileSelection = true;
			this.hoverKey = null;
		}
		getTileKey(x, y) { return `${x},${y}`; }
		addTile(gridX, gridY, baseOrientationAngle = 0) {
			const key = this.getTileKey(gridX, gridY);
			if (this.tiles.has(key)) return null;
			const tile = new RoadTile(gridX, gridY, this.tileSize, baseOrientationAngle);
			this.tiles.set(key, tile);
			this.refreshTileAndNeighbors(gridX, gridY);
			this.updateTileFlags(gridX, gridY);
			return tile;
		}
		updateAdjacentBorders(centerX, centerY) {
			const directions = [
				{ dx: 0, dy: -1, border: 'top', oppositeBorder: 'bottom' },
				{ dx: 1, dy: 0, border: 'right', oppositeBorder: 'left' },
				{ dx: 0, dy: 1, border: 'bottom', oppositeBorder: 'top' },
				{ dx: -1, dy: 0, border: 'left', oppositeBorder: 'right' }
			];
			for (const dir of directions) {
				const neighborX = centerX + dir.dx;
				const neighborY = centerY + dir.dy;
				const neighborKey = this.getTileKey(neighborX, neighborY);
				if (this.tiles.has(neighborKey)) {
					const neighbor = this.tiles.get(neighborKey);
					const center = this.tiles.get(this.getTileKey(centerX, centerY));
					center.borders[dir.border] = false;
					neighbor.borders[dir.oppositeBorder] = false;
				}
			}
		}
		handleClick(worldX, worldY) {
			const gx = Math.floor(worldX / this.tileSize);
			const gy = Math.floor(worldY / this.tileSize);
			const key = this.getTileKey(gx, gy);
			if (!this.tiles.has(key)) {
				const t = this.addTile(gx, gy, 0);
				if (t) {
					this.refreshNeighbors(gx, gy);
					this.selectedKey = key;
					return true;
				}
				return false;
			} else {
				const t = this.tiles.get(key);
				t.baseOrientationAngle = (t.baseOrientationAngle + Math.PI / 2) % (Math.PI * 2);
				t.laneTiles = t.buildLaneTiles();
				this.refreshNeighbors(gx, gy);
				this.selectedKey = key;
				return true;
			}
		}
		setHoverCell(worldX, worldY) {
			const gx = Math.floor(worldX / this.tileSize);
			const gy = Math.floor(worldY / this.tileSize);
			this.hoverKey = this.getTileKey(gx, gy);
		}
		draw(ctx) {
			ctx.save();
			ctx.strokeStyle = "#e0e0e0";
			ctx.lineWidth = 1;
			const step = this.tileSize;
			const bounds = this.getBounds();
			for (let x = Math.floor(bounds.minX / step) * step; x <= bounds.maxX; x += step) {
				ctx.beginPath(); ctx.moveTo(x, bounds.minY - step * 2); ctx.lineTo(x, bounds.maxY + step * 2); ctx.stroke();
			}
			for (let y = Math.floor(bounds.minY / step) * step; y <= bounds.maxY; y += step) {
				ctx.beginPath(); ctx.moveTo(bounds.minX - step * 2, y); ctx.lineTo(bounds.maxX + step * 2, y); ctx.stroke();
			}
			ctx.restore();
			for (const tile of this.tiles.values()) tile.draw(ctx);
			if (this.showTileSelection && this.selectedKey && this.tiles.has(this.selectedKey)) {
				const t = this.tiles.get(this.selectedKey);
				ctx.save(); ctx.strokeStyle = "#ffd54f"; ctx.lineWidth = 3; ctx.setLineDash([6,4]); ctx.strokeRect(t.worldX, t.worldY, t.tileSize, t.tileSize); ctx.restore();
			}
			if (this.hoverKey) {
				const [gx, gy] = this.hoverKey.split(',').map(Number);
				const x = gx * this.tileSize, y = gy * this.tileSize;
				ctx.save(); ctx.fillStyle = 'rgba(255,255,0,0.15)'; ctx.fillRect(x, y, this.tileSize, this.tileSize); ctx.restore();
			}
		}
		getBounds() {
			let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
			for (const tile of this.tiles.values()) {
				minX = Math.min(minX, tile.worldX);
				minY = Math.min(minY, tile.worldY);
				maxX = Math.max(maxX, tile.worldX + tile.tileSize);
				maxY = Math.max(maxY, tile.worldY + tile.tileSize);
			}
			return { minX, minY, maxX, maxY };
		}
		refreshNeighbors(gridX, gridY) {
			const dirs = [ {dx:0,dy:0}, {dx:0,dy:-1}, {dx:1,dy:0}, {dx:0,dy:1}, {dx:-1,dy:0} ];
			for (const d of dirs) { this.refreshTileBordersButtons(gridX + d.dx, gridY + d.dy); this.updateTileFlags(gridX + d.dx, gridY + d.dy); }
		}
		refreshTileBordersButtons(gridX, gridY) {
			const key = this.getTileKey(gridX, gridY);
			const tile = this.tiles.get(key);
			if (!tile) return;
			tile.borders = { top: true, right: true, bottom: true, left: true };
			tile.buttons = { top: true, right: true, bottom: true, left: true };
			const dirs = [
				{ dx: 0, dy: -1, border: 'top', opposite: 'bottom' },
				{ dx: 1, dy: 0, border: 'right', opposite: 'left' },
				{ dx: 0, dy: 1, border: 'bottom', opposite: 'top' },
				{ dx: -1, dy: 0, border: 'left', opposite: 'right' }
			];
			for (const d of dirs) {
				const nk = this.getTileKey(gridX + d.dx, gridY + d.dy);
				if (this.tiles.has(nk)) {
					tile.borders[d.border] = false;
					tile.buttons[d.border] = false;
					const n = this.tiles.get(nk);
					n.borders[d.opposite] = false;
					n.buttons[d.opposite] = false;
				}
			}
		}
		updateTileFlags(){ /* no-op for now */ }
		getTileAtWorld(x, y) { const gx = Math.floor(x / this.tileSize); const gy = Math.floor(y / this.tileSize); return this.tiles.get(this.getTileKey(gx, gy)) || null; }
		selectByWorld(x, y) { const t = this.getTileAtWorld(x, y); this.selectedKey = t ? this.getTileKey(t.gridX, t.gridY) : null; return t; }
		removeTileAtWorld(x, y) { const t = this.getTileAtWorld(x, y); if (!t) return false; const { gridX, gridY } = t; this.tiles.delete(this.getTileKey(gridX, gridY)); if (this.selectedKey === this.getTileKey(gridX, gridY)) this.selectedKey = null; this.refreshNeighbors(gridX, gridY); return true; }
	}
	App.Tilemap.Core.Editor = Editor;
})(window);
