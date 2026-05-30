import { PlayerData, Quest } from "../types";
import { FRUITS } from "./fruits";

type Vec2 = { x: number; y: number };

// Helper constraints
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;

export class GameWorld {
  ctx: CanvasRenderingContext;
  canvas: HTMLCanvasElement;
  updateUI: (state: any) => void;

  // Game Loop
  lastTime: number = 0;
  isRunning: boolean = true;

  // Player
  playerPos: Vec2 = { x: 2000, y: 2000 };
  playerDir: Vec2 = { x: 0, y: -1 };
  playerData: PlayerData;
  keys: Record<string, boolean> = {};

  // Combat & State
  projectiles: any[] = [];
  aoes: any[] = [];
  enemies: any[] = [];
  damageTexts: any[] = [];
  cooldowns: Record<string, number> = {};

  // World entities
  islands: any[] = [];
  obstacles: any[] = [];
  portals: any[] = [];
  npc: any;

  // Quests
  activeQuest: Quest | null = null;
  questGiverNearby: boolean = false;

  // Mouse
  mouseX: number = 0;
  mouseY: number = 0;

  camera: Vec2 = { x: 0, y: 0 };
  dashTimer: number = 0;
  dashDir: Vec2 = { x: 0, y: 0 };
  dashSpeed: number = 0;

  swordCombo: number = 0;
  swordLastAttack: number = 0;

  constructor(canvas: HTMLCanvasElement, updateUI: (state: any) => void) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.updateUI = updateUI;

    this.playerData = this.loadSave();
    if (!this.playerData) {
      this.playerData = {
        level: 1,
        exp: 0,
        maxExp: 100,
        hp: 100,
        maxHp: 100,
        energy: 100,
        maxEnergy: 100,
        money: 0,
        stats: { melee: 1, defense: 1, sword: 1, fruit: 1, points: 0 },
        equippedFruit: null,
        equippedWeapon: "Katana",
      };
    }
    this.playerData.hp = this.playerData.maxHp;
    this.playerData.energy = this.playerData.maxEnergy;

    this.initWorld();

    window.addEventListener("keydown", this.handleKeyDown);
    window.addEventListener("keyup", this.handleKeyUp);
    canvas.addEventListener("mousemove", this.handleMouseMove);
    canvas.addEventListener("mousedown", this.handleMouseDown);

    requestAnimationFrame(this.loop);

    // Enemy spawner
    setInterval(() => this.spawnEnemy(), 3000);
    // Energy regen
    setInterval(() => {
      if (this.playerData.energy < this.playerData.maxEnergy) {
        this.playerData.energy = Math.min(
          this.playerData.maxEnergy,
          this.playerData.energy + 5,
        );
        this.syncUI();
      }
    }, 1000);
  }

  destroy() {
    this.isRunning = false;
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    this.canvas.removeEventListener("mousemove", this.handleMouseMove);
    this.canvas.removeEventListener("mousedown", this.handleMouseDown);
  }

  loadSave() {
    const s = localStorage.getItem("pirate_save");
    return s ? JSON.parse(s) : null;
  }

  saveGame() {
    localStorage.setItem("pirate_save", JSON.stringify(this.playerData));
  }

  initWorld() {
    // Starter Island
    this.islands.push({
      x: 1800,
      y: 1800,
      w: 600,
      h: 600,
      color: "#e0cda9",
      name: "Starter Town",
    });
    // Bandit Camp
    this.islands.push({
      x: 2600,
      y: 1800,
      w: 800,
      h: 600,
      color: "#8b5a2b",
      name: "Bandit Island",
    });
    // Desert Island
    this.islands.push({
      x: 1800,
      y: 2600,
      w: 800,
      h: 800,
      color: "#eedd82",
      name: "Desert Island",
    });

    // Obstacles
    this.obstacles.push({ x: 1900, y: 1900, w: 100, h: 100, color: "gray" }); // building
    this.obstacles.push({ x: 2100, y: 2000, w: 50, h: 150, color: "gray" });

    // NPC
    this.npc = { x: 2000, y: 2100, w: 30, h: 30, color: "#32cd32" };

    // Teleport Portals
    this.portals.push({
      x: 2350,
      y: 2000,
      dest: { x: 2650, y: 2000 },
      color: "purple",
    });
    this.portals.push({
      x: 2650,
      y: 2100,
      dest: { x: 2300, y: 2100 },
      color: "magenta",
    });
  }

  handleKeyDown = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = true;

    const key = e.key.toUpperCase();
    if (["Z", "X", "C"].includes(key) && this.playerData.equippedFruit) {
      this.useFruitSkill(key);
    }

    if (e.key === "f" || e.key === "F") {
      if (this.questGiverNearby) {
        if (!this.activeQuest) {
          this.activeQuest = {
            id: "q1",
            title: "Defeat 5 Bandits",
            targetType: "Bandit",
            targetCount: 5,
            currentCount: 0,
            expReward: 100,
            moneyReward: 50,
            isCompleted: false,
          };
          this.syncUI();
        } else if (
          this.activeQuest.currentCount >= this.activeQuest.targetCount &&
          !this.activeQuest.isCompleted
        ) {
          // Complete quest
          this.activeQuest.isCompleted = true;
          this.playerData.exp += this.activeQuest.expReward;
          this.playerData.money += this.activeQuest.moneyReward;
          this.checkLevelUp();
          this.activeQuest = null;
          this.saveGame();
          this.syncUI();
        }
      }
    }
  };

  handleKeyUp = (e: KeyboardEvent) => {
    this.keys[e.key.toLowerCase()] = false;
  };

  handleMouseMove = (e: MouseEvent) => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
  };

  handleMouseDown = (e: MouseEvent) => {
    if (e.button === 0) {
      this.swordAttack();
    }
  };

  updateDirection() {
    const worldMouseX = this.mouseX + this.camera.x;
    const worldMouseY = this.mouseY + this.camera.y;
    const dx = worldMouseX - this.playerPos.x;
    const dy = worldMouseY - this.playerPos.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist > 0) {
      this.playerDir = { x: dx / dist, y: dy / dist };
    }
  }

  loop = (timestamp: number) => {
    if (!this.isRunning) return;
    const dt = (timestamp - this.lastTime) / 1000;
    this.lastTime = timestamp;

    if (dt < 0.1) {
      this.update(dt);
      this.draw();
    }
    requestAnimationFrame(this.loop);
  };

  update(dt: number) {
    if (this.playerData.hp <= 0) {
      // dead
      this.playerPos = { x: 2000, y: 2000 };
      this.playerData.hp = this.playerData.maxHp;
      return;
    }

    this.updateDirection();

    // Movement
    let speed = 200;
    if (this.keys["shift"] && this.playerData.energy > 0) {
      speed = 350;
      this.playerData.energy -= 10 * dt;
    }

    let dx = 0;
    let dy = 0;

    if (this.dashTimer > 0) {
      this.dashTimer -= dt;
      dx = this.dashDir.x * this.dashSpeed * dt;
      dy = this.dashDir.y * this.dashSpeed * dt;
    } else {
      if (this.keys["w"]) dy -= 1;
      if (this.keys["s"]) dy += 1;
      if (this.keys["a"]) dx -= 1;
      if (this.keys["d"]) dx += 1;

      if (dx !== 0 && dy !== 0) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        dx /= dist;
        dy /= dist;
      }
      dx *= speed * dt;
      dy *= speed * dt;
    }

    this.moveEntity(this.playerPos, dx, dy, 20);

    // Update cooldowns
    for (let k in this.cooldowns) {
      if (this.cooldowns[k] > 0) {
        this.cooldowns[k] -= dt;
      }
    }

    // Camera
    this.camera.x = this.playerPos.x - this.canvas.width / 2;
    this.camera.y = this.playerPos.y - this.canvas.height / 2;

    // Clamp camera
    this.camera.x = Math.max(
      0,
      Math.min(this.camera.x, WORLD_WIDTH - this.canvas.width),
    );
    this.camera.y = Math.max(
      0,
      Math.min(this.camera.y, WORLD_HEIGHT - this.canvas.height),
    );

    // NPC interact
    const distToNpc = Math.hypot(
      this.playerPos.x - this.npc.x,
      this.playerPos.y - this.npc.y,
    );
    this.questGiverNearby = distToNpc < 100;

    // Portals
    for (const p of this.portals) {
      if (Math.hypot(this.playerPos.x - p.x, this.playerPos.y - p.y) < 40) {
        this.playerPos.x = p.dest.x;
        this.playerPos.y = p.dest.y;
      }
    }

    // Update Projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.x += p.dx * p.speed * dt;
      p.y += p.dy * p.speed * dt;
      p.life -= dt;

      // Check collision with enemies if player owned
      if (p.owner === "player") {
        for (const e of this.enemies) {
          if (Math.hypot(p.x - e.x, p.y - e.y) < e.size + p.size) {
            this.damageEnemy(e, p.damage, p.dx, p.dy, 200, p.fruitType);
            p.life = 0; // destroy projectile
            break;
          }
        }
      }

      if (p.life <= 0) this.projectiles.splice(i, 1);
    }

    // Update AOEs
    for (let i = this.aoes.length - 1; i >= 0; i--) {
      const a = this.aoes[i];
      a.duration -= dt;
      if (a.duration <= 0) {
        this.aoes.splice(i, 1);
        continue;
      }
      if (a.owner === "player" && !a.ticked) {
        a.ticked = true; // hit once
        for (const e of this.enemies) {
          if (Math.hypot(a.x - e.x, a.y - e.y) < a.radius + e.size) {
            this.damageEnemy(e, a.damage, 0, 0, 0, a.fruitType);
          }
        }
      }
    }

    // Update Enemies
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];

      if (e.hp <= 0) {
        // Enemy die
        this.enemies.splice(i, 1);
        this.playerData.exp += e.exp;
        this.playerData.money += e.money;
        if (this.activeQuest && this.activeQuest.targetType === e.type) {
          this.activeQuest.currentCount++;
        }
        this.checkLevelUp();
        this.syncUI();
        continue;
      }

      if (e.knockback > 0) {
        e.knockback -= dt * 500;
        this.moveEntity(
          e,
          e.kdx * dt * e.knockback,
          e.kdy * dt * e.knockback,
          e.size,
        );
      } else if (!e.frozen) {
        // AI Chase
        const dx = this.playerPos.x - e.x;
        const dy = this.playerPos.y - e.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 400) {
          // aggro range
          if (dist > e.range) {
            this.moveEntity(
              e,
              (dx / dist) * e.speed * dt,
              (dy / dist) * e.speed * dt,
              e.size,
            );
          } else {
            // Attack
            e.attackTimer -= dt;
            if (e.attackTimer <= 0) {
              e.attackTimer = 1.5;
              this.damagePlayer(e.damage);
            }
          }
        }
      }

      if (e.frozen) {
        e.freezeTimer -= dt;
        if (e.freezeTimer <= 0) e.frozen = false;
      }
    }

    // Damage texts
    for (let i = this.damageTexts.length - 1; i >= 0; i--) {
      this.damageTexts[i].y -= 50 * dt;
      this.damageTexts[i].life -= dt;
      if (this.damageTexts[i].life <= 0) this.damageTexts.splice(i, 1);
    }
  }

  moveEntity(entity: Vec2, dx: number, dy: number, size: number) {
    let newX = entity.x + dx;
    let newY = entity.y + dy;

    // Map bounds
    newX = Math.max(size, Math.min(newX, WORLD_WIDTH - size));
    newY = Math.max(size, Math.min(newY, WORLD_HEIGHT - size));

    // Obstacle collision (simple AABB)
    for (const obs of this.obstacles) {
      if (
        newX + size > obs.x &&
        newX - size < obs.x + obs.w &&
        entity.y + size > obs.y &&
        entity.y - size < obs.y + obs.h
      ) {
        newX = entity.x; // stop x
      }
      if (
        entity.x + size > obs.x &&
        entity.x - size < obs.x + obs.w &&
        newY + size > obs.y &&
        newY - size < obs.y + obs.h
      ) {
        newY = entity.y; // stop y
      }
    }

    entity.x = newX;
    entity.y = newY;
  }

  spawnEnemy() {
    if (this.enemies.length > 20) return; // cap

    // Pick island
    const isBoss = Math.random() < 0.05;
    const baseLvl = this.playerData.level + (Math.floor(Math.random() * 3) - 1);
    const lvl = Math.max(1, baseLvl);

    let spawnX = 2600 + Math.random() * 600;
    let spawnY = 1800 + Math.random() * 400;

    if (isBoss) {
      this.enemies.push({
        type: "Boss",
        x: 2200,
        y: 3000,
        size: 40,
        hp: 500 * lvl,
        maxHp: 500 * lvl,
        speed: 120,
        damage: 20 * lvl,
        exp: 200 * lvl,
        money: 100 * lvl,
        range: 50,
        attackTimer: 0,
        knockback: 0,
        color: "purple",
      });
    } else {
      this.enemies.push({
        type: "Bandit",
        x: spawnX,
        y: spawnY,
        size: 15,
        hp: 50 * lvl,
        maxHp: 50 * lvl,
        speed: 80,
        damage: 5 * lvl,
        exp: 20 * lvl,
        money: 10 * lvl,
        range: 30,
        attackTimer: 0,
        knockback: 0,
        color: "red",
      });
    }
  }

  swordAttack() {
    const now = performance.now();
    if (now - this.swordLastAttack > 1000) this.swordCombo = 0;
    if (this.cooldowns["sword"]) return;

    this.swordCombo = (this.swordCombo + 1) % 4;
    this.swordLastAttack = now;
    this.cooldowns["sword"] = 0.3; // Attack rate

    // Calculate hitbox based on player direction
    const range = 60;
    const angle = Math.atan2(this.playerDir.y, this.playerDir.x);

    // Generate an arc for the attack visual
    this.aoes.push({
      x: this.playerPos.x + this.playerDir.x * 30,
      y: this.playerPos.y + this.playerDir.y * 30,
      radius: range,
      damage:
        10 + this.playerData.stats.sword * 5 + this.playerData.stats.melee * 2,
      duration: 0.1,
      color: "rgba(200, 200, 255, 0.5)",
      owner: "player",
      type: "sword",
    });

    // Check hit
    for (const e of this.enemies) {
      const dx = e.x - this.playerPos.x;
      const dy = e.y - this.playerPos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < range + e.size) {
        // angle check
        const enemyAngle = Math.atan2(dy, dx);
        let angleDiff = Math.abs(enemyAngle - angle);
        if (angleDiff > Math.PI) angleDiff = 2 * Math.PI - angleDiff;

        if (angleDiff < Math.PI / 2) {
          const dmg =
            10 +
            this.playerData.stats.sword * 5 +
            this.playerData.stats.melee * 2;
          this.damageEnemy(
            e,
            dmg,
            this.playerDir.x,
            this.playerDir.y,
            this.swordCombo === 3 ? 300 : 100,
            "sword",
          );
        }
      }
    }
  }

  useFruitSkill(key: string) {
    if (!this.playerData.equippedFruit) return;
    const fruitName = this.playerData.equippedFruit;
    const fruitDef = FRUITS[fruitName];
    if (!fruitDef || !fruitDef.skills[key]) return;

    const skill = fruitDef.skills[key];
    if (this.cooldowns[`${fruitName}_${key}`] > 0) return;
    if (this.playerData.energy < skill.energy) return; // Note: simplified, should show UI feedback

    this.playerData.energy -= skill.energy;
    this.cooldowns[`${fruitName}_${key}`] = skill.cooldown;

    const baseDmg = 5 + this.playerData.stats.fruit * 8;
    const dmg = baseDmg * skill.damageMult;

    if (skill.type === "projectile") {
      this.projectiles.push({
        x: this.playerPos.x + this.playerDir.x * 20,
        y: this.playerPos.y + this.playerDir.y * 20,
        dx: this.playerDir.x,
        dy: this.playerDir.y,
        speed: skill.speed,
        size: skill.size,
        damage: dmg,
        life: skill.range / skill.speed,
        owner: "player",
        color: skill.color,
        fruitType: fruitName,
      });
    } else if (skill.type === "aoe") {
      this.aoes.push({
        x: this.playerPos.x + this.playerDir.x * 50,
        y: this.playerPos.y + this.playerDir.y * 50,
        radius: skill.radius,
        damage: dmg,
        duration: skill.duration,
        color: skill.color,
        owner: "player",
        fruitType: fruitName,
      });
    } else if (skill.type === "dash") {
      this.dashTimer = skill.duration;
      this.dashDir = { ...this.playerDir };
      this.dashSpeed = skill.speed;
      // Add AOE at start
      this.aoes.push({
        x: this.playerPos.x,
        y: this.playerPos.y,
        radius: 40,
        damage: dmg,
        duration: 0.2,
        color: skill.color,
        owner: "player",
      });
    }

    this.syncUI();
  }

  damageEnemy(
    e: any,
    amount: number,
    dx: number,
    dy: number,
    knock: number,
    type: string,
  ) {
    e.hp -= amount;
    e.kdx = dx;
    e.kdy = dy;
    e.knockback = knock;

    let color = "white";
    if (type === "sword") color = "lightgray";
    else if (type === "Flame") color = "orange";
    else if (type === "Ice") {
      color = "cyan";
      e.frozen = true;
      e.freezeTimer = 2;
    } else if (type === "Lightning") color = "yellow";

    this.damageTexts.push({
      id: Math.random(),
      text: Math.floor(amount).toString(),
      x: e.x,
      y: e.y,
      life: 1,
      color,
    });
  }

  damagePlayer(amount: number) {
    const reduced = Math.max(1, amount - this.playerData.stats.defense * 2);
    this.playerData.hp -= reduced;
    this.damageTexts.push({
      id: Math.random(),
      text: Math.floor(reduced).toString(),
      x: this.playerPos.x,
      y: this.playerPos.y,
      life: 1,
      color: "red",
    });
    this.syncUI();
  }

  checkLevelUp() {
    let leveled = false;
    while (this.playerData.exp >= this.playerData.maxExp) {
      this.playerData.exp -= this.playerData.maxExp;
      this.playerData.level++;
      this.playerData.stats.points += 3;
      this.playerData.maxExp = Math.floor(
        100 * Math.pow(this.playerData.level, 1.3),
      );
      this.playerData.maxHp += 10;
      this.playerData.maxEnergy += 5;
      leveled = true;
    }
    if (leveled) {
      this.playerData.hp = this.playerData.maxHp;
      this.playerData.energy = this.playerData.maxEnergy;
    }
  }

  syncUI() {
    this.updateUI({
      player: { ...this.playerData },
      activeQuest: this.activeQuest ? { ...this.activeQuest } : null,
      cooldowns: { ...this.cooldowns },
      showNpcDialog: this.questGiverNearby,
      damageTexts: [...this.damageTexts],
    });
  }

  draw() {
    // Clear & set camera
    this.ctx.fillStyle = "#1e90ff"; // ocean
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.save();
    this.ctx.translate(-this.camera.x, -this.camera.y);

    // Grid lines for ocean
    this.ctx.strokeStyle = "rgba(255,255,255,0.1)";
    for (let i = 0; i < WORLD_WIDTH; i += 100) {
      this.ctx.beginPath();
      this.ctx.moveTo(i, 0);
      this.ctx.lineTo(i, WORLD_HEIGHT);
      this.ctx.stroke();
      this.ctx.beginPath();
      this.ctx.moveTo(0, i);
      this.ctx.lineTo(WORLD_WIDTH, i);
      this.ctx.stroke();
    }

    // Draw Islands
    for (const is of this.islands) {
      this.ctx.fillStyle = is.color;
      this.ctx.fillRect(is.x, is.y, is.w, is.h);
      this.ctx.fillStyle = "rgba(0,0,0,0.3)";
      this.ctx.font = "24px sans-serif";
      this.ctx.fillText(is.name, is.x + 20, is.y + 40);
    }

    // Draw Portals
    for (const p of this.portals) {
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 20, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Draw Obstacles
    for (const obs of this.obstacles) {
      this.ctx.fillStyle = obs.color;
      this.ctx.fillRect(obs.x, obs.y, obs.w, obs.h);
    }

    // Draw NPC
    this.ctx.fillStyle = this.npc.color;
    this.ctx.fillRect(
      this.npc.x - this.npc.w / 2,
      this.npc.y - this.npc.h / 2,
      this.npc.w,
      this.npc.h,
    );
    this.ctx.fillStyle = "white";
    this.ctx.fillText("Quest", this.npc.x - 25, this.npc.y - 25);

    // Draw Enemies
    for (const e of this.enemies) {
      this.ctx.fillStyle = e.frozen ? "cyan" : e.color;
      this.ctx.fillRect(e.x - e.size, e.y - e.size, e.size * 2, e.size * 2);

      // HP Bar
      this.ctx.fillStyle = "black";
      this.ctx.fillRect(e.x - 20, e.y - e.size - 10, 40, 5);
      this.ctx.fillStyle = "red";
      this.ctx.fillRect(e.x - 20, e.y - e.size - 10, 40 * (e.hp / e.maxHp), 5);
    }

    // Draw Player
    this.ctx.fillStyle = "blue";
    this.ctx.beginPath();
    this.ctx.arc(this.playerPos.x, this.playerPos.y, 20, 0, Math.PI * 2);
    this.ctx.fill();

    // Player Direction Indicator
    this.ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
    this.ctx.lineWidth = 3;
    this.ctx.beginPath();
    this.ctx.moveTo(this.playerPos.x, this.playerPos.y);
    this.ctx.lineTo(
      this.playerPos.x + this.playerDir.x * 40,
      this.playerPos.y + this.playerDir.y * 40,
    );
    this.ctx.stroke();

    // Draw AOEs
    for (const a of this.aoes) {
      this.ctx.fillStyle = a.color;
      this.ctx.beginPath();
      this.ctx.arc(a.x, a.y, a.radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Draw Projectiles
    for (const p of this.projectiles) {
      this.ctx.fillStyle = p.color;
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Draw Damage Text
    this.ctx.font = "bold 24px sans-serif";
    for (const dt of this.damageTexts) {
      this.ctx.fillStyle = dt.color;
      this.ctx.strokeStyle = "black";
      this.ctx.lineWidth = 2;
      this.ctx.strokeText(dt.text, dt.x, dt.y);
      this.ctx.fillText(dt.text, dt.x, dt.y);
    }

    this.ctx.restore();

    // We send minor updates that don't need React re-render (like camera pos if we wanted a minimap)
  }
}
