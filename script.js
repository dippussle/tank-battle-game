const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menuOverlay = document.getElementById('menu-overlay');
const winnerOverlay = document.getElementById('winner-overlay');
const winnerMessage = document.getElementById('winner-message');

// Game constants
const CELL_SIZE = 60; // Reduced for "smaller" map
const ROWS = 9;
const COLS = 9;
const WALL_THICKNESS = 4;
const TANK_SIZE = 20; // Proportional to cell size
const BULLET_RADIUS = 3;
const BULLET_SPEED = 3.5;
const MAX_BOUNCES = 1000;
const BULLET_LIFESPAN = 5000;
const POWERUP_SPAWN_INTERVAL = [15000, 20000]; // 15-20 seconds
const POWERUP_SIZE = 30;

canvas.width = COLS * CELL_SIZE;
canvas.height = ROWS * CELL_SIZE;

const COLORS = {
    P1: '#FF5252',
    P2: '#448AFF',
    P3: '#4CAF50',
    P4: '#FFEB3B',
    WALL: '#000000',
    GROUND: '#EEEEEE'
};
let portals = { blue: null, orange: null };

// Input state
const keys = {};
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

// Joystick Class
class Joystick {
    constructor(containerId, onChange) {
        this.container = document.getElementById(containerId);
        if (!this.container) return;
        if (this.container._joystick) return this.container._joystick;
        this.container._joystick = this;

        this.knob = document.createElement('div');
        this.knob.className = 'joystick-knob';
        this.container.appendChild(this.knob);

        this.active = false;
        this.origin = { x: 0, y: 0 };
        this.input = { x: 0, y: 0 };
        this.onChange = onChange;

        const handleStart = (e) => this.start(e.touches ? e.touches[0] : e);
        const handleMove = (e) => this.move(e.touches ? e.touches[0] : e);
        const handleEnd = () => this.end();

        this.container.addEventListener('touchstart', (e) => { e.preventDefault(); handleStart(e); }, { passive: false });
        this.container.addEventListener('mousedown', handleStart);

        window.addEventListener('touchmove', handleMove, { passive: false });
        window.addEventListener('mousemove', handleMove);

        window.addEventListener('touchend', handleEnd);
        window.addEventListener('mouseup', handleEnd);
    }

    start(e) {
        this.active = true;
        const rect = this.container.getBoundingClientRect();
        this.origin = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        this.move(e);
    }

    move(e) {
        if (!this.active) return;
        const dx = e.clientX - this.origin.x;
        const dy = e.clientY - this.origin.y;
        const dist = Math.min(60, Math.sqrt(dx * dx + dy * dy));
        const angle = Math.atan2(dy, dx);

        const x = Math.cos(angle) * dist;
        const y = Math.sin(angle) * dist;

        this.knob.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

        this.input = { x: x / 60, y: y / 60 };
        if (this.onChange) this.onChange(this.input);
    }

    end() {
        if (!this.active) return;
        this.active = false;
        this.knob.style.transform = `translate(-50%, -50%)`;
        this.input = { x: 0, y: 0 };
        if (this.onChange) this.onChange(this.input);
    }
}

// Maze Class
class Maze {
    constructor(rows, cols) {
        this.rows = rows;
        this.cols = cols;
        this.cells = Array(rows).fill().map(() => Array(cols).fill().map(() => ({
            visited: false,
            walls: { top: true, right: true, bottom: true, left: true }
        })));
        this.generate();
    }

    generate() {
        const stack = [];
        let current = { r: 0, c: 0 };
        this.cells[0][0].visited = true;

        const getUnvisitedNeighbors = (r, c) => {
            const neighbors = [];
            if (r > 0 && !this.cells[r - 1][c].visited) neighbors.push({ r: r - 1, c: c, dir: 'top' });
            if (r < this.rows - 1 && !this.cells[r + 1][c].visited) neighbors.push({ r: r + 1, c: c, dir: 'bottom' });
            if (c > 0 && !this.cells[r][c - 1].visited) neighbors.push({ r: r, c: c - 1, dir: 'left' });
            if (c < this.cols - 1 && !this.cells[r][c + 1].visited) neighbors.push({ r: r, c: c + 1, dir: 'right' });
            return neighbors;
        };

        while (true) {
            const neighbors = getUnvisitedNeighbors(current.r, current.c);
            if (neighbors.length > 0) {
                const next = neighbors[Math.floor(Math.random() * neighbors.length)];

                // Remove walls
                if (next.dir === 'top') {
                    this.cells[current.r][current.c].walls.top = false;
                    this.cells[next.r][next.c].walls.bottom = false;
                } else if (next.dir === 'bottom') {
                    this.cells[current.r][current.c].walls.bottom = false;
                    this.cells[next.r][next.c].walls.top = false;
                } else if (next.dir === 'left') {
                    this.cells[current.r][current.c].walls.left = false;
                    this.cells[next.r][next.c].walls.right = false;
                } else if (next.dir === 'right') {
                    this.cells[current.r][current.c].walls.right = false;
                    this.cells[next.r][next.c].walls.left = false;
                }

                this.cells[next.r][next.c].visited = true;
                stack.push(current);
                current = { r: next.r, c: next.c };
            } else if (stack.length > 0) {
                current = stack.pop();
            } else {
                break;
            }
        }

        // Add some random holes to make it less restrictive
        for (let i = 0; i < (this.rows * this.cols) / 5; i++) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);
            const walls = Object.keys(this.cells[r][c].walls);
            const wall = walls[Math.floor(Math.random() * walls.length)];

            if (wall === 'top' && r > 0) {
                this.cells[r][c].walls.top = false;
                this.cells[r - 1][c].walls.bottom = false;
            } else if (wall === 'bottom' && r < this.rows - 1) {
                this.cells[r][c].walls.bottom = false;
                this.cells[r + 1][c].walls.top = false;
            } else if (wall === 'left' && c > 0) {
                this.cells[r][c].walls.left = false;
                this.cells[r][c - 1].walls.right = false;
            } else if (wall === 'right' && c < this.cols - 1) {
                this.cells[r][c].walls.right = false;
                this.cells[r][c + 1].walls.left = false;
            }
        }
    }

    draw() {
        ctx.strokeStyle = COLORS.WALL;
        ctx.lineWidth = WALL_THICKNESS;
        ctx.lineCap = 'round';

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const x = c * CELL_SIZE;
                const y = r * CELL_SIZE;
                const walls = this.cells[r][c].walls;

                if (walls.top) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x + CELL_SIZE, y);
                    ctx.stroke();
                }
                if (walls.right) {
                    ctx.beginPath();
                    ctx.moveTo(x + CELL_SIZE, y);
                    ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE);
                    ctx.stroke();
                }
                if (walls.bottom) {
                    ctx.beginPath();
                    ctx.moveTo(x, y + CELL_SIZE);
                    ctx.lineTo(x + CELL_SIZE, y + CELL_SIZE);
                    ctx.stroke();
                }
                if (walls.left) {
                    ctx.beginPath();
                    ctx.moveTo(x, y);
                    ctx.lineTo(x, y + CELL_SIZE);
                    ctx.stroke();
                }
            }
        }
    }

    getRandomEmptyCell() {
        // Find a cell that doesn't have a tank or powerup (simple version: just random cell)
        const r = Math.floor(Math.random() * ROWS);
        const c = Math.floor(Math.random() * COLS);
        return {
            x: c * CELL_SIZE + CELL_SIZE / 2,
            y: r * CELL_SIZE + CELL_SIZE / 2
        };
    }

    checkWallCollision(x, y, radius) {
        const margin = radius + WALL_THICKNESS / 2;
        const rSq = radius * radius;
        const distSq = (x1, y1, x2, y2) => (x1 - x2) ** 2 + (y1 - y2) ** 2;

        const startC = Math.floor((x - margin) / CELL_SIZE);
        const endC = Math.floor((x + margin) / CELL_SIZE);
        const startR = Math.floor((y - margin) / CELL_SIZE);
        const endR = Math.floor((y + margin) / CELL_SIZE);

        for (let r = startR; r <= endR; r++) {
            for (let c = startC; c <= endC; c++) {
                if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) {
                    if (x < margin || x > this.cols * CELL_SIZE - margin || y < margin || y > this.rows * CELL_SIZE - margin) return true;
                    continue;
                }
                const cell = this.cells[r][c];
                const cx = c * CELL_SIZE;
                const cy = r * CELL_SIZE;

                // Segment checks
                if (cell.walls.top && Math.abs(y - cy) < margin && x >= cx && x <= cx + CELL_SIZE) return true;
                if (cell.walls.bottom && Math.abs(y - (cy + CELL_SIZE)) < margin && x >= cx && x <= cx + CELL_SIZE) return true;
                if (cell.walls.left && Math.abs(x - cx) < margin && y >= cy && y <= cy + CELL_SIZE) return true;
                if (cell.walls.right && Math.abs(x - (cx + CELL_SIZE)) < margin && y >= cy && y <= cy + CELL_SIZE) return true;

                // Vertex checks (Only if a wall meets at this junction)
                if (cell.walls.top || cell.walls.left) if (distSq(x, y, cx, cy) < rSq) return true;
                if (cell.walls.top || cell.walls.right) if (distSq(x, y, cx + CELL_SIZE, cy) < rSq) return true;
                if (cell.walls.bottom || cell.walls.left) if (distSq(x, y, cx, cy + CELL_SIZE) < rSq) return true;
                if (cell.walls.bottom || cell.walls.right) if (distSq(x, y, cx + CELL_SIZE, cy + CELL_SIZE) < rSq) return true;
            }
        }
        return false;
    }

    findPath(startX, startY, endX, endY) {
        const startC = Math.floor(startX / CELL_SIZE);
        const startR = Math.floor(startY / CELL_SIZE);
        const endC = Math.floor(endX / CELL_SIZE);
        const endR = Math.floor(endY / CELL_SIZE);

        if (startC === endC && startR === endR) return null;

        const queue = [[{ r: startR, c: startC }]];
        const visited = new Set([`${startR},${startC}`]);

        while (queue.length > 0) {
            const path = queue.shift();
            const current = path[path.length - 1];

            if (current.r === endR && current.c === endC) {
                // Return waypoints as pixel centers
                return path.map(p => ({
                    x: p.c * CELL_SIZE + CELL_SIZE / 2,
                    y: p.r * CELL_SIZE + CELL_SIZE / 2
                }));
            }

            const cell = this.cells[current.r][current.c];
            const neighbors = [];
            if (!cell.walls.top && current.r > 0) neighbors.push({ r: current.r - 1, c: current.c });
            if (!cell.walls.bottom && current.r < ROWS - 1) neighbors.push({ r: current.r + 1, c: current.c });
            if (!cell.walls.left && current.c > 0) neighbors.push({ r: current.r, c: current.c - 1 });
            if (!cell.walls.right && current.c < COLS - 1) neighbors.push({ r: current.r, c: current.c + 1 });

            for (let next of neighbors) {
                const key = `${next.r},${next.c}`;
                if (!visited.has(key)) {
                    visited.add(key);
                    queue.push([...path, next]);
                }
            }
        }
        return null; // No path
    }
}

// Bullet Class
class Bullet {
    constructor(x, y, angle, color, owner, type = 'normal') {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.color = color;
        this.owner = owner;
        this.type = type; // 'normal', 'homing', 'ghost'
        this.vx = Math.cos(angle) * BULLET_SPEED;
        this.vy = Math.sin(angle) * BULLET_SPEED;
        this.bounces = 0;
        this.birth = Date.now();
        this.active = true;
        this.homingStart = Date.now() + 2500; // Reduced to 2.5s
        this.homingEnd = Date.now() + 20000;
        this.path = [];
        this.lastPathUpdate = 0;
        this.thrust = 0.1; // For wireless control
    }

    update(maze, tanks) {
        if (!this.active) return;

        const now = Date.now();
        const life = this.type === 'homing' ? 20000 : BULLET_LIFESPAN;
        if (now - this.birth > life) {
            this.active = false;
            return;
        }

        // Homing Logic (Pathfinding-based)
        if (this.type === 'homing' && now > this.homingStart && now < this.homingEnd) {
            const enemies = tanks.filter(t => t.alive && t.id !== this.owner);
            if (enemies.length > 0) {
                // Find nearest enemy
                const target = enemies.reduce((prev, curr) => {
                    const dPrev = (prev.x - this.x) ** 2 + (prev.y - this.y) ** 2;
                    const dCurr = (curr.x - this.x) ** 2 + (curr.y - this.y) ** 2;
                    return dCurr < dPrev ? curr : prev;
                });

                // Update path every 300ms
                if (now - this.lastPathUpdate > 300) {
                    this.path = maze.findPath(this.x, this.y, target.x, target.y) || [];
                    this.lastPathUpdate = now;
                }

                // Follow path waypoints with lookahead
                let targetPos = target;
                if (this.path && this.path.length > 1) {
                    // Lookahead: if close to path[1], target path[2]
                    const dNextSq = (this.path[1].x - this.x) ** 2 + (this.path[1].y - this.y) ** 2;
                    if (dNextSq < (CELL_SIZE * 0.5) ** 2 && this.path.length > 2) {
                        targetPos = this.path[2];
                    } else {
                        targetPos = this.path[1];
                    }
                }

                const targetAngle = Math.atan2(targetPos.y - this.y, targetPos.x - this.x);
                let diff = targetAngle - this.angle;
                while (diff < -Math.PI) diff += Math.PI * 2;
                while (diff > Math.PI) diff -= Math.PI * 2;

                this.angle += diff * 0.15; // Sharper steering
                this.vx = Math.cos(this.angle) * BULLET_SPEED;
                this.vy = Math.sin(this.angle) * BULLET_SPEED;
            }
        }

        // Wireless Logic (Joystick controlled)
        if (this.type === 'wireless') {
            const ownerTank = tanks.find(t => t.id === this.owner);
            if (ownerTank) {
                let inputX = 0, inputY = 0;

                // Get input from owner (Joystick or Keys)
                if (ownerTank.joystickInput.x !== 0 || ownerTank.joystickInput.y !== 0) {
                    inputX = ownerTank.joystickInput.x;
                    inputY = ownerTank.joystickInput.y;
                } else {
                    if (keys[ownerTank.controls.left]) inputX = -1;
                    if (keys[ownerTank.controls.right]) inputX = 1;
                    if (keys[ownerTank.controls.up]) inputY = -1;
                    if (keys[ownerTank.controls.down]) inputY = 1;
                }

                if (inputX !== 0 || inputY !== 0) {
                    const targetAngle = Math.atan2(inputY, inputX);
                    let diff = targetAngle - this.angle;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;
                    this.angle += diff * 0.1;
                }

                // Constant forward motion
                this.vx = Math.cos(this.angle) * BULLET_SPEED * 1.2;
                this.vy = Math.sin(this.angle) * BULLET_SPEED * 1.2;
            }
        }

        // Ghost Laser Logic (Curving towards NEAR enemy)
        if (this.type === 'ghost') {
            const enemies = tanks.filter(t => t.alive && t.id !== this.owner);
            if (enemies.length > 0) {
                // Find NEAREST enemy
                const target = enemies.reduce((prev, curr) => {
                    const dPrev = (prev.x - this.x) ** 2 + (prev.y - this.y) ** 2;
                    const dCurr = (curr.x - this.x) ** 2 + (curr.y - this.y) ** 2;
                    return dCurr < dPrev ? curr : prev;
                });

                const dist = Math.sqrt((target.x - this.x) ** 2 + (target.y - this.y) ** 2);
                if (dist < 400) { // Only curve if within range
                    const targetAngle = Math.atan2(target.y - this.y, target.x - this.x);
                    let diff = targetAngle - this.angle;
                    while (diff < -Math.PI) diff += Math.PI * 2;
                    while (diff > Math.PI) diff -= Math.PI * 2;

                    // Only curve if target is roughly "in front" (within ~60 deg)
                    if (Math.abs(diff) < Math.PI / 3) {
                        this.angle += diff * 0.03;
                        this.vx = Math.cos(this.angle) * BULLET_SPEED;
                        this.vy = Math.sin(this.angle) * BULLET_SPEED;
                    }
                }
            }
        }

        const nextX = this.x + this.vx;
        const nextY = this.y + this.vy;

        // Ghost Laser ignores walls
        if (this.type === 'ghost') {
            this.x = nextX;
            this.y = nextY;
            // Screen boundary check
            if (this.x < 0 || this.x > canvas.width || this.y < 0 || this.y > canvas.height) {
                this.active = false;
            }
            return;
        }

        // Ricochet check (Normal & Homing)
        const c = Math.floor(nextX / CELL_SIZE);
        const r = Math.floor(nextY / CELL_SIZE);

        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
            this.active = false;
            return;
        }

        const cell = maze.cells[r][c];
        const cx = c * CELL_SIZE;
        const cy = r * CELL_SIZE;
        const m = BULLET_RADIUS + WALL_THICKNESS / 2;

        let bounced = false;
        if (cell.walls.top && nextY < cy + m && this.vy < 0) { this.vy *= -1; bounced = true; }
        else if (cell.walls.bottom && nextY > cy + CELL_SIZE - m && this.vy > 0) { this.vy *= -1; bounced = true; }

        if (cell.walls.left && nextX < cx + m && this.vx < 0) { this.vx *= -1; bounced = true; }
        else if (cell.walls.right && nextX > cx + CELL_SIZE - m && this.vx > 0) { this.vx *= -1; bounced = true; }

        if (bounced) {
            this.bounces++;
            this.angle = Math.atan2(this.vy, this.vx);

            // Portal Gun Logic: Create portal on hit
            if (this.type === 'portal_blue' || this.type === 'portal_orange') {
                const wallNormal = { x: 0, y: 0 };
                if (cell.walls.top && nextY < cy + m) wallNormal.y = 1;
                else if (cell.walls.bottom && nextY > cy + CELL_SIZE - m) wallNormal.y = -1;
                else if (cell.walls.left && nextX < cx + m) wallNormal.x = 1;
                else if (cell.walls.right && nextX > cx + CELL_SIZE - m) wallNormal.x = -1;

                const portalObj = { x: this.x, y: this.y, nx: wallNormal.x, ny: wallNormal.y };
                if (this.type === 'portal_blue') portals.blue = portalObj;
                else portals.orange = portalObj;

                this.active = false; // Portal bullet dies on hit
                return;
            }
        }

        // Apply Time Warp Slowdown (if inside any tank's field)
        let speedMult = 1.0;
        tanks.forEach(t => {
            if (t.timeWarpActiveUntil > now && t.id !== this.owner) {
                const d = Math.sqrt((this.x - t.x) ** 2 + (this.y - t.y) ** 2);
                if (d < TANK_SIZE * 3) speedMult = 0.4;
            }
        });

        this.x += this.vx * speedMult;
        this.y += this.vy * speedMult;

        // Portal Teleportation Check
        if (portals.blue && portals.orange) {
            const checkPortal = (pIn, pOut) => {
                const d = Math.sqrt((this.x - pIn.x) ** 2 + (this.y - pIn.y) ** 2);
                if (d < 15) {
                    // Teleport to pOut
                    this.x = pOut.x + pOut.nx * 20; // Offset from wall
                    this.y = pOut.y + pOut.ny * 20;
                    // Reset birth to prevent instant death if lifespan is short? No, keep it.
                    // Flip velocity if exiting from same normal direction? 
                    // Actually, let's just keep speed and angle but ensure it moves away from wall.
                    if (pOut.nx !== 0) this.vx = Math.abs(this.vx) * pOut.nx;
                    if (pOut.ny !== 0) this.vy = Math.abs(this.vy) * pOut.ny;
                    this.angle = Math.atan2(this.vy, this.vx);
                }
            };
            checkPortal(portals.blue, portals.orange);
            checkPortal(portals.orange, portals.blue);
        }
    }

    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.fillStyle = this.type === 'ghost' ? '#ff00ff' : (this.type === 'homing' ? '#ff8800' : (this.type === 'wireless' ? '#00e5ff' : this.color));

        if (this.type === 'ghost') {
            ctx.shadowBlur = 10;
            ctx.shadowColor = '#ff00ff';
        } else if (this.type === 'homing') {
            ctx.shadowBlur = 5;
            ctx.shadowColor = '#ff8800';
        } else if (this.type === 'wireless') {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00e5ff';
        } else {
            ctx.shadowBlur = 5;
            ctx.shadowColor = this.color;
        }

        ctx.beginPath();
        if (this.type === 'wireless') {
            // Triangle/Missile shape
            ctx.translate(this.x, this.y);
            ctx.rotate(this.angle);
            ctx.moveTo(8, 0);
            ctx.lineTo(-6, 5);
            ctx.lineTo(-6, -5);
            ctx.closePath();
        } else {
            ctx.arc(this.x, this.y, BULLET_RADIUS, 0, Math.PI * 2);
        }
        ctx.fill();
        ctx.restore();
    }
}

// PowerUp Class
class PowerUp {
    constructor(x, y, type) {
        this.x = x;
        this.y = y;
        this.type = type; // 'homing', 'ghost', 'wireless', 'timeWarp', 'portalGun'
        this.active = true;
    }

    draw() {
        if (!this.active) return;
        ctx.save();
        ctx.translate(this.x, this.y);

        // Box
        ctx.fillStyle = '#ffeb3b';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-POWERUP_SIZE / 2, -POWERUP_SIZE / 2, POWERUP_SIZE, POWERUP_SIZE);
        ctx.fill();
        ctx.stroke();

        // Icon
        ctx.fillStyle = '#000';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = 'bold 16px Orbitron';

        if (this.type === 'homing') {
            // Missile icon (simple triangle)
            ctx.beginPath();
            ctx.moveTo(0, -8);
            ctx.lineTo(6, 6);
            ctx.lineTo(-6, 6);
            ctx.fill();
        } else if (this.type === 'wireless') {
            // Wireless icon (W)
            ctx.fillText('W', 0, 0);
        } else if (this.type === 'timeWarp') {
            ctx.fillText('⏳', 0, 0);
        } else if (this.type === 'portalGun') {
            ctx.fillText('◎', 0, 0);
        } else {
            // Ghost icon (☰)
            ctx.fillText('☰', 0, 0);
        }
        ctx.restore();
    }
}

// Tank Class
class Tank {
    constructor(id, color, startPos, controls) {
        this.id = id;
        this.color = color;
        this.x = startPos.x;
        this.y = startPos.y;
        this.angle = startPos.angle;
        this.controls = controls;
        this.speed = 2.0;
        this.rotSpeed = 0.05;
        this.alive = true;
        this.bullets = [];
        this.lastShot = 0;
        this.shootDelay = 300;
        this.powerUp = null; // 'homing', 'ghost', 'wireless', 'timeWarp', 'portalGun'
        this.activeWirelessMissile = null;
        this.timeWarpActiveUntil = 0;
        this.portalsCreated = 0;
        this.turretAngle = startPos.angle;
        this.joystickInput = { x: 0, y: 0 };
        this.firePressed = false;
    }

    update(maze) {
        // Always update bullets, even if the tank is dead
        this.bullets.forEach(b => b.update(maze, tanks));

        if (!this.alive) return;

        // Wireless Missile Takeover (Limit to 10s)
        if (this.activeWirelessMissile && this.activeWirelessMissile.active) {
            const controlDuration = Date.now() - this.activeWirelessMissile.birth;
            if (controlDuration < 20000) {
                // Skip tank movement update, Bullet.update will handle input for the missile
                return;
            } else {
                // Control timeout - release missile
                this.activeWirelessMissile = null;
            }
        }

        // Rotation & Movement combined for Joystick OR separate for Keys
        let moveX = 0;
        let moveY = 0;

        if (this.joystickInput.x !== 0 || this.joystickInput.y !== 0) {
            // Joystick logic
            const targetAngle = Math.atan2(this.joystickInput.y, this.joystickInput.x);
            // Smoothly rotate towards joystick angle
            let diff = targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle += diff * 0.1;
            this.turretAngle = this.angle;

            const power = Math.sqrt(this.joystickInput.x ** 2 + this.joystickInput.y ** 2);
            moveX = Math.cos(this.angle) * this.speed * power;
            moveY = Math.sin(this.angle) * this.speed * power;
        } else {
            // Keyboard logic
            if (keys[this.controls.left]) this.angle -= this.rotSpeed;
            if (keys[this.controls.right]) this.angle += this.rotSpeed;
            this.turretAngle = this.angle;

            if (keys[this.controls.up]) {
                moveX = Math.cos(this.angle) * this.speed;
                moveY = Math.sin(this.angle) * this.speed;
            }
            if (keys[this.controls.down]) {
                moveX = -Math.cos(this.angle) * (this.speed * 0.7);
                moveY = -Math.sin(this.angle) * (this.speed * 0.7);
            }
        }

        // Apply Time Warp Slowdown (if inside any tank's field)
        let speedMult = 1.0;
        tanks.forEach(t => {
            if (t.timeWarpActiveUntil > Date.now() && t.id !== this.id) {
                const d = Math.sqrt((this.x - t.x) ** 2 + (this.y - t.y) ** 2);
                if (d < TANK_SIZE * 3) speedMult = 0.4;
            }
        });

        if (!maze.checkWallCollision(this.x + moveX * speedMult, this.y + moveY * speedMult, TANK_SIZE / 2)) {
            this.x += moveX * speedMult;
            this.y += moveY * speedMult;
        } else if (!maze.checkWallCollision(this.x + moveX * speedMult, this.y, TANK_SIZE / 2)) {
            this.x += moveX * speedMult;
        } else if (!maze.checkWallCollision(this.x, this.y + moveY * speedMult, TANK_SIZE / 2)) {
            this.y += moveY * speedMult;
        }

        // Portal Teleportation Check (Tank)
        if (portals.blue && portals.orange) {
            const checkPortal = (pIn, pOut) => {
                const d = Math.sqrt((this.x - pIn.x) ** 2 + (this.y - pIn.y) ** 2);
                if (d < 20) {
                    this.x = pOut.x + pOut.nx * 25;
                    this.y = pOut.y + pOut.ny * 25;
                }
            };
            checkPortal(portals.blue, portals.orange);
            checkPortal(portals.orange, portals.blue);
        }

        // Shooting
        const isShooting = keys[this.controls.fire] || this.firePressed;
        if (isShooting && Date.now() - this.lastShot > this.shootDelay) {
            if (this.bullets.filter(b => b.active).length < 5) {
                const bulletX = this.x + Math.cos(this.turretAngle) * (TANK_SIZE * 1.2);
                const bulletY = this.y + Math.sin(this.turretAngle) * (TANK_SIZE * 1.2);

                let bulletType = 'normal';
                if (this.powerUp) {
                    bulletType = this.powerUp;
                }

                if (bulletType === 'timeWarp') {
                    this.timeWarpActiveUntil = Date.now() + 8000;
                    this.powerUp = null;
                } else if (bulletType === 'portalGun') {
                    // Handle portal gun: alternate between blue and orange
                    const type = (this.portalsCreated % 2 === 0) ? 'portal_blue' : 'portal_orange';
                    const newBullet = new Bullet(bulletX, bulletY, this.turretAngle, 'black', this.id, type);
                    this.bullets.push(newBullet);
                    this.portalsCreated++;
                    if (this.portalsCreated % 2 === 0) this.powerUp = null; // Use after 2 shots
                } else {
                    const newBullet = new Bullet(bulletX, bulletY, this.turretAngle, 'black', this.id, bulletType);
                    this.bullets.push(newBullet);

                    if (bulletType === 'wireless') {
                        this.activeWirelessMissile = newBullet;
                    }
                    if (this.powerUp) this.powerUp = null; // Use powerup once
                }

                this.lastShot = Date.now();
            }
        }

        // Return control if wireless missile is dead
        if (this.activeWirelessMissile && !this.activeWirelessMissile.active) {
            this.activeWirelessMissile = null;
        }
    }

    draw() {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);

        // Body (Detailed Hull)
        ctx.save();
        ctx.rotate(this.angle);
        ctx.fillStyle = this.color;
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;

        // Main hull
        ctx.beginPath();
        ctx.roundRect(-TANK_SIZE / 2, -TANK_SIZE / 2, TANK_SIZE, TANK_SIZE, 4);
        ctx.fill();
        ctx.stroke();

        // Tracks
        ctx.fillStyle = '#444';
        ctx.fillRect(-TANK_SIZE / 2 - 2, -TANK_SIZE / 2, 4, TANK_SIZE);
        ctx.fillRect(TANK_SIZE / 2 - 2, -TANK_SIZE / 2, 4, TANK_SIZE);
        ctx.restore();

        // Turret (Detailed)
        ctx.save();
        ctx.rotate(this.turretAngle);

        // Barrel
        ctx.fillStyle = COLORS.WALL;
        ctx.fillRect(0, -2, TANK_SIZE * 0.9, 4);

        // Turret cap
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, TANK_SIZE * 0.35, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();

        ctx.restore();
        ctx.restore();

        // Time Warp Field Visual
        if (this.timeWarpActiveUntil > Date.now()) {
            ctx.save();
            ctx.beginPath();
            const pulse = 1 + Math.sin(Date.now() / 200) * 0.1;
            ctx.arc(this.x, this.y, TANK_SIZE * 3 * pulse, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(0, 229, 255, 0.2)';
            ctx.strokeStyle = 'rgba(0, 229, 255, 0.5)';
            ctx.lineWidth = 2;
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        // Power-up Indicator above tank
        if (this.powerUp) {
            ctx.save();
            ctx.translate(this.x, this.y - TANK_SIZE - 10);
            ctx.fillStyle = '#000';
            ctx.font = 'bold 14px Orbitron';
            ctx.textAlign = 'center';
            if (this.powerUp === 'homing') {
                ctx.beginPath();
                ctx.moveTo(0, -6);
                ctx.lineTo(4, 4);
                ctx.lineTo(-4, 4);
                ctx.fill();
            } else if (this.powerUp === 'wireless') {
                ctx.fillText('W', 0, 0);
            } else if (this.powerUp === 'timeWarp') {
                ctx.fillText('⏳', 0, 0);
            } else if (this.powerUp === 'portalGun') {
                ctx.fillText('◎', 0, 0);
            } else if (this.powerUp === 'ghost') {
                ctx.fillText('☰', 0, 0);
            }
            ctx.restore();
        }

        this.bullets.forEach(b => b.draw());
    }

    checkBulletHit(bullet) {
        if (!this.alive || !bullet.active) return false;

        // Own bullet immunity for 500ms
        if (bullet.owner === this.id && Date.now() - bullet.birth < 1000) return false;

        const dist = Math.sqrt((this.x - bullet.x) ** 2 + (this.y - bullet.y) ** 2);
        return dist < TANK_SIZE / 2 + BULLET_RADIUS;
    }
}

// Game State
let gameState = 'MENU';
let maze;
let tanks = [];
let powerUps = [];
let nextPowerUpTime = 0;
let playerCount = 2;
let roundEnded = false;

const PLAYER_CONFIGS = [
    { id: 'P1', color: COLORS.P1, controls: { up: 'KeyW', down: 'KeyS', left: 'KeyA', right: 'KeyD', fire: 'KeyQ' } },
    { id: 'P2', color: COLORS.P2, controls: { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight', fire: 'KeyM' } },
    { id: 'P3', color: COLORS.P3, controls: { up: 'KeyI', down: 'KeyK', left: 'KeyJ', right: 'KeyL', fire: 'KeyU' } },
    { id: 'P4', color: COLORS.P4, controls: { up: 'Numpad8', down: 'Numpad5', left: 'Numpad4', right: 'Numpad6', fire: 'Numpad0' } }
];

function startGame(count) {
    playerCount = count;
    gameState = 'PLAYING';
    menuOverlay.classList.add('hidden');
    initRound();
}

function initRound() {
    console.log("Initializing round...");
    maze = new Maze(ROWS, COLS);
    tanks = [];
    powerUps = [];
    roundEnded = false;
    winnerOverlay.classList.add('hidden');
    scheduleNextPowerUp();

    const spawnPoints = [
        { x: CELL_SIZE / 2, y: CELL_SIZE / 2, angle: 0 },
        { x: canvas.width - CELL_SIZE / 2, y: canvas.height - CELL_SIZE / 2, angle: Math.PI },
        { x: canvas.width - CELL_SIZE / 2, y: CELL_SIZE / 2, angle: Math.PI / 2 },
        { x: CELL_SIZE / 2, y: canvas.height - CELL_SIZE / 2, angle: -Math.PI / 2 }
    ];

    // Clear and Show required joysticks
    document.querySelectorAll('.touch-controls').forEach(el => el.classList.add('hidden'));

    for (let i = 0; i < playerCount; i++) {
        const config = PLAYER_CONFIGS[i];
        const tank = new Tank(config.id, config.color, spawnPoints[i], config.controls);
        tanks.push(tank);

        // UI Setup
        const controlId = `p${i + 1}-controls`;
        const controlEl = document.getElementById(controlId);
        if (controlEl) {
            controlEl.classList.remove('hidden');

            // Re-link or create joystick
            let joy = document.getElementById(`p${i + 1}-joystick`)._joystick;
            if (!joy) {
                joy = new Joystick(`p${i + 1}-joystick`, (input) => tank.joystickInput = input);
            } else {
                joy.onChange = (input) => tank.joystickInput = input;
            }

            const fireBtn = document.getElementById(`p${i + 1}-fire`);
            if (fireBtn) {
                // Re-add listeners using a clean approach
                const newFireBtn = fireBtn.cloneNode(true);
                fireBtn.parentNode.replaceChild(newFireBtn, fireBtn);

                newFireBtn.addEventListener('mousedown', () => tank.firePressed = true);
                newFireBtn.addEventListener('mouseup', () => tank.firePressed = false);
                newFireBtn.addEventListener('touchstart', (e) => { e.preventDefault(); tank.firePressed = true; });
                newFireBtn.addEventListener('touchend', () => tank.firePressed = false);
            }
        }
    }
}

function scheduleNextPowerUp() {
    const delay = POWERUP_SPAWN_INTERVAL[0] + Math.random() * (POWERUP_SPAWN_INTERVAL[1] - POWERUP_SPAWN_INTERVAL[0]);
    nextPowerUpTime = Date.now() + delay;
}

function update() {
    if (gameState !== 'PLAYING') return;

    // Handle Power-up spawning
    if (Date.now() > nextPowerUpTime) {
        const pos = maze.getRandomEmptyCell();
        const types = ['homing', 'ghost', 'wireless', 'timeWarp', 'portalGun'];
        const type = types[Math.floor(Math.random() * types.length)]; // Equal 1/3 odds

        powerUps.push(new PowerUp(pos.x, pos.y, type));
        scheduleNextPowerUp();
    }

    tanks.forEach(tank => tank.update(maze));

    // Collision check: Tanks vs PowerUps
    tanks.forEach(tank => {
        if (!tank.alive) return;
        powerUps.forEach(pu => {
            if (pu.active) {
                const dist = Math.sqrt((tank.x - pu.x) ** 2 + (tank.y - pu.y) ** 2);
                if (dist < TANK_SIZE / 2 + POWERUP_SIZE / 2) {
                    tank.powerUp = pu.type;
                    pu.active = false;
                }
            }
        });
    });

    // Collision check: Bullets vs Tanks
    tanks.forEach(tank => {
        tanks.forEach(otherTank => {
            otherTank.bullets.forEach(bullet => {
                if (tank.checkBulletHit(bullet)) {
                    // Friendly fire check or own bullet check is skipped to match original "trouble" logic
                    tank.alive = false;
                    bullet.active = false;
                }
            });
        });
    });

    // Check for round end
    const aliveTanks = tanks.filter(t => t.alive);
    if (!roundEnded && (aliveTanks.length <= 1)) {
        roundEnded = true;
        const winner = aliveTanks.length === 1 ? aliveTanks[0].id : "NOBODY";
        showWinner(winner);
    }
}

function showWinner(winnerId) {
    winnerMessage.textContent = winnerId === "NOBODY" ? "DRAW!" : `${winnerId} WINS!`;
    winnerMessage.style.color = winnerId === "NOBODY" ? "white" : COLORS[winnerId];
    winnerOverlay.classList.remove('hidden');

    setTimeout(() => {
        if (gameState === 'PLAYING') initRound();
    }, 3000);
}

function draw() {
    ctx.fillStyle = COLORS.GROUND;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (maze) maze.draw();

    // Draw Portals
    if (portals.blue) {
        ctx.save();
        ctx.beginPath();
        ctx.translate(portals.blue.x, portals.blue.y);
        ctx.rotate(Math.atan2(portals.blue.ny, portals.blue.nx));
        ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#2196F3';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#2196F3';
        ctx.fill();
        ctx.restore();
    }
    if (portals.orange) {
        ctx.save();
        ctx.beginPath();
        ctx.translate(portals.orange.x, portals.orange.y);
        ctx.rotate(Math.atan2(portals.orange.ny, portals.orange.nx));
        ctx.ellipse(0, 0, 15, 5, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#FF9800';
        ctx.shadowBlur = 15;
        ctx.shadowColor = '#FF9800';
        ctx.fill();
        ctx.restore();
    }

    powerUps.forEach(pu => pu.draw());
    tanks.forEach(tank => tank.draw());

    requestAnimationFrame(() => {
        update();
        draw();
    });
}

// Start animation loop
draw();
