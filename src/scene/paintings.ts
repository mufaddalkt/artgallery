import * as THREE from 'three';
import { artworks } from '../data/artworks';
import { ART_HEIGHTS, ART_Z } from './timeline';

export function createPaintings(scene: THREE.Scene, renderer: THREE.WebGLRenderer, onLoad: (count: number) => void) {
  const loader = new THREE.TextureLoader();
  const textures = new Set<THREE.Texture>();
  const materials: THREE.Material[] = [];
  const geometries: THREE.BufferGeometry[] = [];
  const groups: THREE.Group[] = [];
  const imageMaterials: THREE.MeshBasicMaterial[] = [];
  const requested = new Set<number>();
  let disposed = false;
  let loaded = 0;
  const brass = new THREE.MeshStandardMaterial({ color: '#9a7b48', metalness: .82, roughness: .31 });
  const antique = new THREE.MeshStandardMaterial({ color: '#654b2d', metalness: .7, roughness: .39 });
  const dark = new THREE.MeshStandardMaterial({ color: '#22231f', metalness: .42, roughness: .4 });
  const liner = new THREE.MeshStandardMaterial({ color: '#d7c9ac', roughness: .84 });
  materials.push(brass, antique, dark, liner);
  function box(parent: THREE.Group, size: [number, number, number], pos: [number, number, number], mat: THREE.Material) {
    const geo = new THREE.BoxGeometry(...size); geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...pos); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
  }
  const dimensions = artworks.map((art, i) => ({ width: ART_HEIGHTS[i] * art.width / art.height, height: ART_HEIGHTS[i] }));
  artworks.forEach((art, i) => {
    const { width: w, height: h } = dimensions[i];
    const group = new THREE.Group();
    group.position.set(i % 2 === 0 ? -7.72 : 7.72, Math.max(2.3, h / 2 + .55), ART_Z[i]);
    group.rotation.y = i % 2 === 0 ? Math.PI / 2 : -Math.PI / 2;
    scene.add(group); groups.push(group);
    const mat = i === 1 || i === 6 ? dark : antique;
    // Three concentric, physically dimensional frame profiles.
    const borders = [ { t: .115, d: .18, offset: .095, m: mat }, { t: .026, d: .205, offset: .026, m: brass }, { t: .023, d: .17, offset: 0, m: liner } ];
    for (const b of borders) {
      const ow = w + b.offset * 2, oh = h + b.offset * 2;
      box(group, [ow + b.t * 2, b.t, b.d], [0, oh / 2 + b.t / 2, .005], b.m);
      box(group, [ow + b.t * 2, b.t, b.d], [0, -oh / 2 - b.t / 2, .005], b.m);
      box(group, [b.t, oh, b.d], [-ow / 2 - b.t / 2, 0, .005], b.m);
      box(group, [b.t, oh, b.d], [ow / 2 + b.t / 2, 0, .005], b.m);
    }
    box(group, [w + .32, h + .32, .065], [0, 0, -.06], dark);
    const imageMat = new THREE.MeshBasicMaterial({ color: '#a2957e', toneMapped: false });
    materials.push(imageMat); imageMaterials.push(imageMat);
    const imageGeo = new THREE.PlaneGeometry(w, h); geometries.push(imageGeo);
    const painting = new THREE.Mesh(imageGeo, imageMat); painting.position.z = .085; group.add(painting);
    // Wall label is a real physical label in the gallery, separate from accessible HTML text.
    const label = document.createElement('canvas'); label.width = 768; label.height = 256;
    const ctx = label.getContext('2d')!;
    ctx.fillStyle = '#e9e5d9'; ctx.fillRect(0, 0, 768, 256);
    ctx.fillStyle = '#37372e'; ctx.font = '28px Georgia'; ctx.fillText(art.title.length > 48 ? art.title.slice(0, 46) + '…' : art.title, 35, 69);
    ctx.font = '21px Arial'; ctx.fillText(art.artist, 35, 118); ctx.fillText(art.date, 35, 154);
    ctx.fillStyle = '#777465'; ctx.font = '16px Arial'; ctx.fillText(`THE LIVING GALLERY    /    ${String(i + 1).padStart(2, '0')}`, 35, 213);
    const labelTexture = new THREE.CanvasTexture(label); labelTexture.colorSpace = THREE.SRGBColorSpace; textures.add(labelTexture);
    const labelMat = new THREE.MeshBasicMaterial({ map: labelTexture, toneMapped: false }); materials.push(labelMat);
    const labelGeo = new THREE.PlaneGeometry(.72, .24); geometries.push(labelGeo);
    const labelMesh = new THREE.Mesh(labelGeo, labelMat); labelMesh.position.set(w / 2 + .75, -group.position.y + 1.24, -.09); group.add(labelMesh);
    // Aimed, restrained painting light, with a modeled recessed fixture.
    const spot = new THREE.SpotLight('#ffedce', 52, 10, Math.PI / 5, .85, 2);
    const x = i % 2 === 0 ? -4.8 : 4.8;
    spot.position.set(x, 6.4, ART_Z[i]); spot.target.position.copy(group.position); scene.add(spot, spot.target);
    const fixture = new THREE.Group(); fixture.position.copy(spot.position); scene.add(fixture); groups.push(fixture);
    const body = box(fixture, [.3, .13, .45], [0, 0, 0], dark); body.lookAt(group.position);
  });
  function request(index: number) {
    if (index < 0 || index >= artworks.length || requested.has(index)) return;
    requested.add(index);
    const art = artworks[index];
    loader.load(art.image, texture => {
      if (disposed) { texture.dispose(); return; }
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
      textures.add(texture);
      imageMaterials[index].map?.dispose();
      imageMaterials[index].map = texture; imageMaterials[index].color.set('white'); imageMaterials[index].needsUpdate = true;
      loaded++; onLoad(loaded);
    }, undefined, () => { requested.delete(index); });
  }
  // Thumbnails are tiny, so distant walls contain authentic art from the first room reveal.
  artworks.forEach((art, index) => loader.load(art.thumbnail, texture => {
    if (disposed || imageMaterials[index].map) { texture.dispose(); return; }
    texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 2; textures.add(texture);
    imageMaterials[index].map = texture; imageMaterials[index].color.set('white'); imageMaterials[index].needsUpdate = true;
  }));
  request(0); request(1);
  return {
    dimensions,
    preload: (index: number) => { request(index); request(index + 1); request(index + 2); },
    dispose: () => { disposed = true; textures.forEach(t => t.dispose()); materials.forEach(m => m.dispose()); geometries.forEach(g => g.dispose()); groups.forEach(g => scene.remove(g)); },
  };
}
