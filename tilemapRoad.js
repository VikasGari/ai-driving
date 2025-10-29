class RoadTile {
    constructor(gridX, gridY, tileSize = 60, baseOrientationAngle = 0) {
        this.gridX = gridX;
        this.gridY = gridY;
        this.tileSize = tileSize;
        this.worldX = gridX * tileSize;
        this.worldY = gridY * tileSize;
        // baseOrientationAngle: radians relative to global 0° (upwards in canvas: 0,-1)
        this.baseOrientationAngle = baseOrientationAngle; // multiples of Math.PI/2
        this.borders = { top: true, right: true, bottom: true, left: true };
        // four-direction buttons; bottom typically used for back-extend
        this.buttons = { top: true, right: true, bottom: true, left: true };
        // flags
        this.isLShape = false;
        this.isTurn = false;
    }

    getCenter() {
        return {
            x: this.worldX + this.tileSize / 2,
            y: this.worldY + this.tileSize / 2
        };
    }

    // Local axes given base orientation
    getLocalDirs() {
        const idx = Coord.snapAngleToCardinalIndexCart(this.baseOrientationAngle);
        // Define forward exactly as base orientation
        const fIdx = idx;
        // Right turn is -90°, left is +90° in Cartesian
        const rIdx = (fIdx + 3) % 4;
        const lIdx = (fIdx + 1) % 4;
        const bIdx = (fIdx + 2) % 4;
        const fCart = Coord.cardinalUnitCart(fIdx);
        const rCart = Coord.cardinalUnitCart(rIdx);
        const bCart = Coord.cardinalUnitCart(bIdx);
        const lCart = Coord.cardinalUnitCart(lIdx);
        return { fCart, rCart, bCart, lCart, fIdx };
    }

    // Compute button data with icons and next tile base angles; physical canvas directions
    getButtons(editor) {
        const center = this.getCenter();
        const halfSize = this.tileSize / 2;
        const buttonOffset = halfSize + 8; // buttons outside the tile
        // Physical directions in Canvas with corresponding Cartesian orientation angles
        const dirs = [
            { key: 'top', vCanvas: { x: 0, y: -1 }, nextAngle: Math.PI / 2, icon: '↑' },    // north
            { key: 'right', vCanvas: { x: 1, y: 0 }, nextAngle: 0, icon: '→' },             // east
            { key: 'bottom', vCanvas: { x: 0, y: 1 }, nextAngle: 3 * Math.PI / 2, icon: '↓' }, // south
            { key: 'left', vCanvas: { x: -1, y: 0 }, nextAngle: Math.PI, icon: '←' },       // west
        ];

        return dirs.map(d => {
            const bx = center.x + d.vCanvas.x * buttonOffset;
            const by = center.y + d.vCanvas.y * buttonOffset;
            const gdx = this.gridX + d.vCanvas.x;
            const gdy = this.gridY + d.vCanvas.y;
            const neighborExists = !!editor.tiles.get(editor.getTileKey(gdx, gdy));
            const active = this.buttons[d.key] && !neighborExists;
            return { key: d.key, x: bx, y: by, active, icon: d.icon, nextAngle: d.nextAngle, gridX: gdx, gridY: gdy };
        });
    }

    draw(ctx) {
        // Draw tile background
        ctx.fillStyle = "#777";
        ctx.fillRect(this.worldX, this.worldY, this.tileSize, this.tileSize);

        // Draw lane dividers based on orientation (hidden for intersections/turn hubs)
        ctx.strokeStyle = "white";
        ctx.lineWidth = 2;
        ctx.setLineDash([8, 8]);
        const laneWidth = this.tileSize / 3;
        if (!this.isTurn) {
            const idx = Coord.snapAngleToCardinalIndexCart(this.baseOrientationAngle);
            if (idx === 0 || idx === 2) {
                // road runs east/west → lane dividers horizontal
                for (let i = 1; i < 3; i++) {
                    const y = this.worldY + laneWidth * i;
                    ctx.beginPath();
                    ctx.moveTo(this.worldX, y);
                    ctx.lineTo(this.worldX + this.tileSize, y);
                    ctx.stroke();
                }
            } else {
                // road runs north/south → lane dividers vertical
                for (let i = 1; i < 3; i++) {
                    const x = this.worldX + laneWidth * i;
                    ctx.beginPath();
                    ctx.moveTo(x, this.worldY);
                    ctx.lineTo(x, this.worldY + this.tileSize);
                    ctx.stroke();
                }
            }
        }
        ctx.setLineDash([]);

        // Draw borders
        ctx.strokeStyle = "#000";
        ctx.lineWidth = 3;
        ctx.beginPath();
        
        if (this.borders.top) {
            ctx.moveTo(this.worldX, this.worldY);
            ctx.lineTo(this.worldX + this.tileSize, this.worldY);
        }
        if (this.borders.right) {
            ctx.moveTo(this.worldX + this.tileSize, this.worldY);
            ctx.lineTo(this.worldX + this.tileSize, this.worldY + this.tileSize);
        }
        if (this.borders.bottom) {
            ctx.moveTo(this.worldX + this.tileSize, this.worldY + this.tileSize);
            ctx.lineTo(this.worldX, this.worldY + this.tileSize);
        }
        if (this.borders.left) {
            ctx.moveTo(this.worldX, this.worldY + this.tileSize);
            ctx.lineTo(this.worldX, this.worldY);
        }
        ctx.stroke();

        // Draw buttons (four directions) only if editor.showButtons is true
        const editor = window.__tileEditorRef || null;
        if (editor && editor.showButtons) {
            let buttons = this.getButtons(editor);
            // If base tile: only allow base forward button
            if (editor.baseKey === editor.getTileKey(this.gridX, this.gridY)) {
                buttons = buttons.filter(b => b.key === editor.baseForwardDir);
            }
            const buttonRadius = 8;
            for (const b of buttons) {
                if (!b.active) continue;
                ctx.beginPath();
                ctx.arc(b.x, b.y, buttonRadius, 0, Math.PI * 2);
                ctx.fillStyle = "#fff";
                ctx.fill();
                ctx.strokeStyle = "#000";
                ctx.lineWidth = 2;
                ctx.stroke();
                ctx.fillStyle = "#000";
                ctx.font = "12px Arial";
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(b.icon, b.x, b.y);
            }
        }
    }
}

class TilemapRoadEditor {
    constructor(tileSize = 60) {
        this.tileSize = tileSize;
        this.tiles = new Map(); // key: "x,y" -> RoadTile
        this.buttonRadius = 8;
        // expose self for tile draw neighbor checks
        window.__tileEditorRef = this;
        this.selectedKey = null;
        this.showButtons = true;
        this.showTileSelection = true;
        this.baseKey = null;
        this.baseForwardDir = 'top';

        // Start with one tile at origin
        this.addTile(0, 0, 0);
        this.baseKey = this.getTileKey(0, 0);
        this.updateBaseForwardFromTile();
    }

    getTileKey(x, y) {
        return `${x},${y}`;
    }

    addTile(gridX, gridY, baseOrientationAngle = 0) {
        const key = this.getTileKey(gridX, gridY);
        if (this.tiles.has(key)) return null;
        
        const tile = new RoadTile(gridX, gridY, this.tileSize, baseOrientationAngle);
        this.tiles.set(key, tile);
        
        // Recompute borders/buttons for this tile and neighbors
        this.refreshTileAndNeighbors(gridX, gridY);
        this.updateTileFlags(gridX, gridY);
        
        return tile;
    }

    updateAdjacentBorders(centerX, centerY) {
        const directions = [
            // border = center tile border to remove; oppositeBorder = neighbor border to remove
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
                
                // Remove shared borders: center's facing border and neighbor's opposite border
                center.borders[dir.border] = false;
                neighbor.borders[dir.oppositeBorder] = false;
                
                // Disable buttons between adjacent tiles
                if (dir.dx === 0 && dir.dy === -1) { // top neighbor
                    neighbor.buttons.bottom = false;
                    center.buttons.top = false;
                } else if (dir.dx === 1 && dir.dy === 0) { // right neighbor
                    neighbor.buttons.left = false;
                    center.buttons.right = false;
                } else if (dir.dx === 0 && dir.dy === 1) { // bottom neighbor
                    neighbor.buttons.top = false;
                    center.buttons.bottom = false;
                } else if (dir.dx === -1 && dir.dy === 0) { // left neighbor
                    neighbor.buttons.right = false;
                    center.buttons.left = false;
                }
            }
        }
    }

    handleClick(worldX, worldY) {
        // Build a list of all active buttons with distances
        const candidates = [];
        for (const tile of this.tiles.values()) {
            const btns = tile.getButtons(this);
            for (const b of btns) {
                if (!b.active) continue;
                const dist = Math.hypot(worldX - b.x, worldY - b.y);
                candidates.push({ tile, btn: b, dist });
            }
        }
        if (candidates.length === 0) return false;
        // Pick the closest button to the click
        candidates.sort((a, b) => a.dist - b.dist);
        const chosen = candidates[0];
        if (chosen.dist > this.buttonRadius) return false;

        const b = chosen.btn;
        this.addTile(b.gridX, b.gridY, b.nextAngle);
        // Select the newly added tile
        this.selectedKey = this.getTileKey(b.gridX, b.gridY);
        return true;
    }

    draw(ctx) {
        // Grid background
        ctx.save();
        ctx.strokeStyle = "#e0e0e0";
        ctx.lineWidth = 1;
        const step = this.tileSize;
        const bounds = this.getBounds();
        for (let x = Math.floor(bounds.minX / step) * step; x <= bounds.maxX; x += step) {
            ctx.beginPath();
            ctx.moveTo(x, bounds.minY - step * 2);
            ctx.lineTo(x, bounds.maxY + step * 2);
            ctx.stroke();
        }
        for (let y = Math.floor(bounds.minY / step) * step; y <= bounds.maxY; y += step) {
            ctx.beginPath();
            ctx.moveTo(bounds.minX - step * 2, y);
            ctx.lineTo(bounds.maxX + step * 2, y);
            ctx.stroke();
        }
        ctx.restore();

        for (const tile of this.tiles.values()) {
            tile.draw(ctx);
        }

        // Highlight selected tile only when selection enabled
        if (this.showTileSelection && this.selectedKey && this.tiles.has(this.selectedKey)) {
            const t = this.tiles.get(this.selectedKey);
            ctx.save();
            ctx.strokeStyle = "#ffd54f";
            ctx.lineWidth = 3;
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(t.worldX, t.worldY, t.tileSize, t.tileSize);
            ctx.restore();
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

    // Save map to JSON string
    saveMap() {
        const mapData = {
            tileSize: this.tileSize,
            baseKey: this.baseKey,
            baseForwardDir: this.baseForwardDir,
            tiles: []
        };
        
        for (const tile of this.tiles.values()) {
            mapData.tiles.push({
                gridX: tile.gridX,
                gridY: tile.gridY,
                baseOrientationAngle: tile.baseOrientationAngle,
                borders: { ...tile.borders },
                buttons: { ...tile.buttons },
                isLShape: tile.isLShape,
                isTurn: tile.isTurn
            });
        }
        
        return JSON.stringify(mapData, null, 2);
    }

    // Load map from JSON string
    loadMap(jsonString) {
        try {
            const mapData = JSON.parse(jsonString);
            
            // Clear existing tiles
            this.tiles.clear();
            this.selectedKey = null;
            
            // Restore properties
            this.tileSize = mapData.tileSize || 60;
            this.baseKey = mapData.baseKey || null;
            this.baseForwardDir = mapData.baseForwardDir || 'right';
            
            // Restore tiles
            for (const tileData of mapData.tiles) {
                const tile = new RoadTile(
                    tileData.gridX,
                    tileData.gridY,
                    this.tileSize,
                    tileData.baseOrientationAngle || 0
                );
                
                // Restore properties
                tile.borders = { ...tileData.borders };
                tile.buttons = { ...tileData.buttons };
                tile.isLShape = tileData.isLShape || false;
                tile.isTurn = tileData.isTurn || false;
                
                this.tiles.set(this.getTileKey(tile.gridX, tile.gridY), tile);
            }
            
            // Update adjacent borders and tile flags
            for (const tile of this.tiles.values()) {
                this.updateAdjacentBorders(tile.gridX, tile.gridY);
                this.updateTileFlags(tile.gridX, tile.gridY);
            }
            
            return true;
        } catch (error) {
            console.error('Failed to load map:', error);
            return false;
        }
    }

    // Download map as file
    downloadMap(filename = 'map.json') {
        const mapJson = this.saveMap();
        const blob = new Blob([mapJson], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    // Load map from file input
    loadMapFromFile(file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const success = this.loadMap(e.target.result);
            if (success) {
                console.log('Map loaded successfully');
                // Trigger UI update if needed
                if (window.updateTilePropsUI) {
                    window.updateTilePropsUI();
                }
            } else {
                alert('Failed to load map. Please check the file format.');
            }
        };
        reader.readAsText(file);
    }

    updateTileFlags(gridX, gridY) {
        const tile = this.tiles.get(this.getTileKey(gridX, gridY));
        if (!tile) return;
        // Determine active buttons (no neighbor present and button not manually disabled)
        const btns = tile.getButtons(this);
        const active = {
            top: !!btns.find(b => b.key === 'top' && b.active),
            right: !!btns.find(b => b.key === 'right' && b.active),
            bottom: !!btns.find(b => b.key === 'bottom' && b.active),
            left: !!btns.find(b => b.key === 'left' && b.active),
        };
        const activeCount = Object.values(active).filter(Boolean).length;
        const twoAdjacent = (
            (active.top && active.right) ||
            (active.right && active.bottom) ||
            (active.bottom && active.left) ||
            (active.left && active.top)
        );
        tile.isLShape = activeCount === 2 && twoAdjacent;
        tile.isTurn = tile.isLShape || activeCount <= 1;
    }

    // New: selection helpers
    getTileAtWorld(x, y) {
        const gx = Math.floor(x / this.tileSize);
        const gy = Math.floor(y / this.tileSize);
        const key = this.getTileKey(gx, gy);
        return this.tiles.get(key) || null;
    }

    selectByWorld(x, y) {
        const t = this.getTileAtWorld(x, y);
        this.selectedKey = t ? this.getTileKey(t.gridX, t.gridY) : null;
        return t;
    }

    removeTileAtWorld(x, y) {
        const t = this.getTileAtWorld(x, y);
        if (!t) return false;
        const { gridX, gridY } = t;
        this.tiles.delete(this.getTileKey(gridX, gridY));
        if (this.selectedKey === this.getTileKey(gridX, gridY)) this.selectedKey = null;
        // Refresh neighbors around removed tile
        this.refreshNeighbors(gridX, gridY);
        return true;
    }

    // Recompute borders/buttons for a tile based on current neighbors
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

    refreshNeighbors(gridX, gridY) {
        const dirs = [ {dx:0,dy:0}, {dx:0,dy:-1}, {dx:1,dy:0}, {dx:0,dy:1}, {dx:-1,dy:0} ];
        for (const d of dirs) {
            this.refreshTileBordersButtons(gridX + d.dx, gridY + d.dy);
            this.updateTileFlags(gridX + d.dx, gridY + d.dy);
        }
    }

    refreshTileAndNeighbors(gridX, gridY) {
        this.refreshNeighbors(gridX, gridY);
    }

    updateBaseForwardFromTile() {
        if (!this.baseKey || !this.tiles.has(this.baseKey)) return;
        const t = this.tiles.get(this.baseKey);
        const idx = Coord.snapAngleToCardinalIndexCart(t.baseOrientationAngle);
        // Map idx to button key: 0:east->right,1:north->top,2:west->left,3:south->bottom
        const map = ['right','top','left','bottom'];
        this.baseForwardDir = map[idx];
    }
}
