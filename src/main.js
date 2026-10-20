import '@fontsource/noto-serif-sc/400.css';
import '@fontsource/noto-serif-sc/600.css';
import './styles.css';

import * as THREE from 'three';
import { createScene } from './scene.js';
import { createField, createTextCloud } from './field.js';
import { sampleTextPoints } from './textSampler.js';
import { initTypography } from './typography.js';

const canvas = document.querySelector('#gl');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const smoothstep = (edge0, edge1, x) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

const smootherstep = (x) => x * x * x * (x * (x * 6 - 15) + 10);

const damp = (current, target, lambda, dt) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));

async function boot() {
  const typography = initTypography();
  typography.update(0);

  let app = null;

  try {
    await Promise.race([
      document.fonts?.ready ?? Promise.resolve(),
      new Promise((resolve) => setTimeout(resolve, 2200)),
    ]);
    app = buildWorld(typography);
  } catch (error) {
    console.error('[flux] WebGL setup failed', error);
    document.body.classList.add('no-webgl');
  }

  // Without a canvas there is no render loop, so drive the poem from scroll
  // directly. The CSS poster and the DOM title carry the finale.
  if (!app) {
    const sync = () => {
      const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = Math.min(1, Math.max(0, window.scrollY / max));
      typography.update(progress);
    };
    window.addEventListener('scroll', sync, { passive: true });
    window.addEventListener('resize', sync);
    sync();
  }

  typography.ready();
  app?.start();
}

function buildWorld(typography) {
  const context = createScene(canvas);
  const { scene, camera, grade } = context;

  const isMobile = window.innerWidth < 760;
  const particleCount = isMobile ? 12000 : 21000;

  if (isMobile) {
    context.bloom.strength = 0.46;
    context.bloom.threshold = 0.34;
  }

  const field = createField({ count: particleCount });
  if (isMobile) field.uniforms.uSize.value = 1.25;
  scene.add(field.points);

  // --- glyph clouds ------------------------------------------------------
  const guangTargets = sampleTextPoints('光', {
    width: 768,
    height: 768,
    fontSize: 520,
    count: isMobile ? 5800 : 14000,
    worldWidth: isMobile ? 2.7 : 5.4,
    offsetX: isMobile ? 0 : 1.9,
    offsetY: isMobile ? -1.5 : 0.2,
  });

  const titleTargets = sampleTextPoints('流形', {
    width: 1024,
    height: 512,
    fontSize: 400,
    count: isMobile ? 11000 : 30000,
    worldWidth: isMobile ? 2.8 : 9.2,
    offsetY: isMobile ? 0 : 0.25,
    letterSpacing: 6,
  });

  const guang = guangTargets ? createTextCloud(guangTargets, { size: isMobile ? 0.86 : 1.05 }) : null;
  const title = titleTargets ? createTextCloud(titleTargets, { size: isMobile ? 0.66 : 0.72 }) : null;

  if (guang) scene.add(guang.points);
  if (title) scene.add(title.points);

  const textLayers = [guang, title].filter(Boolean);

  // --- pointer -----------------------------------------------------------
  const ndc = new THREE.Vector2(0, 0);
  const pointerWorld = new THREE.Vector3(999, 999, 0);
  const raycaster = new THREE.Raycaster();
  const pointerPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);

  let pointerEnergy = 0;
  let px = 0;
  let py = 0;

  const onPointerMove = (event) => {
    ndc.x = (event.clientX / window.innerWidth) * 2 - 1;
    ndc.y = -(event.clientY / window.innerHeight) * 2 + 1;
    pointerEnergy = 1;

    if (reduceMotion) return;
    raycaster.setFromCamera(ndc, camera);
    raycaster.ray.intersectPlane(pointerPlane, pointerWorld);
  };

  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener(
    'pointerleave',
    () => {
      pointerEnergy = 0;
    },
    { passive: true },
  );

  // --- scroll ------------------------------------------------------------
  let targetProgress = 0;
  let smoothedProgress = 0;

  const readScroll = () => {
    const max = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    targetProgress = Math.min(1, Math.max(0, window.scrollY / max));
  };

  window.addEventListener('scroll', readScroll, { passive: true });
  window.addEventListener('resize', readScroll);
  readScroll();

  // --- resize -> shader uniforms ----------------------------------------
  window.addEventListener('resize', () => {
    const ratio = context.dpr();
    field.setViewport(window.innerWidth, window.innerHeight);
    for (const layer of textLayers) layer.setPixelRatio(ratio);
  });

  // --- loop --------------------------------------------------------------
  const baseCameraZ = 10.4;
  let time = 0;
  let last = performance.now();
  let running = true;
  let frameHandle = 0;

  // If the machine cannot hold a smooth frame, thin the field out once.
  const automated = navigator.webdriver === true;
  let perfStart = 0;
  let perfFrames = 0;
  let adapted = false;

  document.addEventListener('visibilitychange', () => {
    running = !document.hidden;
    if (running) last = performance.now();
  });

  function frame(now) {
    frameHandle = requestAnimationFrame(frame);
    if (!running) return;

    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!reduceMotion) time += dt;

    if (!automated && !adapted) {
      if (!perfStart) perfStart = now;
      perfFrames += 1;
      if (now - perfStart > 3000) {
        const fps = perfFrames / ((now - perfStart) / 1000);
        if (fps < 48) {
          field.setCount(Math.floor(particleCount * 0.55));
          context.bloom.strength *= 0.82;
        }
        adapted = true;
      }
    }

    smoothedProgress = damp(smoothedProgress, targetProgress, 4.2, dt);
    typography.update(smoothedProgress);

    const progress = smoothedProgress;
    const order = reduceMotion
      ? 0.55
      : smootherstep(Math.min(1, Math.max(0, (progress - 0.02) / 0.93)));

    field.uniforms.uOrder.value = order;
    field.uniforms.uTime.value = time;

    pointerEnergy = Math.max(0, pointerEnergy - dt * 0.6);
    px = damp(px, ndc.x, 2.2, dt);
    py = damp(py, ndc.y, 2.2, dt);

    const pointerStrength = reduceMotion ? 0 : 0.32 + pointerEnergy * 0.68;
    field.uniforms.uPointer.value.copy(pointerWorld);
    field.uniforms.uPointerStrength.value = pointerStrength;

    // 「光」 condenses while chapter 03 is on screen
    const morphGuang = reduceMotion
      ? 0
      : smoothstep(0.425, 0.49, progress) * (1 - smoothstep(0.565, 0.625, progress));

    // 「流形」 forms as the poem closes
    const morphTitle = reduceMotion ? 0 : smoothstep(0.895, 0.975, progress);

    for (const layer of textLayers) {
      layer.uniforms.uTime.value = time;
      layer.uniforms.uPointer.value.copy(pointerWorld);
      layer.uniforms.uPointerStrength.value = pointerStrength;
    }
    if (guang) guang.uniforms.uMorph.value = morphGuang;
    if (title) title.uniforms.uMorph.value = morphTitle;

    // Give the glyphs room to read while the field keeps its halo around them.
    field.uniforms.uDim.value = Math.max(0.35, 1 - morphGuang * 0.42 - morphTitle * 0.18);
    field.uniforms.uTitle.value = morphTitle;

    const cameraZ = baseCameraZ - order * (isMobile ? 0.9 : 1.6);
    camera.position.x = damp(camera.position.x, px * 0.5, 1.7, dt);
    camera.position.y = damp(camera.position.y, py * 0.32, 1.7, dt);
    camera.position.z = damp(camera.position.z, cameraZ, 1.4, dt);
    camera.lookAt(0, 0, 0);

    field.points.rotation.y = progress * 0.35;

    grade.uniforms.uTime.value = time;
    grade.uniforms.uProgress.value = progress;

    context.render();
  }

  // --- start -------------------------------------------------------------
  const ratio = context.dpr();
  field.setViewport(window.innerWidth, window.innerHeight);
  for (const layer of textLayers) layer.setPixelRatio(ratio);

  return {
    start() {
      last = performance.now();
      cancelAnimationFrame(frameHandle);
      frameHandle = requestAnimationFrame(frame);
    },
  };
}

boot();
