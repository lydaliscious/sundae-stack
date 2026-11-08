import { describe, expect, it } from "vitest";
import { CalibrationFlow, StillnessDetector } from "./calibration";
import {
  applyDeadband,
  CALIBRATION_LIMITS,
  defaultCalibration,
  hipMidpoint,
  makeCalibration,
  mirrorX,
  smoothToward,
  toUnit,
  unitToWorld,
} from "./mapping";
import { Movement } from "./movement";
import { TrackingMonitor, type HipSample } from "./tracking";

describe("mirroring", () => {
  it("maps a physical step right to screen right", () => {
    // Facing the TV, a step to the player's right moves their hips toward the camera frame's left.
    const camStandingCenter = 0.5;
    const camAfterStepRight = 0.4;
    expect(mirrorX(camAfterStepRight)).toBeGreaterThan(mirrorX(camStandingCenter));
    const cal = defaultCalibration(mirrorX(camStandingCenter));
    expect(toUnit(mirrorX(camAfterStepRight), cal)).toBeGreaterThan(0);
  });

  it("uses only the hips' midpoint", () => {
    expect(hipMidpoint({ x: 0.4 }, { x: 0.6 })).toBeCloseTo(0.5);
  });
});

describe("calibration mapping", () => {
  it("one recorded step lands halfway; two steps reach the edge", () => {
    const cal = makeCalibration(0.5, 0.4, 0.62);
    expect(toUnit(0.5, cal)).toBe(0);
    expect(toUnit(0.4, cal)).toBeCloseTo(-0.5);
    expect(toUnit(0.62, cal)).toBeCloseTo(0.5);
    expect(toUnit(0.3, cal)).toBeCloseTo(-1);
    expect(toUnit(0.74, cal)).toBeCloseTo(1);
    // Proportional on each side (asymmetric ranges allowed).
    expect(toUnit(0.45, cal)).toBeCloseTo(-0.25);
    expect(toUnit(0.56, cal)).toBeCloseTo(0.25);
    // Beyond two steps: clamp to the edge.
    expect(toUnit(0.95, cal)).toBe(1);
    expect(toUnit(0.05, cal)).toBe(-1);
  });

  it("is absolute: the same stance always gives the same position", () => {
    const cal = makeCalibration(0.5, 0.42, 0.58);
    const readings = [0.5, 0.45, 0.58, 0.45, 0.5];
    const out = readings.map((x) => toUnit(x, cal));
    expect(out[1]).toBe(out[3]);
    expect(out[0]).toBe(out[4]);
    expect(out[0]).toBe(0);
  });

  it("covers the full playable width with two small steps each way", () => {
    const cal = makeCalibration(0.5, 0.45, 0.55);
    expect(unitToWorld(toUnit(0.45, cal), 240, 1680)).toBeCloseTo(600);
    expect(unitToWorld(toUnit(0.4, cal), 240, 1680)).toBeCloseTo(240);
    expect(unitToWorld(toUnit(0.6, cal), 240, 1680)).toBeCloseTo(1680);
    expect(unitToWorld(toUnit(0.5, cal), 240, 1680)).toBe(960);
  });

  it("detects a camera that is already mirrored", () => {
    const cal = makeCalibration(0.5, 0.6, 0.4);
    expect(cal.flipped).toBe(true);
    expect(toUnit(0.6, cal)).toBeCloseTo(-0.5);
    expect(toUnit(0.4, cal)).toBeCloseTo(0.5);
    expect(toUnit(0.7, cal)).toBeCloseTo(-1);
    expect(toUnit(0.5, cal)).toBe(0);
  });

  it("enforces a minimum range and a centre between the sides", () => {
    const tiny = makeCalibration(0.5, 0.495, 0.505);
    expect(tiny.center - tiny.left).toBeGreaterThanOrEqual(CALIBRATION_LIMITS.minHalfRange - 1e-9);
    expect(tiny.right - tiny.center).toBeGreaterThanOrEqual(CALIBRATION_LIMITS.minHalfRange - 1e-9);
    const odd = makeCalibration(0.7, 0.4, 0.6);
    expect(odd.center).toBeCloseTo(0.5);
  });
});

describe("deadband and smoothing", () => {
  it("ignores jitter inside the band", () => {
    let held = 0;
    for (const r of [0.01, -0.015, 0.02, -0.01]) held = applyDeadband(r, held, 0.025);
    expect(held).toBe(0);
  });

  it("follows real movement as soon as it leaves the band", () => {
    expect(applyDeadband(0.5, 0, 0.025)).toBe(0.5);
    expect(applyDeadband(-0.03, 0, 0.025)).toBe(-0.03);
    expect(applyDeadband(0, 0.4, 0.025)).toBe(0);
  });

  it("smooths exponentially and independently of frame rate", () => {
    const a = smoothToward(0, 1, 0.1, 0.1);
    let b = 0;
    for (let i = 0; i < 10; i++) b = smoothToward(b, 1, 0.01, 0.1);
    expect(a).toBeCloseTo(1 - Math.exp(-1));
    expect(b).toBeCloseTo(a, 6);
    expect(smoothToward(0.3, 0.3, 0.016, 0.1)).toBe(0.3);
  });
});

describe("movement", () => {
  it("stays put when the player stops, and returns to centre", () => {
    const m = new Movement();
    m.setTarget(0.6);
    for (let i = 0; i < 120; i++) m.update(1 / 120);
    const x = m.worldX;
    for (let i = 0; i < 120; i++) m.update(1 / 120);
    expect(m.worldX).toBeCloseTo(x, 0);
    m.setTarget(0);
    for (let i = 0; i < 240; i++) m.update(1 / 120);
    expect(m.worldX).toBeCloseTo(960, 0);
  });

  it("standing left places the toddler left without continuous drift", () => {
    const m = new Movement();
    m.setTarget(-1);
    for (let i = 0; i < 240; i++) m.update(1 / 120);
    expect(m.worldX).toBeCloseTo(240, 0);
    for (let i = 0; i < 600; i++) m.update(1 / 120);
    expect(m.worldX).toBeCloseTo(240, 0);
  });

  it("arrow keys move the same absolute target through the same smoothing", () => {
    const m = new Movement();
    m.setKey("right", true);
    for (let i = 0; i < 30; i++) m.update(1 / 120);
    m.setKey("right", false);
    const target = m.target;
    expect(target).toBeGreaterThan(0.4);
    for (let i = 0; i < 240; i++) m.update(1 / 120);
    expect(m.position).toBeCloseTo(target, 2);
    m.setKey("left", true);
    for (let i = 0; i < 400; i++) m.update(1 / 120);
    expect(m.worldX).toBeCloseTo(240, 0);
  });
});

describe("tracking loss", () => {
  const sample = (t: number, x = 0.5, over: Partial<HipSample> = {}): HipSample => ({ t, x, confidence: 0.9, people: 1, ...over });

  function acquire(m: TrackingMonitor, until = 1) {
    for (let t = 0; t <= until; t += 1 / 30) m.update(sample(t));
  }

  it("needs stable tracking before it counts", () => {
    const m = new TrackingMonitor();
    m.update(sample(0));
    expect(m.status).toBe("searching");
    acquire(m);
    expect(m.status).toBe("tracking");
  });

  it("freezes on low hip confidence after a short grace", () => {
    const m = new TrackingMonitor();
    acquire(m);
    m.update(sample(1.05, 0.5, { confidence: 0.2 }));
    expect(m.status).toBe("tracking");
    m.update(sample(1.3, 0.5, { confidence: 0.2 }));
    expect(m.status).toBe("lost");
    expect(m.problem).toBe("low-confidence");
  });

  it("freezes when several people are in frame, or nobody", () => {
    const m = new TrackingMonitor();
    acquire(m);
    m.update(sample(1.05, 0.5, { people: 2 }));
    m.update(sample(1.3, 0.5, { people: 2 }));
    expect(m.status).toBe("lost");
    expect(m.problem).toBe("multiple-people");
    const n = new TrackingMonitor();
    acquire(n);
    n.update(sample(1.05, 0.5, { people: 0 }));
    n.update(sample(1.3, 0.5, { people: 0 }));
    expect(n.status).toBe("lost");
  });

  it("treats implausible jumps as ambiguous", () => {
    const m = new TrackingMonitor();
    acquire(m);
    m.update(sample(1.04, 0.9));
    m.update(sample(1.08, 0.1));
    m.update(sample(1.3, 0.9));
    expect(m.status).toBe("lost");
    expect(m.problem).toBe("jump");
    // A fast but humanly possible step is fine.
    const ok = new TrackingMonitor();
    acquire(ok);
    for (let i = 1; i <= 10; i++) ok.update(sample(1 + i / 30, 0.5 + i * 0.02));
    expect(ok.status).toBe("tracking");
  });

  it("freezes when samples stop arriving", () => {
    const m = new TrackingMonitor();
    acquire(m);
    expect(m.tick(1.2)).toBe("tracking");
    expect(m.tick(2)).toBe("lost");
  });

  it("resumes only after tracking has been stable again", () => {
    const m = new TrackingMonitor();
    acquire(m);
    m.update(sample(1.1, 0.5, { people: 0 }));
    m.update(sample(1.4, 0.5, { people: 0 }));
    expect(m.status).toBe("lost");
    m.update(sample(1.5, 0.6));
    expect(m.status).toBe("lost");
    for (let t = 1.5; t < 2.1; t += 1 / 30) m.update(sample(t, 0.6));
    expect(m.status).toBe("tracking");
    expect(m.x).toBeCloseTo(0.6);
  });

  it("a stranger appearing elsewhere is not followed until they hold still", () => {
    const m = new TrackingMonitor();
    acquire(m);
    m.update(sample(1.04, 0.95));
    expect(m.x).toBeCloseTo(0.5);
  });
});

describe("calibration capture", () => {
  it("records a position once the player holds still", () => {
    const d = new StillnessDetector({ holdSeconds: 1, tolerance: 0.02, minStep: 0.03 });
    let out = d.push(0, 0.5);
    for (let t = 0.1; t < 0.95; t += 0.1) out = d.push(t, 0.5 + (Math.round(t * 10) % 2 ? 0.005 : -0.005));
    expect(out.value).toBeNull();
    expect(out.progress).toBeGreaterThan(0.8);
    out = d.push(1.05, 0.5);
    expect(out.value).toBeCloseTo(0.5, 2);
  });

  it("restarts the hold when the player moves", () => {
    const d = new StillnessDetector({ holdSeconds: 1, tolerance: 0.02, minStep: 0.03 });
    for (let t = 0; t < 0.8; t += 0.1) d.push(t, 0.5);
    const out = d.push(0.85, 0.6);
    expect(out.progress).toBe(0);
  });

  it("walks centre → left → right and builds the calibration", () => {
    const flow = new CalibrationFlow({ holdSeconds: 0.5, tolerance: 0.02, minStep: 0.03 });
    let t = 0;
    const hold = (x: number) => {
      for (let i = 0; i < 20; i++) {
        t += 1 / 30;
        if (flow.push(t, x)) return true;
      }
      return false;
    };
    expect(hold(0.5)).toBe(true);
    expect(flow.step).toBe("left");
    // Standing at the centre doesn't count as the left position.
    expect(hold(0.5)).toBe(false);
    expect(hold(0.42)).toBe(true);
    expect(flow.step).toBe("right");
    // The right position has to be on the other side.
    expect(hold(0.4)).toBe(false);
    expect(hold(0.6)).toBe(true);
    expect(flow.step).toBe("test");
    // The recorded steps are halfway: the edges sit two steps out.
    expect(flow.calibration).toMatchObject({ center: 0.5, left: expect.closeTo(0.34, 2), right: expect.closeTo(0.7, 2), flipped: false });
  });
});
