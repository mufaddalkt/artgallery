import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

// Run with Node after installing the app dependencies. This executes the real TS module.
const app = resolve(import.meta.dirname, '..');
const require = createRequire(resolve(app, 'package.json'));
const ts = require('typescript');
const threeUrl = pathToFileURL(resolve(app, 'node_modules/three/build/three.module.js')).href;
const THREE = await import(threeUrl);
const source = await readFile(resolve(app, 'src/scene/timeline.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const moduleText = compiled.outputText.replace(/from ['"]three['"]/g, `from '${threeUrl}'`);
const { sampleTimeline, ART_STOPS, ART_Z, ART_HEIGHTS } = await import(`data:text/javascript;base64,${Buffer.from(moduleText).toString('base64')}`);
const catalogueSource = await readFile(resolve(app, 'src/data/artworks.ts'), 'utf8');
const catalogueCompiled = ts.transpileModule(catalogueSource, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } });
const { artworks } = await import(`data:text/javascript;base64,${Buffer.from(catalogueCompiled.outputText).toString('base64')}`);
const dimensions = ART_HEIGHTS.map((height, index) => ({ height, width: height * artworks[index].width / artworks[index].height }));
const aspects = [16 / 9, 4 / 3, 1, 390 / 844, 360 / 900];
let samples = 0;
let maxStep = 0;
let maxTurn = 0;
let maxPortalX = 0;
const projectionBounds = [];

for (const aspect of aspects) {
  let previous;
  const recorded = [];
  for (let index = 0; index <= 20000; index += 1) {
    const p = index / 20000;
    const result = sampleTimeline(p, aspect, dimensions);
    const { position, quaternion, doorOpen, infoOpacity } = result;
    assert.ok([...position.toArray(), ...quaternion.toArray(), doorOpen, infoOpacity].every(Number.isFinite), `finite values at ${p}`);
    assert.ok(Math.abs(position.y - 1.66) < 1e-12, `standing eye height at ${p}`);
    assert.ok(Math.abs(quaternion.length() - 1) < 1e-10, `unit quaternion at ${p}`);
    const entranceLimit = Math.max(10, 7.35 / (2 * Math.tan(THREE.MathUtils.degToRad(52) / 2) * aspect * .92) + .91);
    assert.ok(Math.abs(position.x) < 6.3 && position.z <= entranceLimit + .000001 && position.z >= -84.000001, `outer walls at ${p}`);
    assert.ok(doorOpen >= 0 && doorOpen <= 1 && infoOpacity >= 0 && infoOpacity <= 1);
    if (position.z <= 3.0) assert.equal(doorOpen, 1, `doors fully open before entry at ${p}`);
    for (const z of [-19, -38, -57, -77]) {
      if (Math.abs(position.z - z) < 0.65) {
        maxPortalX = Math.max(maxPortalX, Math.abs(position.x));
        assert.ok(Math.abs(position.x) < 2.15, `portal clearance at ${p}`);
      }
    }
    for (let room = 0; room < 4; room += 1) {
      for (const side of [-1, 1]) {
        const insideBenchX = Math.abs(position.x - side * 5.9) < 2.23 / 2 + 0.35;
        const insideBenchZ = Math.abs(position.z - (-19 * room - 3.6)) < 0.71 / 2 + 0.35;
        assert.ok(!(insideBenchX && insideBenchZ), `walking clearance from bench at ${p}`);
      }
    }
    if (previous) {
      const distance = position.distanceTo(previous.position);
      const turn = quaternion.angleTo(previous.quaternion);
      maxStep = Math.max(maxStep, distance);
      maxTurn = Math.max(maxTurn, turn);
      assert.ok(distance < 0.10, `position continuity at ${p}: ${distance}`);
      assert.ok(turn < 0.015, `rotation continuity at ${p}: ${turn}`);
      assert.ok(position.z <= previous.position.z + 1e-7, `route travels into museum at ${p}`);
    }
    if (index % 20 === 0) recorded.push([p, position.toArray(), quaternion.toArray(), doorOpen]);
    previous = result;
    samples += 1;
  }
  for (const [p, position, quaternion, doors] of recorded.reverse()) {
    const reverse = sampleTimeline(p, aspect, dimensions);
    assert.deepEqual(reverse.position.toArray(), position, `reverse position at ${p}`);
    assert.deepEqual(reverse.quaternion.toArray(), quaternion, `reverse orientation at ${p}`);
    assert.equal(reverse.doorOpen, doors);
  }
  for (let index = 0; index < ART_STOPS.length; index += 1) {
    const atStop = sampleTimeline(ART_STOPS[index], aspect, dimensions);
    for (const offset of [-0.0089, 0.0089]) {
      const held = sampleTimeline(ART_STOPS[index] + offset, aspect, dimensions);
      assert.deepEqual(held.position.toArray(), atStop.position.toArray(), 'position holds while reading');
      assert.deepEqual(held.quaternion.toArray(), atStop.quaternion.toArray(), 'orientation holds while reading');
      assert.equal(held.activeIndex, index);
      assert.equal(held.infoOpacity, 1);
    }
    const camera = new THREE.PerspectiveCamera(52, aspect, 0.05, 150);
    camera.position.copy(atStop.position);
    camera.quaternion.copy(atStop.quaternion);
    camera.updateMatrixWorld();
    const artX = index % 2 === 0 ? -7.72 : 7.72;
    const { width, height } = dimensions[index];
    const artY = Math.max(2.3, height / 2 + 0.55);
    let minY = 1;
    let maxY = -1;
    let maxX = 0;
    // Actual outer frame profile: 0.095m offset + 0.115m border,
    // and its front face projects 0.095m inward from the artwork anchor.
    for (const horizontal of [-1, 1]) for (const vertical of [-1, 1]) {
      const corner = new THREE.Vector3(artX - Math.sign(artX) * 0.095, artY + vertical * (height / 2 + 0.21), ART_Z[index] + horizontal * (width / 2 + 0.21)).project(camera);
      maxX = Math.max(maxX, Math.abs(corner.x));
      minY = Math.min(minY, corner.y);
      maxY = Math.max(maxY, corner.y);
      assert.ok(Math.abs(corner.x) <= 0.995 && Math.abs(corner.y) <= 0.995, `framed artwork fits viewport ${index} at aspect ${aspect}: ${corner.toArray()}`);
      if (aspect < 0.6) assert.ok(corner.y > -0.12, 'mobile art leaves lower caption area clear');
    }
    projectionBounds.push({ aspect: +aspect.toFixed(3), artwork: index + 1, maxX: +maxX.toFixed(3), minY: +minY.toFixed(3), maxY: +maxY.toFixed(3) });
  }
}
assert.equal(sampleTimeline(-1, 1, dimensions).position.z, 10);
assert.equal(sampleTimeline(2, 1, dimensions).position.z, -84);
const changed = sampleTimeline(0.205, 1, dimensions);
changed.position.set(999, 999, 999);
assert.notEqual(sampleTimeline(0.205, 1, dimensions).position.x, 999, 'callers cannot mutate cached poses');
console.log(JSON.stringify({
  passed: true,
  samples,
  aspects,
  maxStepMeters: maxStep,
  maxTurnRadians: maxTurn,
  maxPortalOffsetMeters: maxPortalX,
  outerFrameProjection: {
    maxAbsoluteX: Math.max(...projectionBounds.map(bound => bound.maxX)),
    minimumY: Math.min(...projectionBounds.map(bound => bound.minY)),
    maximumY: Math.max(...projectionBounds.map(bound => bound.maxY)),
  },
  ...(process.argv.includes('--details') ? { projectionBounds } : {}),
}, null, 2));
