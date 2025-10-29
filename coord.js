// Coordinate translator between Cartesian (y up) and Canvas (y down) systems
class Coord {
    // Vectors
    static vecCartToCanvas(v) { return { x: v.x, y: -v.y }; }
    static vecCanvasToCart(v) { return { x: v.x, y: -v.y }; }

    // Angles (radians) w.r.t +x axis; cart: y up, canvas: y down
    static angleCartToCanvas(theta) { return -theta; }
    static angleCanvasToCart(theta) { return -theta; }

    // Unit vector from angle
    static unitFromAngleCart(theta) { return { x: Math.cos(theta), y: Math.sin(theta) }; }
    static unitFromAngleCanvas(theta) { return { x: Math.cos(theta), y: Math.sin(theta) }; }

    // Grid offset mapping (Cart grid up = +y; Canvas grid up = -y)
    static gridOffsetCartToCanvas(off) { return { dx: off.dx, dy: -off.dy }; }
    static gridOffsetCanvasToCart(off) { return { dx: off.dx, dy: -off.dy }; }

    // Snap an angle to the nearest cardinal direction index (0:up,1:right,2:down,3:left) in Cartesian frame
    static snapAngleToCardinalIndexCart(theta) {
        // normalize to [0, 2pi)
        let a = ((theta % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
        // map to closest of 0, pi/2, pi, 3pi/2
        const quarter = Math.PI / 2;
        const idx = Math.round(a / quarter) % 4;
        return idx;
    }

    static cardinalIndexToAngleCart(idx) { return (idx % 4) * (Math.PI / 2); }

    // Cardinal unit vectors in Cartesian
    static cardinalUnitCart(idx) {
        const i = ((idx % 4) + 4) % 4;
        return [
            { x: 1, y: 0 },   // 0: +x (east)
            { x: 0, y: 1 },   // 1: +y (north)
            { x: -1, y: 0 },  // 2: -x (west)
            { x: 0, y: -1 },  // 3: -y (south)
        ][i];
    }

    // For UI arrows mapping index to arrow in Canvas sense (up/down flipped)
    static arrowForCardinalCanvas(idxCart) {
        // Convert Cart cardinal to Canvas arrow glyphs
        // In Cartesian: 1:+y is up; in Canvas up arrow should be '↑' for -y canvas.
        const map = ['→','↑','←','↓']; // 0:east,1:north,2:west,3:south
        const i = ((idxCart % 4) + 4) % 4;
        return map[i];
    }
}


