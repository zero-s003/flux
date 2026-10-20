// GLSL shared by the particle field, the text clouds and the grade pass.

const SIMPLEX_NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);

  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);

  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;

  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));

  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;

  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);

  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);

  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);

  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));

  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);

  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;

  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

export const fieldVertexShader = /* glsl */ `
uniform float uTime;
uniform float uOrder;
uniform vec3 uPointer;
uniform float uPointerStrength;
uniform vec2 uViewport;
uniform float uSize;
uniform float uDim;
uniform float uTitle;

attribute vec3 iBase;
attribute float iSeed;
attribute vec3 iRand;
attribute float iScale;

varying vec3 vColor;
varying float vAlpha;
varying vec2 vCorner;

${SIMPLEX_NOISE}

void main() {
  float t = uTime;
  vec3 base = iBase;

  // --- chaotic state: curl-ish noise drift ------------------------------
  vec3 q = base * 0.26;
  float n1 = snoise(q + vec3(t * 0.085, 0.0, 0.0));
  float n2 = snoise(q + vec3(0.0, t * 0.068, 3.7));
  float n3 = snoise(q + vec3(5.2, 0.0, t * 0.078));
  vec3 flow = vec3(n1, n2, n3);
  float amp = 1.2 + iScale * 1.3;

  vec3 chaosPos = base + flow * amp;
  float rot = t * 0.028 + iSeed * 0.4;
  float c = cos(rot);
  float s = sin(rot);
  chaosPos.xz = mat2(c, -s, s, c) * chaosPos.xz;
  chaosPos.y += sin(t * 0.45 + iSeed * 12.0) * 0.09;

  // --- ordered state: two armed, elliptical spiral -----------------------
  float armPick = fract(iRand.z * 7.31);
  float radius;
  float angle;

  if (armPick < 0.74) {
    // two open, logarithmic spiral arms
    float arm = iRand.z < 0.5 ? 0.0 : 3.14159265;
    radius = mix(2.9, 6.4, pow(iRand.x, 0.72));
    angle = arm + log(radius / 2.9) * 3.0 + (iSeed - 0.5) * 0.52;
  } else if (armPick < 0.86) {
    // a couple of faint elliptical orbits
    float ring = floor(iRand.x * 2.0);
    radius = 4.1 + ring * 1.3 + (iSeed - 0.5) * 0.1;
    angle = iSeed * 6.2831853;
  } else {
    // soft diffuse halo
    radius = mix(3.0, 6.4, pow(iRand.x, 0.62));
    angle = iSeed * 6.2831853 + radius * 0.35;
  }

  angle += t * 0.05;

  float thickness = (iRand.y - 0.5) * mix(0.12, 0.42, fract(iRand.y * 3.7)) * (1.2 - radius * 0.06);
  float flatX = cos(angle) * radius;
  float flatY = sin(angle) * radius * 0.62;
  float tilt = 0.4;
  float ct = cos(tilt);
  float st = sin(tilt);
  vec3 orderPos = vec3(flatX, flatY * ct - thickness * st, flatY * st + thickness * ct);
  orderPos.y += sin(t * 0.7 + iSeed * 6.2831) * 0.03;

  vec3 pos = mix(chaosPos, orderPos, uOrder);

  // --- pointer gravity well ---------------------------------------------
  vec3 toP = uPointer - pos;
  float d = length(toP.xy);
  float influence = smoothstep(3.8, 0.0, d) * uPointerStrength;
  vec3 dir = normalize(vec3(toP.xy, 0.0) + vec3(0.0001));
  vec3 tangent = vec3(-dir.y, dir.x, 0.0);
  pos += (dir * 0.42 + tangent * 0.95) * influence * (0.35 + iScale * 0.9);
  pos.z += sin(d * 3.0 - t * 1.4) * influence * 0.32;

  // --- flow direction, used to stretch the sprite ------------------------
  vec3 swirl = vec3(-base.z, 0.0, base.x);
  vec3 chaosDir = normalize(swirl * 0.55 + flow * 1.1 + vec3(0.0, 0.15, 0.0) + vec3(0.0001));
  vec3 orderDir = normalize(vec3(
    -sin(angle) * radius,
    cos(angle) * radius * 0.62 * ct,
    cos(angle) * radius * 0.62 * st
  ) + vec3(0.0001));
  vec3 flowDir = normalize(mix(chaosDir, orderDir, uOrder) + vec3(0.0001));

  vec3 pdir = vec3(-(pos.y - uPointer.y), pos.x - uPointer.x, 0.0);
  flowDir = normalize(flowDir + pdir * influence * 0.8 + vec3(0.0001));

  // --- project and stretch in screen space -------------------------------
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  vec4 clip = projectionMatrix * mv;

  vec4 mvB = modelViewMatrix * vec4(pos + flowDir * 0.4, 1.0);
  vec4 clipB = projectionMatrix * mvB;

  vec2 ndcA = clip.xy / max(clip.w, 0.0001);
  vec2 ndcB = clipB.xy / max(clipB.w, 0.0001);
  vec2 dirScreen = ndcB - ndcA;
  float dirLen = length(dirScreen);
  dirScreen = dirLen > 0.00001 ? dirScreen / dirLen : vec2(1.0, 0.0);
  vec2 perp = vec2(-dirScreen.y, dirScreen.x);

  float depth = max(0.2, -mv.z);
  float sizeScale = mix(1.6, 1.0, uOrder);
  float halfW = clamp(iScale * uSize * sizeScale * (18.0 / depth), 0.35, 12.0);
  float halfL = halfW * mix(2.4, 1.1, uOrder);
  vec2 offset = (dirScreen * (position.x * halfL) + perp * (position.y * halfW))
              * 2.0 / uViewport;

  gl_Position = clip;
  gl_Position.xy += offset * clip.w;
  vCorner = position.xy;

  // --- colour: cyan core, violet rim, drifting colour currents ----------
  float hue = snoise(vec3(base.xy * 0.11, t * 0.045));
  vec3 cyan = vec3(0.176, 0.886, 1.0);
  vec3 violet = vec3(0.56, 0.32, 1.0);
  float mixv = clamp(radius / 6.4 + iRand.z * 0.3 - 0.12 + hue * 0.42, 0.0, 1.0);
  vec3 col = mix(cyan, violet, mixv);
  col = mix(col, vec3(0.3, 0.55, 1.0), smoothstep(0.55, 0.95, iRand.z) * 0.22);

  // slow brightness currents make the cloud read as liquid
  float wave = 0.5 + 0.5 * snoise(vec3(base.xz * 0.16, t * 0.06 + 4.0));

  // large-scale voids: the cloud should breathe, not paper the screen
  float mask = smoothstep(0.25, 0.75, 0.5 + 0.5 * snoise(vec3(base.xz * 0.085, t * 0.035 + 9.0)));
  float maskFactor = mix(0.08, 1.2, mask);

  // clear a soft elliptical window around the final particle title
  vec2 ndcPos = clip.xy / max(clip.w, 0.0001);
  float clear = smoothstep(0.92, 1.28, length(vec2(ndcPos.x / 0.8, ndcPos.y / 0.5)));

  // chaos is written with fewer, more varied strokes — order brings everyone back
  float chaosKeep = smoothstep(0.12, 0.62, fract(iRand.y * 13.73));
  float depthFade = mix(0.42, 1.0, smoothstep(14.0, 7.0, depth));

  vColor = col;
  vAlpha = (0.13 + iRand.y * 0.4) * (0.58 + 0.55 * wave);
  vAlpha *= mix(0.18 + 0.82 * chaosKeep, 1.0, uOrder);
  vAlpha *= mix(maskFactor, 0.9 + 0.2 * mask, uOrder);
  vAlpha *= mix(0.64, 1.0, uOrder);
  vAlpha *= mix(1.0, mix(0.22, 1.0, clear), uTitle);
  vAlpha *= mix(1.0, 0.6, smoothstep(0.8, 2.2, iScale));
  vAlpha *= depthFade;
  vAlpha *= uDim;
}
`;

export const fieldFragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;
varying vec2 vCorner;

void main() {
  float ax = abs(vCorner.x);
  float ay = abs(vCorner.y);
  // soft, rounded ends — a motion-blurred wisp rather than a fish
  float a = pow(max(0.0, 1.0 - ay * ay), 2.4)
          * pow(max(0.0, 1.0 - ax * ax), 1.35);
  if (a < 0.002) discard;
  gl_FragColor = vec4(vColor, a * vAlpha);
}
`;

export const textVertexShader = /* glsl */ `
uniform float uTime;
uniform float uMorph;
uniform vec3 uPointer;
uniform float uPointerStrength;
uniform float uPixelRatio;
uniform float uSize;

attribute vec3 aTarget;
attribute float aSeed;
attribute float aScale;

varying vec3 vColor;
varying float vAlpha;

void main() {
  float morph = uMorph;
  vec3 p = mix(position, aTarget, morph);

  // loose particles while still unformed
  p += vec3(
    sin(uTime * 0.7 + aSeed * 40.0),
    cos(uTime * 0.5 + aSeed * 33.0),
    sin(uTime * 0.4 + aSeed * 21.0)
  ) * (0.22 * (1.0 - morph));

  // a faint breathing shimmer once the glyph is formed
  float formed = smoothstep(0.6, 1.0, morph);
  p += vec3(
    sin(uTime * 1.2 + aSeed * 90.0),
    cos(uTime * 1.05 + aSeed * 70.0),
    0.0
  ) * 0.016 * formed;

  // the pointer can disturb a formed glyph, but only as a ripple
  vec3 toP = p - uPointer;
  float d = length(toP.xy);
  float inf = smoothstep(1.35, 0.0, d) * uPointerStrength * formed;
  p.xy += normalize(toP.xy + vec2(0.0001)) * inf * 0.22;

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(aScale * uSize * uPixelRatio * (30.0 / -mv.z), 1.0, 26.0);

  vec3 edge = vec3(0.5, 0.8, 0.88);
  vec3 core = vec3(0.9, 0.98, 1.0);
  vColor = mix(edge, core, 0.35 + aSeed * 0.55);
  vAlpha = smoothstep(0.02, 0.55, morph) * (0.38 + aSeed * 0.42)
         * (0.92 + 0.08 * sin(uTime * 2.0 + aSeed * 30.0));
}
`;

export const textFragmentShader = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 uv = gl_PointCoord - 0.5;
  float d = length(uv);
  float a = smoothstep(0.5, 0.05, d);
  a *= a;
  gl_FragColor = vec4(vColor, a * vAlpha);
}
`;

export const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uProgress: { value: 0 },
    uResolution: { value: null },
  },
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: /* glsl */ `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uProgress;
    uniform vec2 uResolution;
    varying vec2 vUv;

    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
    }

    void main() {
      vec2 uv = vUv;
      vec2 centered = uv - 0.5;
      float d = length(centered);

      // barely-there colour split; loud fringing reads as video noise
      float ca = 0.0006 + 0.0014 * uProgress;
      vec2 off = centered * d * ca;
      float r = texture2D(tDiffuse, uv + off).r;
      float g = texture2D(tDiffuse, uv).g;
      float b = texture2D(tDiffuse, uv - off).b;
      vec3 col = vec3(r, g, b);

      // push the palette away from the grey the bloom leaves behind
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, 1.22);

      // vignette
      float vig = smoothstep(1.04, 0.2, d);
      col *= mix(0.32, 1.0, vig);

      // film grain
      float n = hash(uv * uResolution + fract(uTime * 0.37) * 91.0);
      col += (n - 0.5) * 0.026;

      gl_FragColor = vec4(col, 1.0);
    }
  `,
};
