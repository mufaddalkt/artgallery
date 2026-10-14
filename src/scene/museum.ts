import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createArchitecture } from './architecture';
import { createPaintings } from './paintings';
import { sampleTimeline, stopPositions } from './timeline';

export interface MuseumOptions {
  getProgress: () => number;
  getReducedMotion: () => boolean;
  getFreeLook: () => boolean;
  onFrame: (progress: number, active: number, opacity: number, room: number) => void;
  onReady: () => void;
  onError: () => void;
  onLoad: (count: number) => void;
}

export function createMuseum(canvas: HTMLCanvasElement, options: MuseumOptions) {
  const mobile = window.innerWidth < 700;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: !mobile, powerPreference: 'high-performance', alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, mobile ? 1.35 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = .88;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#292b26');
  scene.fog = new THREE.Fog('#d4cabc', 45, 115);
  const camera = new THREE.PerspectiveCamera(52, window.innerWidth / window.innerHeight, .08, 150);
  const environment = new RoomEnvironment();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTarget = pmrem.fromScene(environment, .035);
  scene.environment = envTarget.texture; scene.environmentIntensity = .34;
  environment.dispose(); pmrem.dispose();
  const architecture = createArchitecture(scene);
  let dirty = true;
  const paintings = createPaintings(scene, renderer, count => { dirty = true; options.onLoad(count); });
  const mouse = new THREE.Vector2(); const currentMouse = new THREE.Vector2();
  const lookEuler = new THREE.Euler(0, 0, 0, 'YXZ');
  const lookQuaternion = new THREE.Quaternion();
  let progress = options.getProgress();
  let lastTime = performance.now(); let lastUi = 0; let lastRender = 0; let frame = 0; let frames = 0; let slowTime = 0;
  let lastProgress = -1; let lastSampled = -1; let lastReduced = options.getReducedMotion(); let lastLoadedIndex = -2; let visible = !document.hidden; let disposed = false;
  let ready = false;
  const resize = () => { camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix(); renderer.setSize(window.innerWidth, window.innerHeight, false); lastProgress = -1; };
  const pointer = (e: PointerEvent) => { mouse.set((e.clientX / window.innerWidth - .5) * 2, (e.clientY / window.innerHeight - .5) * 2); };
  const visibility = () => { visible = !document.hidden; lastTime = performance.now(); };
  const lost = (e: Event) => { e.preventDefault(); options.onError(); };
  window.addEventListener('resize', resize); window.addEventListener('pointermove', pointer);
  document.addEventListener('visibilitychange', visibility); canvas.addEventListener('webglcontextlost', lost);
  resize();
  function animate(time: number) {
    if (disposed) return;
    frame = requestAnimationFrame(animate);
    if (!visible) return;
    const dt = Math.min((time - lastTime) / 1000, .1); lastTime = time;
    const target = THREE.MathUtils.clamp(options.getProgress(), 0, 1);
    const reduced = options.getReducedMotion();
    // ScrollTrigger owns smoothing; never add a second animation timeline here.
    progress = target;
    // Reduced motion offers stationary viewing poses rather than a moving camera.
    const sampled = reduced ? stopPositions.reduce((a, b) => Math.abs(b - progress) < Math.abs(a - progress) ? b : a) : progress;
    const state = sampleTimeline(sampled, camera.aspect, paintings.dimensions);
    camera.position.copy(state.position); camera.quaternion.copy(state.quaternion);
    const freeLook = options.getFreeLook() && !reduced && !mobile;
    const lookSettling = currentMouse.lengthSq() > .000001;
    currentMouse.lerp(freeLook ? mouse : new THREE.Vector2(), 1 - Math.exp(-dt * 7));
    lookEuler.set(-currentMouse.y * .009, -currentMouse.x * .014, 0); lookQuaternion.setFromEuler(lookEuler); camera.quaternion.multiply(lookQuaternion);
    architecture.leftDoor.rotation.y = state.doorOpen * 1.43;
    architecture.rightDoor.rotation.y = state.doorOpen * -1.43;
    architecture.doorLight.intensity = 12 + state.doorOpen * 135;
    const index = Math.max(0, state.activeIndex >= 0 ? state.activeIndex : Math.floor((progress - .15) / .097));
    if (index !== lastLoadedIndex) { paintings.preload(index); lastLoadedIndex = index; }
    if (time - lastUi > 65) { options.onFrame(reduced ? sampled : progress, state.activeIndex, state.infoOpacity, state.roomIndex); lastUi = time; }
    const changing = Math.abs(progress - lastProgress) > .000001 || sampled !== lastSampled || reduced !== lastReduced || freeLook || lookSettling || dirty || !ready;
    if (changing) {
      renderer.render(scene, camera); lastRender = time;
      if (!ready) { ready = true; options.onReady(); }
      lastProgress = progress; lastSampled = sampled; lastReduced = reduced; dirty = false;
      // Conservative one-way quality adjustment; never oscillate the resolution.
      if (dt > .035 && dt < .1) slowTime += dt;
      frames++;
      if (frames > 150 && slowTime > 2.5 && renderer.getPixelRatio() > 1) { renderer.setPixelRatio(Math.max(1, renderer.getPixelRatio() - .25)); resize(); slowTime = 0; frames = 0; }
    } else if (time - lastRender > 800) { renderer.render(scene, camera); lastRender = time; }
  }
  frame = requestAnimationFrame(animate);
  return {
    dispose: () => {
      disposed = true; cancelAnimationFrame(frame);
      window.removeEventListener('resize', resize); window.removeEventListener('pointermove', pointer);
      document.removeEventListener('visibilitychange', visibility); canvas.removeEventListener('webglcontextlost', lost);
      paintings.dispose(); architecture.dispose(); envTarget.dispose(); scene.clear(); renderer.dispose();
    },
  };
}
