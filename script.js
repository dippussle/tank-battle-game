const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const menuOverlay = document.getElementById('menu-overlay');
const winnerOverlay = document.getElementById('winner-overlay');
const winnerMessage = document.getElementById('winner-message');

// Game constants
const CELL_SIZE = 80;
const ROWS = 9;
const COLS = 13;
const WALL_THICKNESS = 4;
const TANK_SIZE = 24;
const BULLET_RADIUS = 3;
const BULLET_SPEED = 4;
const MAX_BOUNCES = 5;
const BULLET_LIFESPAN = 10000; // 10 seconds

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

// Input state
const keys = {};
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

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
            if (r > 0 && !this.cells[r-1][c].visited) neighbors.push({ r: r-1, c: c, dir: 'top' });
            if (r < this.rows - 1 && !this.cells[r+1][c].visited) neighbors.push({ r: r+1, c: c, dir: 'bottom' });
            if (c > 0 && !this.cells[r][c-1].visited) neighbors.push({ r: r, c: c-1, dir: 'left' });
            if (c < this.cols - 1 && !this.cells[r][c+1].visited) neighbors.push({ r: r, c: c+1, dir: 'right' });
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
            const r = Math.floor(Math.random() * (this.rows - 1)) + 1;
            const c = Math.floor(Math.random() * (this.cols - 1)) + 1;
            const walls = Object.keys(this.cells[r][c].walls);
            const wall = walls[Math.floor(Math.random() * walls.length)];
            
            this.cells[r][c].walls[wall] = false;
            if (wall === 'top') this.cells[r-1][c].walls.bottom = false;
            if (wall === 'bottom') this.cells[r+1][c].walls.top = false;
            if (wall === 'left') this.cells[r][c-1].walls.right = false;
            if (wall === 'right') this.cells[r][c+1].walls.left = false;
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

    checkWallCollision(x, y, radius) {
        const c = Math.floor(x / CELL_SIZE);
        const r = Math.floor(y / CELL_SIZE);
        
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return true;

        const cell = this.cells[r][c];
        const cellX = c * CELL_SIZE;
        const cellY = r * CELL_SIZE;

        // Wall collisions
        const margin = radius + WALL_THICKNESS / 2;
        if (cell.walls.top && y < cellY + margin) return true;
        if (cell.walls.bottom && y > cellY + CELL_SIZE - margin) return true;
        if (cell.walls.left && x < cellX + margin) return true;
        if (cell.walls.right && x > cellX + CELL_SIZE - margin) return true;

        // Corner collisions
        const distSq = (x1, y1, x2, y2) => (x1-x2)**2 + (y1-y2)**2;
        const corners = [
            {x: cellX, y: cellY}, {x: cellX+CELL_SIZE, y: cellY},
            {x: cellX, y: cellY+CELL_SIZE}, {x: cellX+CELL_SIZE, y: cellY+CELL_SIZE}
        ];
        for (let corner of corners) {
            if (distSq(x, y, corner.x, corner.y) < radius * radius) {
                // Determine if this corner has a wall blocking it
                // Simple version: if any walls meet here, block
                return true; 
            }
        }

        return false;
    }
}

// Bullet Class
class Bullet {
    constructor(x, y, angle, color, owner) {
        this.x = x;
        this.y = y;
        this.angle = angle;
        this.color = color;
        this.owner = owner;
        this.vx = Math.cos(angle) * BULLET_SPEED;
        this.vy = Math.sin(angle) * BULLET_SPEED;
        this.bounces = 0;
        this.birth = Date.now();
        this.active = true;
    }

    update(maze) {
        if (!this.active) return;
        
        if (Date.now() - this.birth > BULLET_LIFESPAN) {
            this.active = false;
            return;
        }

        const nextX = this.x + this.vx;
        const nextY = this.y + this.vy;

        // Ricochet check
        const c = Math.floor(nextX / CELL_SIZE);
        const r = Math.floor(nextY / CELL_SIZE);
        
        if (r < 0 || r >= ROWS || c < 0 || c >= COLS) {
            this.active = false;
            return;
        }

        const cell = maze.cells[r][c];
        const cx = c * CELL_SIZE;
        const cy = r * CELL_SIZE;
        const m = BULLET_RADIUS + WALL_THICKNESS/2;

        let bounced = false;
        if (cell.walls.top && nextY < cy + m && this.vy < 0) { this.vy *= -1; bounced = true; }
        else if (cell.walls.bottom && nextY > cy + CELL_SIZE - m && this.vy > 0) { this.vy *= -1; bounced = true; }
        
        if (cell.walls.left && nextX < cx + m && this.vx < 0) { this.vx *= -1; bounced = true; }
        else if (cell.walls.right && nextX > cx + CELL_SIZE - m && this.vx > 0) { this.vx *= -1; bounced = true; }

        if (bounced) {
            this.bounces++;
            if (this.bounces > MAX_BOUNCES) {
                this.active = false;
            }
        }

        this.x += this.vx;
        this.y += this.vy;
    }

    draw() {
        if (!this.active) return;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, BULLET_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        // Glow effect
        ctx.shadowBlur = 5;
        ctx.shadowColor = this.color;
        ctx.stroke();
        ctx.shadowBlur = 0;
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
        this.speed = 1.5;
        this.rotSpeed = 0.05;
        this.alive = true;
        this.bullets = [];
        this.lastShot = 0;
        this.shootDelay = 300;
    }

    update(maze) {
        if (!this.alive) return;

        // Rotation
        if (keys[this.controls.left]) this.angle -= this.rotSpeed;
        if (keys[this.controls.right]) this.angle += this.rotSpeed;

        // Movement
        let moveX = 0;
        let moveY = 0;
        if (keys[this.controls.up]) {
            moveX = Math.cos(this.angle) * this.speed;
            moveY = Math.sin(this.angle) * this.speed;
        }
        if (keys[this.controls.down]) {
            moveX = -Math.cos(this.angle) * (this.speed * 0.7);
            moveY = -Math.sin(this.angle) * (this.speed * 0.7);
        }

        if (!maze.checkWallCollision(this.x + moveX, this.y + moveY, TANK_SIZE/2)) {
            this.x += moveX;
            this.y += moveY;
        } else if (!maze.checkWallCollision(this.x + moveX, this.y, TANK_SIZE/2)) {
            this.x += moveX;
        } else if (!maze.checkWallCollision(this.x, this.y + moveY, TANK_SIZE/2)) {
            this.y += moveY;
        }

        // Shooting
        if (keys[this.controls.fire] && Date.now() - this.lastShot > this.shootDelay) {
            if (this.bullets.filter(b => b.active).length < 5) {
                const bulletX = this.x + Math.cos(this.angle) * (TANK_SIZE * 0.8);
                const bulletY = this.y + Math.sin(this.angle) * (TANK_SIZE * 0.8);
                this.bullets.push(new Bullet(bulletX, bulletY, this.angle, 'black', this.id));
                this.lastShot = Date.now();
            }
        }

        this.bullets.forEach(b => b.update(maze));
    }

    draw() {
        if (!this.alive) return;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle);

        // Body
        ctx.fillStyle = this.color;
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.rect(-TANK_SIZE/2, -TANK_SIZE/2, TANK_SIZE, TANK_SIZE);
        ctx.fill();
        ctx.stroke();

        // Barrel
        ctx.fillStyle = COLORS.WALL;
        ctx.beginPath();
        ctx.rect(0, -3, TANK_SIZE * 0.8, 6);
        ctx.fill();

        ctx.restore();

        this.bullets.forEach(b => b.draw());
    }

    checkBulletHit(bullet) {
        if (!this.alive || !bullet.active) return false;
        const dist = Math.sqrt((this.x - bullet.x)**2 + (this.y - bullet.y)**2);
        return dist < TANK_SIZE/2 + BULLET_RADIUS;
    }
}

// Game State
let gameState = 'MENU';
let maze;
let tanks = [];
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
    maze = new Maze(ROWS, COLS);
    tanks = [];
    roundEnded = false;
    winnerOverlay.classList.add('hidden');

    const spawnPoints = [
        { x: CELL_SIZE/2, y: CELL_SIZE/2, angle: 0 },
        { x: canvas.width - CELL_SIZE/2, y: canvas.height - CELL_SIZE/2, angle: Math.PI },
        { x: canvas.width - CELL_SIZE/2, y: CELL_SIZE/2, angle: Math.PI/2 },
        { x: CELL_SIZE/2, y: canvas.height - CELL_SIZE/2, angle: -Math.PI/2 }
    ];

    for (let i = 0; i < playerCount; i++) {
        tanks.push(new Tank(PLAYER_CONFIGS[i].id, PLAYER_CONFIGS[i].color, spawnPoints[i], PLAYER_CONFIGS[i].controls));
    }
}

function update() {
    if (gameState !== 'PLAYING') return;

    tanks.forEach(tank => tank.update(maze));

    // Collision check: Bullets vs Tanks
    tanks.forEach(tank => {
        tanks.forEach(otherTank => {
            otherTank.bullets.forEach(bullet => {
                if (tank.checkBulletHit(bullet)) {
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
    tanks.forEach(tank => tank.draw());

    requestAnimationFrame(() => {
        update();
        draw();
    });
}

// Start animation loop
draw();
