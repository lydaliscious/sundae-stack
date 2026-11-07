import type { Flavor } from "@/game/types";
import { FLAVOR, INK, SPRINKLE_COLORS } from "./palette";
import { circle, ellipse, fillInk, font, star, type Ctx } from "./shapes";
import { drawScoop } from "./sundae";

interface Particle {
  kind: "drop" | "sparkle" | "confetti" | "splat";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  color: string;
  life: number;
  age: number;
  rot: number;
  vr: number;
  gravity: number;
}

interface Tumbler {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vr: number;
  r: number;
  flavor: Flavor;
  age: number;
  seed: number;
}

interface FloatText {
  text: string;
  x: number;
  y: number;
  color: string;
  age: number;
  life: number;
  size: number;
}

const GRAVITY = 1900;

/** Cosmetic particles: droplets, sparkles, confetti, tumbling scoops, score pops. */
export class Effects {
  particles: Particle[] = [];
  tumblers: Tumbler[] = [];
  texts: FloatText[] = [];

  constructor(private floorY: number) {}

  clear() {
    this.particles = [];
    this.tumblers = [];
    this.texts = [];
  }

  splash(x: number, y: number, flavors: Flavor[], count: number, rand: () => number, upward = 1) {
    const palette = flavors.length ? flavors : (["vanilla"] as Flavor[]);
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.2;
      const sp = (380 + rand() * 520) * upward;
      this.particles.push({
        kind: "drop",
        x: x + (rand() - 0.5) * 60,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 7 + rand() * 9,
        color: FLAVOR[palette[i % palette.length]].splat,
        life: 1.6,
        age: 0,
        rot: 0,
        vr: 0,
        gravity: GRAVITY,
      });
    }
  }

  sparkle(x: number, y: number, count: number, rand: () => number, colors = ["#fff6a8", "#ffffff", "#ffd1e6"]) {
    for (let i = 0; i < count; i++) {
      const a = rand() * Math.PI * 2;
      const sp = 120 + rand() * 280;
      this.particles.push({
        kind: "sparkle",
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp - 80,
        r: 10 + rand() * 12,
        color: colors[i % colors.length],
        life: 0.7 + rand() * 0.4,
        age: 0,
        rot: rand() * Math.PI,
        vr: (rand() - 0.5) * 6,
        gravity: 120,
      });
    }
  }

  confetti(x: number, y: number, count: number, rand: () => number) {
    for (let i = 0; i < count; i++) {
      const a = -Math.PI / 2 + (rand() - 0.5) * 2.4;
      const sp = 500 + rand() * 500;
      this.particles.push({
        kind: "confetti",
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        r: 8 + rand() * 6,
        color: SPRINKLE_COLORS[i % SPRINKLE_COLORS.length],
        life: 1.6,
        age: 0,
        rot: rand() * Math.PI,
        vr: (rand() - 0.5) * 14,
        gravity: 1100,
      });
    }
  }

  tumble(x: number, y: number, r: number, flavor: Flavor, dir: number, i: number, rand: () => number) {
    this.tumblers.push({
      x,
      y,
      vx: dir * (220 + rand() * 260 + i * 40),
      vy: -260 - rand() * 260 - i * 30,
      rot: 0,
      vr: dir * (4 + rand() * 5),
      r,
      flavor,
      age: 0,
      seed: rand() * 100,
    });
  }

  text(text: string, x: number, y: number, color: string, size = 54, life = 1.1) {
    this.texts.push({ text, x, y, color, age: 0, life, size });
  }

  update(dt: number) {
    for (const p of this.particles) {
      p.age += dt;
      if (p.kind === "splat") continue;
      p.vy += p.gravity * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vr * dt;
      if (p.kind === "drop" && p.vy > 0 && p.y > this.floorY - 6) {
        p.kind = "splat";
        p.y = this.floorY - 2 + Math.random() * 8;
        p.age = 0;
        p.life = 1.2;
      }
    }
    this.particles = this.particles.filter((p) => p.age < p.life && p.y < 1200);
    for (const t of this.tumblers) {
      t.age += dt;
      t.vy += GRAVITY * dt;
      t.x += t.vx * dt;
      t.y += t.vy * dt;
      t.rot += t.vr * dt;
      if (t.y > this.floorY - t.r * 0.3 && t.vy > 0) {
        // Land with a splat, then vanish.
        this.particles.push({
          kind: "splat",
          x: t.x,
          y: this.floorY + 4,
          vx: 0,
          vy: 0,
          r: t.r * 0.9,
          color: FLAVOR[t.flavor].splat,
          life: 1.0,
          age: 0,
          rot: 0,
          vr: 0,
          gravity: 0,
        });
        t.age = 99;
      }
    }
    this.tumblers = this.tumblers.filter((t) => t.age < 3);
    for (const t of this.texts) {
      t.age += dt;
      t.y -= 70 * dt;
    }
    this.texts = this.texts.filter((t) => t.age < t.life);
  }

  drawBehind(ctx: Ctx) {
    for (const p of this.particles) {
      if (p.kind !== "splat") continue;
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, a);
      ellipse(ctx, p.x, p.y, p.r * 1.7, p.r * 0.5);
      ctx.fillStyle = p.color;
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  draw(ctx: Ctx) {
    for (const t of this.tumblers) {
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.rotate(t.rot);
      drawScoop(ctx, 0, 0, t.r, t.flavor, t.seed);
      ctx.restore();
    }
    for (const p of this.particles) {
      if (p.kind === "splat") continue;
      const a = 1 - p.age / p.life;
      ctx.globalAlpha = Math.max(0, Math.min(1, a * 1.6));
      if (p.kind === "drop") {
        const stretch = Math.min(1.8, 1 + Math.hypot(p.vx, p.vy) / 1400);
        ellipse(ctx, p.x, p.y, p.r, p.r * stretch, Math.atan2(p.vy, p.vx) + Math.PI / 2);
        fillInk(ctx, p.color, "rgba(91,58,63,0.5)", 2.5);
        ctx.fillStyle = "rgba(255,255,255,0.6)";
        circle(ctx, p.x - p.r * 0.3, p.y - p.r * 0.3, p.r * 0.28);
        ctx.fill();
      } else if (p.kind === "sparkle") {
        star(ctx, p.x, p.y, p.r * (0.6 + 0.4 * Math.sin(p.age * 18)), 0.35, 4, p.rot);
        fillInk(ctx, p.color, "rgba(255, 180, 90, 0.7)", 2);
      } else {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.r / 2, -p.r / 4, p.r, p.r / 2);
        ctx.restore();
      }
      ctx.globalAlpha = 1;
    }
    for (const t of this.texts) {
      const k = t.age / t.life;
      ctx.globalAlpha = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1;
      const pop = k < 0.15 ? 0.6 + (k / 0.15) * 0.4 : 1;
      ctx.font = font(700, t.size * pop);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.lineWidth = 10;
      ctx.strokeStyle = "#ffffff";
      ctx.lineJoin = "round";
      ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.lineWidth = 3;
      ctx.strokeStyle = INK;
      ctx.globalAlpha *= 0.25;
      ctx.strokeText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    }
  }
}
