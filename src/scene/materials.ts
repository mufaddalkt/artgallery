import * as THREE from 'three';

export interface MuseumMaterials {
  limestone: THREE.MeshStandardMaterial;
  travertine: THREE.MeshStandardMaterial;
  floor: THREE.MeshStandardMaterial;
  plaster: THREE.MeshStandardMaterial;
  midnight: THREE.MeshStandardMaterial;
  sage: THREE.MeshStandardMaterial;
  ceiling: THREE.MeshStandardMaterial;
  walnut: THREE.MeshStandardMaterial;
  bronze: THREE.MeshStandardMaterial;
  bronzePanel: THREE.MeshStandardMaterial;
  brass: THREE.MeshStandardMaterial;
  leather: THREE.MeshStandardMaterial;
  dark: THREE.MeshStandardMaterial;
  glow: THREE.MeshStandardMaterial;
  skylight: THREE.MeshStandardMaterial;
  dispose: () => void;
}

/** Small deterministic, original surface maps. No fetched material assets. */
export function createMuseumMaterials(): MuseumMaterials {
  const textures: THREE.CanvasTexture[] = [];
  const materials: THREE.Material[] = [];
  let seed = 27491;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };
  const surface = (kind: 'stone' | 'floor' | 'wood' | 'metal') => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const pixels = ctx.createImageData(512, 512);
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const i = (y * 512 + x) * 4;
        const grain = random() - 0.5;
        let value = 235;
        if (kind === 'wood') {
          const wave = Math.sin(x * 0.14 + Math.sin(y * 0.016) * 0.7 + Math.sin(x * 0.028) * 2.2);
          value = 170 + wave * 20 + grain * 17 + Math.sin(x * 1.25) * 5;
        } else if (kind === 'metal') {
          value = 220 + Math.sin(y * 2.6) * 2.2 + grain * 9;
        } else {
          const wave = Math.sin(y * 0.079 + Math.sin(x * 0.014) * 2.9);
          const cloud = Math.sin(x * 0.012 + y * 0.009) * Math.sin(y * 0.023) * 5;
          value = 237 + cloud + wave * 2.8 + grain * 8;
          if (random() > 0.994) value -= 18 + random() * 22;
          if (kind === 'floor') {
            value += 5;
            if (x < 1 || y < 1) value = 201;
          }
        }
        pixels.data[i] = value;
        pixels.data[i + 1] = value - (kind === 'wood' ? 7 : 1);
        pixels.data[i + 2] = value - (kind === 'wood' ? 13 : 3);
        pixels.data[i + 3] = 255;
      }
    }
    ctx.putImageData(pixels, 0, 0);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.anisotropy = 4;
    textures.push(map);
    return map;
  };
  const stoneMap = surface('stone');
  const floorMap = surface('floor');
  floorMap.repeat.set(8, 56);
  const woodMap = surface('wood');
  const metalMap = surface('metal');
  const standard = (params: THREE.MeshStandardMaterialParameters) => {
    const mat = new THREE.MeshStandardMaterial(params);
    materials.push(mat);
    return mat;
  };
  return {
    limestone: standard({ color: '#dad0bd', map: stoneMap, bumpMap: stoneMap, bumpScale: 0.016, roughness: 0.72 }),
    travertine: standard({ color: '#c6b59a', map: stoneMap, bumpMap: stoneMap, bumpScale: 0.022, roughness: 0.67 }),
    floor: standard({ color: '#d4c8b4', map: floorMap, bumpMap: floorMap, bumpScale: 0.007, roughness: 0.36, metalness: 0.09 }),
    plaster: standard({ color: '#e5ddca', roughness: 0.92, bumpMap: stoneMap, bumpScale: 0.006 }),
    midnight: standard({ color: '#24343a', roughness: 0.89, bumpMap: stoneMap, bumpScale: 0.006 }),
    sage: standard({ color: '#667066', roughness: 0.9, bumpMap: stoneMap, bumpScale: 0.006 }),
    ceiling: standard({ color: '#d5cebc', roughness: 0.9 }),
    walnut: standard({ color: '#493126', map: woodMap, bumpMap: woodMap, bumpScale: 0.013, roughness: 0.49 }),
    bronze: standard({ color: '#5c4934', map: metalMap, bumpMap: metalMap, bumpScale: 0.006, metalness: 0.84, roughness: 0.39 }),
    bronzePanel: standard({ color: '#322d24', map: metalMap, bumpMap: metalMap, bumpScale: 0.006, metalness: 0.68, roughness: 0.46 }),
    brass: standard({ color: '#baa06c', metalness: 0.83, roughness: 0.29 }),
    leather: standard({ color: '#3f2424', roughness: 0.71, bumpMap: stoneMap, bumpScale: 0.008 }),
    dark: standard({ color: '#151b1c', roughness: 0.66, metalness: 0.22 }),
    glow: standard({ color: '#fff2d4', emissive: '#ffdcaa', emissiveIntensity: 2.2, roughness: 0.8 }),
    skylight: standard({ color: '#e5ebe4', emissive: '#dce6df', emissiveIntensity: 0.65, roughness: 0.83 }),
    dispose: () => {
      materials.forEach((material) => material.dispose());
      textures.forEach((texture) => texture.dispose());
    },
  };
}
