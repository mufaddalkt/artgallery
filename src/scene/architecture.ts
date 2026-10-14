import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { createMuseumMaterials } from './materials';

export interface MuseumArchitecture {
  leftDoor: THREE.Group;
  rightDoor: THREE.Group;
  doorLight: THREE.SpotLight;
  dispose: () => void;
}

/** A complete world in metres, with unobstructed sight lines along the camera route. */
export function createArchitecture(scene: THREE.Scene): MuseumArchitecture {
  RectAreaLightUniformsLib.init();
  const root = new THREE.Group();
  root.name = 'The Living Gallery · architecture';
  scene.add(root);
  const m = createMuseumMaterials();
  const geometries = new Set<THREE.BufferGeometry>();
  const ownMaterials = new Set<THREE.Material>();
  const ownTextures = new Set<THREE.Texture>();
  const cube = new THREE.BoxGeometry(1, 1, 1);
  geometries.add(cube);
  const cylinders = new THREE.CylinderGeometry(1, 1, 1, 24);
  geometries.add(cylinders);
  const batches = new Map<string, { geometry: THREE.BufferGeometry; material: THREE.Material; matrices: THREE.Matrix4[] }>();
  const localBatches = new Map<THREE.Object3D, Map<THREE.Material, THREE.Matrix4[]>>();
  const transform = new THREE.Object3D();

  const instance = (geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number, sx: number, sy: number, sz: number, rotationY = 0) => {
    const key = `${geometry.uuid}:${material.uuid}`;
    let batch = batches.get(key);
    if (!batch) {
      batch = { geometry, material, matrices: [] };
      batches.set(key, batch);
    }
    transform.position.set(x, y, z);
    transform.rotation.set(0, rotationY, 0);
    transform.scale.set(sx, sy, sz);
    transform.updateMatrix();
    batch.matrices.push(transform.matrix.clone());
  };
  const box = (material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number, rotationY = 0) => {
    instance(cube, material, x, y, z, width, height, depth, rotationY);
  };
  const cylinder = (material: THREE.Material, x: number, y: number, z: number, radius: number, height: number) => {
    instance(cylinders, material, x, y, z, radius, height, radius);
  };
  const mesh = (geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D, x = 0, y = 0, z = 0) => {
    geometries.add(geometry);
    const object = new THREE.Mesh(geometry, material);
    object.position.set(x, y, z);
    object.castShadow = true;
    object.receiveShadow = true;
    parent.add(object);
    return object;
  };
  const localBox = (parent: THREE.Object3D, material: THREE.Material, x: number, y: number, z: number, width: number, height: number, depth: number) => {
    let parentBatches = localBatches.get(parent);
    if (!parentBatches) {
      parentBatches = new Map();
      localBatches.set(parent, parentBatches);
    }
    let matrices = parentBatches.get(material);
    if (!matrices) {
      matrices = [];
      parentBatches.set(material, matrices);
    }
    transform.position.set(x, y, z);
    transform.rotation.set(0, 0, 0);
    transform.scale.set(width, height, depth);
    transform.updateMatrix();
    matrices.push(transform.matrix.clone());
  };

  // Baked soft contact occlusion supplements the deliberately limited shadow budget.
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const shadowContext = shadowCanvas.getContext('2d')!;
  const gradient = shadowContext.createRadialGradient(64, 64, 10, 64, 64, 64);
  gradient.addColorStop(0, 'rgba(28, 23, 18, 0.25)');
  gradient.addColorStop(0.43, 'rgba(28, 23, 18, 0.17)');
  gradient.addColorStop(1, 'rgba(28, 23, 18, 0)');
  shadowContext.fillStyle = gradient;
  shadowContext.fillRect(0, 0, 128, 128);
  const contactTexture = new THREE.CanvasTexture(shadowCanvas);
  ownTextures.add(contactTexture);
  const contactMaterial = new THREE.MeshBasicMaterial({ map: contactTexture, transparent: true, depthWrite: false, toneMapped: false });
  ownMaterials.add(contactMaterial);
  const contactGeometry = new THREE.PlaneGeometry(1, 1);
  geometries.add(contactGeometry);
  const contact = (x: number, z: number, width: number, depth: number) => {
    const object = mesh(contactGeometry, contactMaterial, root, x, 0.021, z);
    object.rotation.x = -Math.PI / 2;
    object.scale.set(width, depth, 1);
    object.castShadow = false;
    object.receiveShadow = false;
  };

  // Typography is on the stone itself, not an overlay in the interface.
  const inscription = (text: string, width: number, height: number, color: string, fontSize: number, tracking = 0, serif = false) => {
    const canvas = document.createElement('canvas');
    canvas.width = 2048;
    canvas.height = Math.max(128, Math.round((height / width) * 2048));
    const context = canvas.getContext('2d')!;
    context.fillStyle = color;
    context.textBaseline = 'middle';
    context.font = `${fontSize}px ${serif ? 'Georgia, serif' : 'Arial, sans-serif'}`;
    if (tracking > 0) {
      const letters = [...text];
      const span = letters.reduce((total, letter) => total + context.measureText(letter).width, 0) + (letters.length - 1) * tracking;
      let x = (2048 - span) / 2;
      for (const letter of letters) {
        context.fillText(letter, x, canvas.height / 2);
        x += context.measureText(letter).width + tracking;
      }
    } else {
      context.textAlign = 'center';
      context.fillText(text, 1024, canvas.height / 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = 4;
    ownTextures.add(texture);
    const material = new THREE.MeshBasicMaterial({ map: texture, transparent: true, depthWrite: false, toneMapped: false });
    ownMaterials.add(material);
    return mesh(new THREE.PlaneGeometry(width, height), material, root);
  };

  // Continuous polished limestone paving; brass inlay defines the procession.
  const floor = mesh(new THREE.PlaneGeometry(24, 128), m.floor, root, 0, -0.008, -36);
  floor.rotation.x = -Math.PI / 2;
  floor.castShadow = false;
  for (const side of [-1, 1]) {
    box(m.brass, side * 2.98, 0.002, -39, 0.012, 0.006, 98);
    box(m.travertine, side * 7.58, 0.008, -38.5, 0.42, 0.015, 77);
  }
  for (const z of [0, -19, -38, -57, -77]) {
    box(m.brass, 0, 0.002, z, 15.4, 0.006, 0.018);
    box(m.brass, 0, 0.002, z - 0.18, 15.4, 0.006, 0.008);
  }

  // Entrance: massive ashlar facade, stepped jambs and properly hinged solid leaves.
  box(m.limestone, -6.75, 4.5, 0, 8.2, 9, 0.9);
  box(m.limestone, 6.75, 4.5, 0, 8.2, 9, 0.9);
  box(m.limestone, 0, 7.67, 0, 5.3, 2.74, 0.9);
  for (const side of [-1, 1]) {
    box(m.travertine, side * 3.05, 3.45, 0.41, 0.76, 6.9, 0.64);
    box(m.limestone, side * 3.1, 0.19, 0.48, 1.0, 0.38, 0.84);
    box(m.limestone, side * 3.1, 6.69, 0.48, 1.0, 0.3, 0.84);
    box(m.bronze, side * 2.686, 3.15, 0.18, 0.09, 6.3, 0.32);
    box(m.brass, side * 3.42, 3.48, 0.746, 0.014, 5.9, 0.012);
    for (let y = 0.9; y < 9; y += 1.35) {
      box(m.travertine, side * 7.0, y, 0.459, 7.0, 0.013, 0.008);
    }
    for (let x = 4.3; x < 10.4; x += 2.0) {
      box(m.travertine, side * x, 4.5, 0.459, 0.012, 9, 0.008);
    }
    // Tall wall lanterns: smoked bronze housing and luminous alabaster core.
    box(m.bronze, side * 4.27, 3.15, 0.64, 0.19, 1.55, 0.24);
    box(m.glow, side * 4.27, 3.15, 0.781, 0.12, 1.39, 0.05);
    box(m.brass, side * 4.27, 3.15, 0.818, 0.016, 1.5, 0.025);
    for (const y of [2.41, 3.89]) box(m.brass, side * 4.27, y, 0.77, 0.24, 0.035, 0.33);
  }
  box(m.limestone, 0, 6.95, 0.5, 7.35, 0.22, 1.03);
  box(m.bronze, 0, 6.31, 0.22, 5.41, 0.09, 0.34);
  box(m.brass, 0, 0.018, 0, 5.32, 0.032, 0.48);
  const title = inscription('THE LIVING GALLERY', 6.45, 0.56, '#967448', 121, 12);
  title.position.set(0, 7.8, 0.91);
  const subtitle = inscription('An encounter with timeless masterpieces.', 5.75, 0.3, '#887b67', 75, 1.5, true);
  subtitle.position.set(0, 7.24, 0.91);

  const makeDoor = (side: -1 | 1) => {
    const group = new THREE.Group();
    group.name = side < 0 ? 'West bronze door · true hinge' : 'East bronze door · true hinge';
    group.position.set(side * 2.65, 0, 0);
    root.add(group);
    const inward = -side;
    const center = inward * 1.322;
    localBox(group, m.bronze, center, 3.13, 0, 2.644, 6.24, 0.21);
    localBox(group, m.bronzePanel, center, 3.2, 0.122, 2.28, 5.6, 0.045);
    localBox(group, m.bronzePanel, center, 3.2, -0.122, 2.28, 5.6, 0.045);
    for (const face of [-1, 1]) {
      for (const x of [inward * 0.15, inward * 2.495]) {
        localBox(group, m.brass, x, 3.14, face * 0.151, 0.018, 5.98, 0.028);
      }
      for (const y of [0.22, 0.58, 3.11, 5.89, 6.1]) {
        localBox(group, m.bronze, center, y, face * 0.164, 2.39, y === 3.11 ? 0.1 : 0.064, 0.04);
        localBox(group, m.brass, center, y + 0.027, face * 0.192, 2.38, 0.012, 0.012);
      }
      // Fine vertical fluting in the patinated inset panels.
      for (let k = 0; k < 12; k++) {
        localBox(group, m.bronze, inward * (0.32 + k * 0.183), 3.24, face * 0.154, 0.016, 5.18, 0.016);
      }
      const pullX = inward * 2.28;
      localBox(group, m.bronze, pullX, 2.82, face * 0.22, 0.13, 1.36, 0.035);
      localBox(group, m.brass, pullX, 2.82, face * 0.36, 0.056, 1.23, 0.065);
      for (const y of [2.29, 3.35]) localBox(group, m.brass, pullX, y, face * 0.275, 0.065, 0.065, 0.23);
    }
    for (const y of [0.6, 3.15, 5.75]) {
      const hinge = mesh(cylinders, m.bronze, group, 0, y, -0.055);
      hinge.scale.set(0.115, 0.42, 0.115);
      for (const ringY of [y - 0.17, y + 0.17]) {
        const ring = mesh(cylinders, m.brass, group, 0, ringY, -0.055);
        ring.scale.set(0.12, 0.025, 0.12);
      }
      localBox(group, m.bronze, inward * 0.2, y, -0.14, 0.36, 0.27, 0.075);
    }
    return group;
  };
  const leftDoor = makeDoor(-1);
  const rightDoor = makeDoor(1);

  // Architectural gallery rooms, each with its own restrained material character.
  const roomMaterials = [m.plaster, m.midnight, m.limestone, m.sage];
  for (let room = 0; room < 4; room++) {
    const start = -19 * room;
    const length = room === 3 ? 20 : 19;
    const middle = start - length / 2;
    const wall = roomMaterials[room];
    const timber = room === 3;
    for (const side of [-1, 1]) {
      box(wall, side * 8.12, 3.9, middle, 0.3, 7.8, length);
      box(timber ? m.walnut : m.travertine, side * 7.93, 0.17, middle, 0.13, 0.34, length);
      box(m.brass, side * 7.844, 0.345, middle, 0.015, 0.022, length);
      box(timber ? m.walnut : m.travertine, side * 7.83, 7.18, middle, 0.34, 0.16, length);
      box(m.limestone, side * 7.76, 7.36, middle, 0.48, 0.13, length);
      box(m.glow, side * 7.59, 7.39, middle, 0.05, 0.045, length - 0.9);
      for (const localZ of [1.48, length - 1.48]) {
        const z = start - localZ;
        box(timber ? m.walnut : m.travertine, side * 7.76, 3.76, z, 0.3, 7.08, 0.59);
        box(m.limestone, side * 7.71, 0.31, z, 0.42, 0.24, 0.8);
        box(m.limestone, side * 7.69, 6.95, z, 0.45, 0.27, 0.83);
        box(m.brass, side * 7.585, 3.7, z, 0.025, 5.8, 0.025);
      }
      // Benches sit clear of both the central route and artwork viewing positions.
      const bx = side * 5.9;
      const bz = start - 3.6;
      contact(bx, bz, 3.0, 1.60);
      box(m.walnut, bx, 0.38, bz, 2.23, 0.12, 0.71);
      box(m.leather, bx, 0.485, bz, 2.16, 0.12, 0.67);
      box(m.leather, bx, 0.55, bz, 2.08, 0.028, 0.60);
      for (const offset of [-0.85, 0.85]) {
        box(m.bronze, bx + offset, 0.19, bz, 0.075, 0.36, 0.49);
        box(m.brass, bx + offset, 0.018, bz, 0.13, 0.025, 0.57);
      }
      // Small wall sconces occupy the entry bay, well outside artwork spans.
      const sx = side * 7.77;
      const sz = start - 3.0;
      box(m.bronze, sx, 3.4, sz, 0.14, 0.9, 0.13);
      box(m.glow, sx - side * 0.09, 3.4, sz, 0.07, 0.72, 0.085);
    }
    box(room === 1 ? m.midnight : m.ceiling, 0, 7.85, middle, 16.2, 0.3, length);
    // Stepped ceiling coffers and translucent skylights sit above the procession.
    for (const localZ of [3.4, 9.5, 15.6]) {
      const z = start - localZ;
      for (const x of [-5.05, 0, 5.05]) {
        const frame = timber ? m.walnut : m.travertine;
        box(m.dark, x, 7.64, z, 4.56, 0.055, 5.07);
        box(x === 0 ? m.skylight : m.ceiling, x, 7.608, z, 4.12, 0.055, 4.62);
        for (const side of [-1, 1]) {
          box(frame, x + side * 2.31, 7.48, z, 0.19, 0.27, 5.18);
          box(frame, x, 7.48, z + side * 2.51, 4.64, 0.27, 0.18);
          box(m.brass, x + side * 2.18, 7.42, z, 0.014, 0.02, 4.82);
        }
        if (x === 0) {
          for (const mullion of [-1.35, 0, 1.35]) box(m.bronze, mullion, 7.54, z, 0.035, 0.10, 4.69);
          box(m.bronze, 0, 7.54, z, 4.13, 0.10, 0.04);
          box(m.glow, 0, 7.575, z - 2.25, 4.0, 0.018, 0.03);
        }
      }
    }
    const light = new THREE.RectAreaLight(room === 1 ? 0xdce5e7 : 0xffedd6, room === 1 ? 3.1 : 4.4, 11, 13);
    light.position.set(0, 7.35, middle);
    light.lookAt(0, 0, middle);
    root.add(light);
  }

  // True shallow barrel arches: the entire 5.5 m × 5.7 m route stays clear.
  const wallArch = new THREE.Shape();
  wallArch.moveTo(-8, 0);
  wallArch.lineTo(-2.75, 0);
  wallArch.lineTo(-2.75, 5.7);
  wallArch.quadraticCurveTo(0, 7.1, 2.75, 5.7);
  wallArch.lineTo(2.75, 0);
  wallArch.lineTo(8, 0);
  wallArch.lineTo(8, 7.8);
  wallArch.lineTo(-8, 7.8);
  wallArch.closePath();
  const archGeometry = new THREE.ExtrudeGeometry(wallArch, { depth: 0.65, bevelEnabled: false, curveSegments: 24 });
  const archBand = (inner: number, outer: number, height: number, rise: number, depth: number) => {
    const shape = new THREE.Shape();
    shape.moveTo(-outer, 0);
    shape.lineTo(-inner, 0);
    shape.lineTo(-inner, height);
    shape.quadraticCurveTo(0, height + rise, inner, height);
    shape.lineTo(inner, 0);
    shape.lineTo(outer, 0);
    shape.lineTo(outer, height + 0.12);
    shape.quadraticCurveTo(0, height + rise + (outer - inner) * 2, -outer, height + 0.12);
    shape.closePath();
    return new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 1, curveSegments: 28 });
  };
  const innerArch = archBand(2.75, 3.00, 5.7, 1.4, 0.81);
  const outerArch = archBand(3.0, 3.30, 5.82, 1.90, 0.73);
  const rooms = ['II  ·  LIGHT & SHADOW', 'III  ·  THE ART OF LOOKING', 'IV  ·  INNER WORLDS', 'THE ROTUNDA'];
  for (let i = 0; i < 4; i++) {
    const z = [-19, -38, -57, -77][i];
    mesh(archGeometry, i === 2 ? m.sage : m.plaster, root, 0, 0, z - 0.325);
    mesh(outerArch, i === 2 ? m.walnut : m.limestone, root, 0, 0, z - 0.365);
    mesh(innerArch, m.travertine, root, 0, 0, z - 0.405);
    for (const side of [-1, 1]) {
      box(m.limestone, side * 3.05, 0.14, z, 0.78, 0.28, 1.02);
      box(m.brass, side * 2.78, 3.10, z + 0.43, 0.014, 4.8, 0.009);
    }
    const label = inscription(rooms[i], 4.8, 0.29, '#8b734f', 83, 5);
    label.position.set(0, 7.29, z + 0.345);
  }

  // A quiet domed rotunda closes the long procession.
  const drumGeometry = new THREE.CylinderGeometry(9.4, 9.4, 8.1, 80, 1, true, 0.34, Math.PI * 2 - 0.68);
  const drumMaterial = m.plaster.clone();
  drumMaterial.side = THREE.DoubleSide;
  ownMaterials.add(drumMaterial);
  mesh(drumGeometry, drumMaterial, root, 0, 4.05, -87);
  const domeMaterial = m.ceiling.clone();
  domeMaterial.side = THREE.BackSide;
  ownMaterials.add(domeMaterial);
  const dome = mesh(new THREE.SphereGeometry(9.4, 64, 24, 0, Math.PI * 2, 0, Math.PI / 2), domeMaterial, root, 0, 8.05, -87);
  dome.scale.y = 0.32;
  const domeRing = mesh(new THREE.TorusGeometry(9.28, 0.15, 8, 80), m.travertine, root, 0, 7.91, -87);
  domeRing.rotation.x = Math.PI / 2;
  const oculus = mesh(new THREE.CircleGeometry(2.1, 64), m.skylight, root, 0, 10.89, -87);
  oculus.rotation.x = Math.PI / 2;
  const oculusRim = mesh(new THREE.TorusGeometry(2.12, 0.09, 10, 64), m.brass, root, 0, 10.86, -87);
  oculusRim.rotation.x = Math.PI / 2;
  const rotundaFloor = mesh(new THREE.CircleGeometry(9.4, 80), m.limestone, root, 0, 0.003, -87);
  rotundaFloor.rotation.x = -Math.PI / 2;
  rotundaFloor.castShadow = false;
  for (const radius of [5.2, 5.27, 8.8]) {
    const inlay = mesh(new THREE.RingGeometry(radius, radius + 0.016, 96), m.brass, root, 0, 0.006, -87);
    inlay.rotation.x = -Math.PI / 2;
    inlay.castShadow = false;
  }
  for (let i = 1; i <= 7; i++) {
    const angle = i * Math.PI / 4;
    const x = Math.sin(angle) * 9.04;
    const z = -87 + Math.cos(angle) * 9.04;
    cylinder(m.travertine, x, 3.9, z, 0.245, 7.55);
    cylinder(m.limestone, x, 0.18, z, 0.36, 0.36);
    cylinder(m.limestone, x, 7.64, z, 0.38, 0.24);
    cylinder(m.brass, x, 7.41, z, 0.27, 0.036);
    contact(x, z, 1.10, 1.10);
  }
  box(m.travertine, 0, 0.48, -91, 1.70, 0.96, 1.70);
  box(m.limestone, 0, 0.98, -91, 1.78, 0.06, 1.78);
  box(m.bronze, 0, 0.055, -91, 1.79, 0.11, 1.79);
  contact(0, -91, 2.75, 2.75);
  const sculpture = mesh(new THREE.TorusKnotGeometry(0.91, 0.115, 180, 18, 2, 3), m.brass, root, 0, 2.43, -91);
  sculpture.scale.set(0.86, 1.16, 0.86);
  sculpture.rotation.set(0.1, 0.4, -0.16);
  const endTitle = inscription('Art outlives its moment.', 6.7, 0.68, '#8c795b', 140, 0, true);
  endTitle.position.set(0, 4.9, -95.81);
  const endSubtitle = inscription('Thank you for exploring The Living Gallery.', 6.7, 0.3, '#938671', 66, 1.0);
  endSubtitle.position.set(0, 4.30, -95.79);
  const rotundaLight = new THREE.RectAreaLight(0xffefd8, 5, 7, 7);
  rotundaLight.position.set(0, 8, -87);
  rotundaLight.lookAt(0, 0, -89);
  root.add(rotundaLight);

  // Restrained actual lighting. Only the entrance key casts a dynamic shadow.
  root.add(new THREE.HemisphereLight(0xe6eced, 0x5c4933, 1.05));
  const key = new THREE.DirectionalLight(0xffebd2, 2.1);
  key.position.set(-3, 10, 10);
  root.add(key);
  const entranceLight = new THREE.SpotLight(0xffe9c9, 210, 28, 0.76, 0.68, 1.3);
  entranceLight.position.set(0, 8.6, 7.0);
  entranceLight.target.position.set(0, 2.8, 0);
  entranceLight.castShadow = true;
  entranceLight.shadow.mapSize.set(1024, 1024);
  entranceLight.shadow.bias = -0.00012;
  entranceLight.shadow.normalBias = 0.025;
  entranceLight.shadow.radius = 3;
  entranceLight.shadow.camera.near = 0.5;
  entranceLight.shadow.camera.far = 28;
  root.add(entranceLight, entranceLight.target);
  const doorLight = new THREE.SpotLight(0xffd9a2, 0, 18, 0.70, 0.8, 1.4);
  doorLight.position.set(0, 6.5, -3.5);
  doorLight.target.position.set(0, 0, 5.5);
  root.add(doorLight, doorLight.target);

  for (const batch of batches.values()) {
    const objects = new THREE.InstancedMesh(batch.geometry, batch.material, batch.matrices.length);
    batch.matrices.forEach((matrix, i) => objects.setMatrixAt(i, matrix));
    objects.instanceMatrix.needsUpdate = true;
    objects.castShadow = true;
    objects.receiveShadow = true;
    objects.computeBoundingSphere();
    root.add(objects);
  }
  for (const [parent, parentBatches] of localBatches) {
    for (const [material, matrices] of parentBatches) {
      const objects = new THREE.InstancedMesh(cube, material, matrices.length);
      matrices.forEach((matrix, i) => objects.setMatrixAt(i, matrix));
      objects.instanceMatrix.needsUpdate = true;
      objects.castShadow = true;
      objects.receiveShadow = true;
      objects.computeBoundingSphere();
      parent.add(objects);
    }
  }

  return {
    leftDoor,
    rightDoor,
    doorLight,
    dispose: () => {
      scene.remove(root);
      entranceLight.shadow.dispose();
      geometries.forEach((geometry) => geometry.dispose());
      ownMaterials.forEach((material) => material.dispose());
      ownTextures.forEach((texture) => texture.dispose());
      m.dispose();
    },
  };
}
