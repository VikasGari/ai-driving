class RN_Segment {
    constructor(points, width = 200) {
        this.points = points; // centerline polyline
        this.width = width;
        this.headOptions = { LEFT: true, RIGHT: true, STRAIGHT: true };
    }

    getHead() {
        const n = this.points.length;
        const p1 = this.points[Math.max(0, n - 2)];
        const p2 = this.points[n - 1];
        // Heading is the direction of the last segment (x to the right, y down)
        const heading = Math.atan2(p2.y - p1.y, p2.x - p1.x);
        return { pos: p2, heading };
    }
}

class RoadNetwork {
    constructor(originX, originY, width = 200) {
        this.width = width;
        // initial straight segment pointing up
        this.segments = [new RN_Segment([
            { x: originX, y: originY + 300 },
            { x: originX, y: originY }
        ], width)];
        this.buttonRadius = 14;
        this.extendLen = 200;
        this.turnRadius = 150;
    }

    // Geometry helpers
    makeStraightFrom(head, len) {
        // Forward in canvas coordinates (x = cos, y = sin)
        const dir = { x: Math.cos(head.heading), y: Math.sin(head.heading) };
        const pts = [];
        const steps = 16;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            pts.push({ x: head.pos.x + dir.x * len * t, y: head.pos.y + dir.y * len * t });
        }
        return pts;
    }

    makeQuarterTurn(head, radius, side) {
        // side: -1 left, +1 right; build arc centered at left/right of heading
        const forward = { x: Math.cos(head.heading), y: Math.sin(head.heading) };
        const right = { x: -forward.y, y: forward.x }; // rotate forward by +90°
        const center = add(head.pos, scale(right, side * radius));
        // Start angle from center to head.pos
        const startAngle = Math.atan2(head.pos.y - center.y, head.pos.x - center.x);
        const delta = side * Math.PI / 2; // positive is clockwise in canvas (y down)
        const steps = 20;
        const pts = [];
        for (let i = 1; i <= steps; i++) {
            const a = startAngle + (delta * i) / steps;
            pts.push({ x: center.x + Math.cos(a) * radius, y: center.y + Math.sin(a) * radius });
        }
        return pts;
    }

    makePerpendicularFrom(head, side, len) {
        // side: -1 left, +1 right; create a straight 90° turn starting at the head center
        const perp = {
            x: Math.cos(head.heading + (side < 0 ? -Math.PI / 2 : Math.PI / 2)),
            y: Math.sin(head.heading + (side < 0 ? -Math.PI / 2 : Math.PI / 2)),
        };
        const pts = [];
        const steps = 16;
        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            pts.push({ x: head.pos.x + perp.x * len * t, y: head.pos.y + perp.y * len * t });
        }
        return pts;
    }

    addBranch(segment, type) {
        const head = segment.getHead();
        const created = [];
        const addSeg = (pts) => {
            const newPts = [...segment.points.slice(-1), ...pts];
            const s = new RN_Segment(newPts, this.width);
            this.segments.push(s);
            created.push(s);
        };
        if (type === "LEFT") {
            addSeg(this.makePerpendicularFrom(head, -1, this.extendLen));
        } else if (type === "RIGHT") {
            addSeg(this.makePerpendicularFrom(head, +1, this.extendLen));
        } else if (type === "STRAIGHT") {
            addSeg(this.makeStraightFrom(head, this.extendLen));
        }
        // Disable only the used option; keep others active for T junctions
        if (segment.headOptions[type] !== undefined) {
            segment.headOptions[type] = false;
        }
        return created;
    }

    // Simple hit UI: 6 buttons near each head
    getHeadButtons() {
        const buttons = [];
        for (const seg of this.segments) {
            const head = seg.getHead();
            const pos = head.pos;
            const forward = { x: Math.cos(head.heading), y: Math.sin(head.heading) };
            const right = { x: Math.cos(head.heading + Math.PI / 2), y: Math.sin(head.heading + Math.PI / 2) };
            const left = { x: -right.x, y: -right.y };

            // Forward extend button positioned slightly ahead of head
            if (seg.headOptions.STRAIGHT) {
                const forwardBtnPos = {
                    x: pos.x + forward.x * this.buttonRadius * 3,
                    y: pos.y + forward.y * this.buttonRadius * 3,
                };
                buttons.push({ segment: seg, center: forwardBtnPos, type: "STRAIGHT", icon: "↑" });
            }

            // Left-turn button placed along the left border near the head
            if (seg.headOptions.LEFT) {
                const leftBtnPos = {
                    x: pos.x + left.x * (this.width / 2 + this.buttonRadius * 1.2),
                    y: pos.y + left.y * (this.width / 2 + this.buttonRadius * 1.2),
                };
                buttons.push({ segment: seg, center: leftBtnPos, type: "LEFT", icon: "↰" });
            }

            // Right-turn button placed along the right border near the head
            if (seg.headOptions.RIGHT) {
                const rightBtnPos = {
                    x: pos.x + right.x * (this.width / 2 + this.buttonRadius * 1.2),
                    y: pos.y + right.y * (this.width / 2 + this.buttonRadius * 1.2),
                };
                buttons.push({ segment: seg, center: rightBtnPos, type: "RIGHT", icon: "↱" });
            }
        }
        return buttons;
    }

    handleClick(worldX, worldY) {
        const buttons = this.getHeadButtons();
        for (const b of buttons) {
            const dist = Math.hypot(worldX - b.center.x, worldY - b.center.y);
            if (dist <= this.buttonRadius) {
                this.addBranch(b.segment, b.type);
                return true;
            }
        }
        return false;
    }

    draw(ctx) {
        // Draw segments as constant-width roads using Frenet offsets
        for (const seg of this.segments) {
            if (seg.points.length < 2) continue;
            // compute normals
            const normals = [];
            for (let i = 0; i < seg.points.length; i++) {
                const pPrev = seg.points[Math.max(0, i - 1)];
                const pNext = seg.points[Math.min(seg.points.length - 1, i + 1)];
                const tangent = normalize(subtract(pNext, pPrev));
                const normal = normalize({ x: -tangent.y, y: tangent.x });
                normals.push(normal);
            }
            const half = seg.width / 2;
            const left = [];
            const right = [];
            for (let i = 0; i < seg.points.length; i++) {
                left.push(add(seg.points[i], scale(normals[i], half)));
                right.push(add(seg.points[i], scale(normals[i], -half)));
            }
            // fill road
            ctx.fillStyle = "#777";
            ctx.beginPath();
            ctx.moveTo(right[0].x, right[0].y);
            for (let i = 1; i < right.length; i++) ctx.lineTo(right[i].x, right[i].y);
            for (let i = left.length - 1; i >= 0; i--) ctx.lineTo(left[i].x, left[i].y);
            ctx.fill();

            // lane dashes (center)
            ctx.setLineDash([20, 20]);
            ctx.strokeStyle = "white";
            ctx.lineWidth = 5;
            ctx.beginPath();
            for (let i = 0; i < seg.points.length; i++) {
                const mid = seg.points[i];
                if (i === 0) ctx.moveTo(mid.x, mid.y); else ctx.lineTo(mid.x, mid.y);
            }
            ctx.stroke();
            ctx.setLineDash([]);

            // borders
            ctx.strokeStyle = "#000";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(left[0].x, left[0].y);
            for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(right[0].x, right[0].y);
            for (let i = 1; i < right.length; i++) ctx.lineTo(right[i].x, right[i].y);
            ctx.stroke();

            // head buttons
            const buttons = this.getHeadButtons().filter(b => b.segment === seg);
            for (const b of buttons) {
                ctx.beginPath();
                ctx.arc(b.center.x, b.center.y, this.buttonRadius, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
                ctx.strokeStyle = "rgba(0,0,0,0.5)";
                ctx.lineWidth = 2;
                ctx.stroke();
                // icon
                ctx.fillStyle = "#000";
                ctx.font = `${this.buttonRadius}px Arial`;
                ctx.textAlign = "center";
                ctx.textBaseline = "middle";
                ctx.fillText(b.icon, b.center.x, b.center.y);
            }
        }
    }
}


