import type { CourseStep, ParsedCourse, RoutePoint } from "./types";

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}

export function distanceBetween(a: RoutePoint, b: RoutePoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function bearingBetween(a: RoutePoint, b: RoutePoint): number {
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);

  const y = Math.sin(dLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

function angleDiff(fromDeg: number, toDegValue: number): number {
  let diff = toDegValue - fromDeg;
  while (diff > 180) diff -= 360;
  while (diff < -180) diff += 360;
  return diff;
}

function turnLabel(deltaDeg: number): string {
  const abs = Math.abs(deltaDeg);
  if (abs < 12) return "直進";
  if (abs < 45) return deltaDeg > 0 ? "ゆるく右カーブ" : "ゆるく左カーブ";
  if (abs < 100) return deltaDeg > 0 ? "右折" : "左折";
  return deltaDeg > 0 ? "急に右折" : "急に左折";
}

function interpolatePoint(a: RoutePoint, b: RoutePoint, t: number): RoutePoint {
  return {
    lat: a.lat + (b.lat - a.lat) * t,
    lon: a.lon + (b.lon - a.lon) * t,
    ele:
      a.ele !== undefined && b.ele !== undefined
        ? a.ele + (b.ele - a.ele) * t
        : (a.ele ?? b.ele),
  };
}

export function buildCourse(
  points: RoutePoint[],
  intervalM: number,
  name?: string
): ParsedCourse {
  const cumDist: number[] = [0];
  for (let i = 1; i < points.length; i++) {
    cumDist.push(cumDist[i - 1] + distanceBetween(points[i - 1], points[i]));
  }
  const totalDistanceM = cumDist[cumDist.length - 1];

  const targets: number[] = [];
  for (let d = 0; d < totalDistanceM; d += intervalM) targets.push(d);
  if (targets.length === 0 || totalDistanceM - targets[targets.length - 1] > intervalM * 0.1) {
    targets.push(totalDistanceM);
  } else {
    targets[targets.length - 1] = totalDistanceM;
  }

  const rawSteps: RoutePoint[] = targets.map((target) => {
    let segIndex = cumDist.findIndex((d) => d >= target);
    if (segIndex <= 0) segIndex = 1;
    const a = points[segIndex - 1];
    const b = points[segIndex];
    const segLen = cumDist[segIndex] - cumDist[segIndex - 1];
    const t = segLen > 0 ? (target - cumDist[segIndex - 1]) / segLen : 0;
    return interpolatePoint(a, b, Math.min(1, Math.max(0, t)));
  });

  const headings: number[] = new Array(rawSteps.length).fill(0);
  for (let i = 0; i < rawSteps.length; i++) {
    if (i < rawSteps.length - 1) {
      headings[i] = bearingBetween(rawSteps[i], rawSteps[i + 1]);
    } else {
      headings[i] = headings[i - 1] ?? 0;
    }
  }

  const steps: CourseStep[] = rawSteps.map((p, i) => {
    const delta = i === 0 ? 0 : angleDiff(headings[i - 1], headings[i]);
    let label: string;
    if (i === 0) label = "スタート";
    else if (i === rawSteps.length - 1) label = "ゴール";
    else label = turnLabel(delta);

    return {
      index: i,
      distanceM: targets[i],
      lat: p.lat,
      lon: p.lon,
      ele: p.ele,
      heading: headings[i],
      turnLabel: label,
      turnDeltaDeg: delta,
    };
  });

  const hasElevation = points.some((p) => p.ele !== undefined);

  return { name, rawPoints: points, steps, totalDistanceM, hasElevation };
}
