import * as THREE from 'three';
import {
  fieldVertexShader,
  fieldFragmentShader,
  textVertexShader,
  textFragmentShader,
} from './shaders.js';

const POINTER_HOME = new THREE.Vector3(999, 999, 0);

/**
 * The ambient fluid field. Each particle is a small quad stretched along its
 * local flow direction, so the cloud reads as liquid streaks rather than
 * round stars. Chaos and a two-armed spiral are mixed by uOrder.
 */
export function createField({ count = 42000 } = {}) {
  const bases = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const rands = new Float32Array(count * 3);
  const scales = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const r = 2.1 + Math.pow(Math.random(), 0.55) * 4.7;
    const theta = Math.random() * Math.PI * 2;
    const cosPhi = Math.random() * 2 - 1;
    const sinPhi = Math.sqrt(1 - cosPhi * cosPhi);

    bases[i * 3] = r * sinPhi * Math.cos(theta);
    bases[i * 3 + 1] = r * cosPhi * 0.62;
    bases[i * 3 + 2] = r * sinPhi * Math.sin(theta);

    seeds[i] = Math.random();
    rands[i * 3] = Math.random();
    rands[i * 3 + 1] = Math.random();
    rands[i * 3 + 2] = Math.random();
    scales[i] = 0.35 + Math.pow(Math.random(), 1.8) * 1.75;
  }

  // One quad, instanced once per particle.
  const geometry = new THREE.InstancedBufferGeometry();
  geometry.setAttribute(
    'position',
    new THREE.BufferAttribute(
      new Float32Array([-1, -1, 0, 1, -1, 0, -1, 1, 0, 1, 1, 0]),
      3,
    ),
  );
  geometry.setIndex([0, 1, 2, 2, 1, 3]);
  geometry.setAttribute('iBase', new THREE.InstancedBufferAttribute(bases, 3));
  geometry.setAttribute('iSeed', new THREE.InstancedBufferAttribute(seeds, 1));
  geometry.setAttribute('iRand', new THREE.InstancedBufferAttribute(rands, 3));
  geometry.setAttribute('iScale', new THREE.InstancedBufferAttribute(scales, 1));
  geometry.instanceCount = count;

  const uniforms = {
    uTime: { value: 0 },
    uOrder: { value: 0 },
    uPointer: { value: POINTER_HOME.clone() },
    uPointerStrength: { value: 0.35 },
    uViewport: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
    uSize: { value: 1.0 },
    uDim: { value: 1.0 },
    uTitle: { value: 0 },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: fieldVertexShader,
    fragmentShader: fieldFragmentShader,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.frustumCulled = false;
  mesh.renderOrder = 1;

  return {
    points: mesh,
    uniforms,
    setViewport(width, height) {
      uniforms.uViewport.value.set(width, height);
    },
    setCount(next) {
      geometry.instanceCount = Math.min(count, Math.max(0, next));
    },
  };
}

/**
 * A one-off point cloud that can condense into a glyph. `targets` is a flat
 * xyz array produced by textSampler.js.
 */
export function createTextCloud(targets, { size = 1.15 } = {}) {
  const count = targets.length / 3;
  const starts = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const scales = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const r = 3.6 + Math.random() * 3.4;
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);

    starts[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    starts[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta) * 0.7;
    starts[i * 3 + 2] = r * Math.cos(phi) * 0.5;

    seeds[i] = Math.random();
    scales[i] = 0.5 + Math.random() * 0.9;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(starts, 3));
  geometry.setAttribute('aTarget', new THREE.BufferAttribute(targets, 3));
  geometry.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute('aScale', new THREE.BufferAttribute(scales, 1));

  const uniforms = {
    uTime: { value: 0 },
    uMorph: { value: 0 },
    uPointer: { value: POINTER_HOME.clone() },
    uPointerStrength: { value: 0.35 },
    uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
    uSize: { value: size },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: textVertexShader,
    fragmentShader: textFragmentShader,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = 3;

  return {
    points,
    uniforms,
    setPixelRatio(ratio) {
      uniforms.uPixelRatio.value = ratio;
    },
  };
}
