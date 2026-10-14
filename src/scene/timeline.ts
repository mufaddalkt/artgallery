import { CatmullRomCurve3, MathUtils, Matrix4, Quaternion, Vector3 } from 'three';

/** The same stops drive scrolling, artwork labels, doors, and keyboard navigation. */
export const ART_STOPS: number[] = [0.205, 0.302, 0.399, 0.496, 0.593, 0.690, 0.787, 0.884];
export const ART_Z: number[] = [-8, -13, -27, -32, -46, -51, -65, -70];
export const ART_HEIGHTS: number[] = [1.65, 1.75, 1.4, 3.0, 2.4, 2.2, 1.8, 1.85];
export const stopPositions = [0, ...ART_STOPS, 1];

type ArtworkDimensions = { width: number; height: number };
export type TimelineSample = {
  position: Vector3;
  quaternion: Quaternion;
  doorOpen: number;
  activeIndex: number;
  infoOpacity: number;
  roomIndex: number;
};
type Pose = { position: Vector3; quaternion: Quaternion };
type RotationKey = { at: number; quaternion: Quaternion };
type Journey = { start: number; end: number; curve: CatmullRomCurve3; rotations: RotationKey[] };
type Route = { entrance: Pose; threshold: Pose; views: Pose[]; journeys: Journey[] };

const EYE = 1.66;
const HOLD = 0.009;
const FADE = 0.020;
const FOV_TAN = Math.tan(MathUtils.degToRad(52) / 2);
const UP = new Vector3(0, 1, 0);
const DEFAULT_RATIOS = [0.67, 1.257, 0.855, 1.214, 1.60, 1.49, 0.78, 1.263];
let cachedSignature = '';
let cachedRoute: Route | undefined;

const ease = (value: number) => {
  const t = MathUtils.clamp(value, 0, 1);
  return MathUtils.clamp(t * t * t * (t * (t * 6 - 15) + 10), 0, 1);
};
const point = (x: number, z: number) => new Vector3(x, EYE, z);

function facing(position: Vector3, target: Vector3) {
  return new Quaternion().setFromRotationMatrix(new Matrix4().lookAt(position, target, UP));
}

function makeJourney(start: number, end: number, points: Vector3[], rotations: RotationKey[]): Journey {
  const curve = new CatmullRomCurve3(points, false, 'centripetal');
  // Arc-length sampling makes the long room crossings and short approaches consistent.
  curve.arcLengthDivisions = 320;
  curve.updateArcLengths();
  return { start, end, curve, rotations };
}

function buildRoute(aspect: number, dimensions: ArtworkDimensions[]): Route {
  const mobile = MathUtils.clamp((1.25 - aspect) / 0.70, 0, 1);
  // Keep the complete doorway and inscription visible on portrait screens.
  const entranceDistance = Math.max(10, 7.35 / (2 * FOV_TAN * aspect * .92) + .91);
  const entrancePosition = point(0, entranceDistance);
  const entrance = { position: entrancePosition, quaternion: facing(entrancePosition, new Vector3(0, 3.9, 0)) };
  const thresholdPosition = point(0, -3.5);
  const forward = facing(thresholdPosition, point(0, -20));
  const threshold = { position: thresholdPosition, quaternion: forward };

  const views = ART_STOPS.map((_, index): Pose => {
    const supplied = dimensions[index];
    const height = supplied && Number.isFinite(supplied.height) && supplied.height > 0 ? supplied.height : ART_HEIGHTS[index];
    const width = supplied && Number.isFinite(supplied.width) && supplied.width > 0 ? supplied.width : height * DEFAULT_RATIOS[index];
    const artX = index % 2 === 0 ? -7.72 : 7.72;
    const artY = Math.max(2.3, height / 2 + 0.55);
    const verticalHalf = MathUtils.lerp(0.64, 0.44, mobile);
    const heightDistance = (height + 0.42) / (2 * FOV_TAN * verticalHalf) + .10;
    const widthDistance = (width + 0.42) / (2 * FOV_TAN * aspect * 0.88) + .10;
    const distance = MathUtils.clamp(Math.max(4.25, heightDistance, widthDistance), 4.25, MathUtils.lerp(5.8, 13, mobile));
    const position = point(artX - Math.sign(artX) * distance, ART_Z[index]);
    // Compose paintings above center so the quiet caption area remains below them.
    // This is a slight downward gaze, never an artificial change in eye height.
    const screenCenter = MathUtils.lerp(0.20, 0.42, mobile);
    const pitch = Math.atan2(artY - EYE, distance) - Math.atan(screenCenter * FOV_TAN);
    const aimY = EYE + Math.tan(pitch) * distance;
    return { position, quaternion: facing(position, new Vector3(artX, aimY, ART_Z[index])) };
  });

  const journeys: Journey[] = [makeJourney(0.13, ART_STOPS[0] - HOLD, [
    threshold.position, point(0, -4.7), point(views[0].position.x * 0.55, -6.1), views[0].position,
  ], [
    { at: 0, quaternion: threshold.quaternion },
    { at: 1, quaternion: views[0].quaternion },
  ])];

  for (let index = 0; index < views.length - 1; index += 1) {
    const from = views[index];
    const to = views[index + 1];
    const changesRoom = index % 2 === 1;
    let points: Vector3[];
    if (changesRoom) {
      const portalZ = -19 * ((index + 1) / 2);
      // The two central points keep the camera well inside the 5.5m portal.
      points = [from.position, point(from.position.x * 0.48, portalZ + 4.5), point(0, portalZ + 2.6),
        point(0, portalZ - 2.6), point(to.position.x * 0.48, portalZ - 5.5), to.position];
    } else {
      points = [from.position, point(0, (ART_Z[index] + ART_Z[index + 1]) / 2), to.position];
    }
    const rotations: RotationKey[] = changesRoom ? [
      { at: 0, quaternion: from.quaternion }, { at: 0.34, quaternion: forward },
      { at: 0.62, quaternion: forward }, { at: 1, quaternion: to.quaternion },
    ] : [
      { at: 0, quaternion: from.quaternion }, { at: 0.5, quaternion: forward }, { at: 1, quaternion: to.quaternion },
    ];
    journeys.push(makeJourney(ART_STOPS[index] + HOLD, ART_STOPS[index + 1] - HOLD, points, rotations));
  }

  const last = views[views.length - 1];
  const endPosition = point(0, -84);
  const endQuaternion = facing(endPosition, new Vector3(0, 1.8, -91));
  journeys.push(makeJourney(ART_STOPS[ART_STOPS.length - 1] + HOLD, 1, [
    last.position, point(last.position.x * 0.48, -72.5), point(0, -74.4), point(0, -79.6), endPosition,
  ], [
    { at: 0, quaternion: last.quaternion }, { at: 0.38, quaternion: forward }, { at: 1, quaternion: endQuaternion },
  ]));
  return { entrance, threshold, views, journeys };
}

function sampleJourney(journey: Journey, progress: number): Pose {
  const t = ease((progress - journey.start) / (journey.end - journey.start));
  const position = journey.curve.getPointAt(t);
  let index = 0;
  while (index < journey.rotations.length - 2 && t > journey.rotations[index + 1].at) index += 1;
  const from = journey.rotations[index];
  const to = journey.rotations[index + 1];
  const mix = ease((t - from.at) / (to.at - from.at));
  return { position, quaternion: from.quaternion.clone().slerp(to.quaternion, mix) };
}

/** Pure, reversible pose sampling. Returned objects never alias the cached route. */
export function sampleTimeline(progress: number, aspect: number, dimensions: ArtworkDimensions[]): TimelineSample {
  const p = Number.isFinite(progress) ? MathUtils.clamp(progress, 0, 1) : 0;
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 16 / 9;
  const signature = `${safeAspect.toFixed(5)}:${dimensions.map(({ width, height }) => `${width},${height}`).join(';')}`;
  if (!cachedRoute || signature !== cachedSignature) {
    cachedRoute = buildRoute(safeAspect, dimensions);
    cachedSignature = signature;
  }
  const route = cachedRoute;
  let pose: Pose;
  let activeIndex = -1;
  let infoOpacity = 0;
  for (let index = 0; index < ART_STOPS.length; index += 1) {
    const distance = Math.abs(p - ART_STOPS[index]);
    if (distance < HOLD + FADE) {
      activeIndex = index;
      infoOpacity = 1 - ease((distance - HOLD) / FADE);
      break;
    }
  }

  const stationaryIndex = ART_STOPS.findIndex(stop => Math.abs(p - stop) <= HOLD + 1e-10);
  if (stationaryIndex >= 0) {
    const view = route.views[stationaryIndex];
    pose = { position: view.position.clone(), quaternion: view.quaternion.clone() };
  } else if (p <= 0.095) {
    const startZ = route.entrance.position.z;
    const closeZ = Math.max(8.6, startZ - 1.4);
    const z = p <= 0.065 ? MathUtils.lerp(startZ, closeZ, ease(p / 0.065)) : MathUtils.lerp(closeZ, 7.8, ease((p - 0.065) / 0.03));
    pose = { position: point(0, z), quaternion: route.entrance.quaternion.clone() };
  } else if (p < 0.13) {
    const t = ease((p - 0.095) / 0.035);
    pose = { position: point(0, MathUtils.lerp(7.8, -3.5, t)), quaternion: route.entrance.quaternion.clone().slerp(route.threshold.quaternion, t) };
  } else {
    const journey = route.journeys.find(candidate => p <= candidate.end) ?? route.journeys[route.journeys.length - 1];
    pose = sampleJourney(journey, p);
  }
  const z = pose.position.z;
  const roomIndex = z > -19 ? 0 : z > -38 ? 1 : z > -57 ? 2 : z > -77 ? 3 : 4;
  return { ...pose, doorOpen: ease((p - 0.008) / 0.087), activeIndex, infoOpacity, roomIndex };
}
