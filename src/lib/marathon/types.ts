export interface RoutePoint {
  lat: number;
  lon: number;
  ele?: number;
}

export interface CourseStep {
  index: number;
  distanceM: number;
  lat: number;
  lon: number;
  ele?: number;
  heading: number;
  turnLabel: string;
  turnDeltaDeg: number;
}

export interface ParsedCourse {
  name?: string;
  rawPoints: RoutePoint[];
  steps: CourseStep[];
  totalDistanceM: number;
  hasElevation: boolean;
}
