import * as THREE from "three";

/**
 * The landing-page hero: a dive from orbit to campus, where the city's lights
 * lift off the ground and settle into the wordmark.
 *
 * Everything on screen is real data. The Earth is NASA Blue Marble and Black
 * Marble imagery, the sky is the HYG star catalogue. See public/hero/CREDITS.md.
 */

export interface DescentOptions {
  canvas: HTMLCanvasElement;
  /** The real heading. Its glyphs are sampled so the lights land exactly on it. */
  wordmark: HTMLElement;
  assetBase: string;
  /** Skip pointer physics for visitors who asked for less motion. */
  reducedMotion: boolean;
  /** The name has finished forming. */
  onSettled: () => void;
  onContextLost: () => void;
}

export interface DescentHandle {
  play(): void;
  /** Jump to the finished frame without playing the dive. */
  showEnd(): void;
  /** Hold the timeline at a given second. Used for screenshots and debugging. */
  freeze(seconds: number): void;
  /** Finish the dive quickly, for a visitor who is already scrolling. */
  skip(): void;
  relayout(): void;
  /** Pointer position in CSS pixels relative to the canvas. */
  pointer(x: number, y: number): void;
  pointerOut(): void;
  dispose(): void;
}

const DEG = Math.PI / 180;
const EARTH_RADIUS_KM = 6371;

/** Where the dive lands: Eastern Michigan University, Ypsilanti. */
const CAMPUS = { lat: 42.2507, lon: -83.6241 };
/** Pre-dawn in October: the sun sits just south of the equator, well east of campus. */
const SUN = { lat: -7, lon: CAMPUS.lon + 104 };
/** The opening view looks down on the Pacific coast, so the dive sweeps across the continent. */
const ORBIT_START = { lat: 22, lon: -122 };
/**
 * Three levels of night-light detail, so the picture holds up all the way down:
 * the whole globe, everything east of the Rockies, then the Great Lakes at 500 m.
 * Both sets of bounds must match the crops noted in public/hero/CREDITS.md.
 */
const MID = { lonMin: -104, lonMax: -72, latMin: 30, latMax: 50 };
const REGION = { lonMin: -89.6, lonMax: -77.6, latMin: 37.25, latMax: 47.25 };

const FOV = 35;
/** Width of ground in frame once the camera stops. */
const LANDING_SPAN_KM = 440;
const MAX_LANDING_ALTITUDE = 0.11;

/** Seconds. The dive eases in and out, so it starts and lands gently. */
const TL = {
  diveStart: 0.2,
  diveEnd: 5.3,
  aimEnd: 4.3,
  appearStart: 4.9,
  morphStart: 5.3,
  morphLength: 2.0,
  end: 7.4,
} as const;

const SKIP_SPEED = 9;
const MAX_PIXEL_RATIO = 1.5;
/** The glow is drawn from this fraction of the lights, each brighter to match. */
const BLOOM_SHARE = 0.25;

/** Pointer physics, in CSS pixels and seconds. */
// A soft spring with light damping, so a disturbed letter sloshes back instead of snapping.
const FLOW = { push: 3200, carry: 14, swirl: 1400, spring: 18, damping: 3.0 };

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const easeInOut = (x: number) => {
  x = clamp01(x);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Latitude and longitude to a point on the unit sphere, matching three.js sphere UVs. */
function uvRect(b: { lonMin: number; lonMax: number; latMin: number; latMax: number }) {
  return new THREE.Vector4(
    (b.lonMin + 180) / 360,
    (b.latMin + 90) / 180,
    (b.lonMax + 180) / 360,
    (b.latMax + 90) / 180,
  );
}

function toVector(lat: number, lon: number, radius = 1) {
  const la = lat * DEG;
  const lo = lon * DEG;
  return new THREE.Vector3(
    Math.cos(la) * Math.cos(lo) * radius,
    Math.sin(la) * radius,
    -Math.cos(la) * Math.sin(lo) * radius,
  );
}

/** Small seeded generator, so a re-layout keeps the same particles. */
function seeded(seed: number) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6d2b79f5) | 0;
    let x = Math.imul(s ^ (s >>> 15), 1 | s);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const EARTH_VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vUv = uv;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const EARTH_FRAG = /* glsl */ `
  uniform sampler2D uDay;
  uniform sampler2D uNight;
  uniform sampler2D uMid;
  uniform sampler2D uRegion;
  uniform sampler2D uClouds;
  uniform vec3 uSun;
  uniform vec4 uMidRect;
  uniform vec4 uRegionRect;
  uniform float uLights;
  uniform float uSoft;
  varying vec2 vUv;
  varying vec3 vNormalW;
  varying vec3 vPosW;

  // Blend a sharper patch over the map beneath it, feathered so no edge shows.
  vec3 overlay(vec3 base, sampler2D map, vec4 rect, float feather, float bias) {
    vec2 p = (vUv - rect.xy) / (rect.zw - rect.xy);
    vec2 f = smoothstep(vec2(0.0), vec2(feather), p) * (1.0 - smoothstep(vec2(1.0 - feather), vec2(1.0), p));
    return mix(base, texture2D(map, p, bias).rgb, f.x * f.y);
  }

  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vPosW);
    float ndl = dot(n, uSun);
    float day = smoothstep(-0.10, 0.24, ndl);
    float cloud = texture2D(uClouds, vUv).r;

    vec3 dayCol = texture2D(uDay, vUv).rgb;
    dayCol = mix(dayCol, vec3(1.0), cloud * 0.85);
    dayCol *= 0.12 + 1.1 * max(ndl, 0.0);
    // A thin band of sunrise colour along the terminator.
    float dusk = smoothstep(-0.12, 0.05, ndl) * (1.0 - smoothstep(0.05, 0.3, ndl));
    dayCol += vec3(0.55, 0.22, 0.08) * dusk * 0.22;

    // uSoft reads one mip level down near the ground, so 500 m pixels glow instead of showing as squares.
    vec3 night = texture2D(uNight, vUv).rgb;
    night = overlay(night, uMid, uMidRect, 0.12, 0.0);
    night = overlay(night, uRegion, uRegionRect, 0.10, uSoft);

    // Split the map into dark ground and city light, so the lights can dim on their own.
    float lum = max(night.r, max(night.g, night.b));
    float lit = smoothstep(0.10, 0.45, lum);
    vec3 ground = night * (1.0 - lit) * mix(0.34, 1.35, uLights);
    vec3 glow = night * lit * mix(0.34, 1.64, uLights);
    vec3 nightCol = ground + glow;
    nightCol += vec3(0.05, 0.07, 0.11) * cloud * 0.35 * (1.0 - lit);

    vec3 col = mix(nightCol, dayCol, day);

    // Air at the limb, brighter on the sunlit side.
    float fresnel = pow(1.0 - max(dot(n, v), 0.0), 3.2);
    col += vec3(0.25, 0.5, 1.0) * fresnel * (0.10 + 0.9 * smoothstep(-0.35, 0.25, ndl));

    gl_FragColor = vec4(col, 1.0);
    #include <colorspace_fragment>
  }
`;

const HALO_VERT = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vec4 world = modelMatrix * vec4(position, 1.0);
    vPosW = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const HALO_FRAG = /* glsl */ `
  uniform vec3 uSun;
  varying vec3 vNormalW;
  varying vec3 vPosW;
  void main() {
    vec3 n = normalize(vNormalW);
    vec3 v = normalize(cameraPosition - vPosW);
    // Seen from outside, the shell's back face runs from 0 at its edge to about 0.29 at the limb.
    float a = pow(clamp(-dot(n, v) / 0.29, 0.0, 1.0), 2.4);
    float lit = smoothstep(-0.45, 0.35, dot(n, uSun));
    gl_FragColor = vec4(vec3(0.3, 0.56, 1.0) * a * (0.12 + 0.88 * lit), 1.0);
  }
`;

const STAR_VERT = /* glsl */ `
  attribute float aMag;
  attribute float aColour;
  uniform float uPx;
  varying vec3 vCol;
  varying float vAlpha;
  void main() {
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    // Magnitude is logarithmic: each step down is about 2.5 times the light.
    float flux = pow(2.512, -aMag);
    gl_PointSize = clamp(1.5 + 3.4 * pow(flux, 0.36), 1.5, 6.5) * uPx;
    vAlpha = clamp(0.34 + 1.3 * pow(flux, 0.38), 0.0, 1.0);
    // B-V colour index: negative is blue-white, above 1 is orange.
    float t = clamp((aColour + 0.3) / 1.9, 0.0, 1.0);
    vCol = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.96, 0.9), smoothstep(0.0, 0.45, t));
    vCol = mix(vCol, vec3(1.0, 0.76, 0.55), smoothstep(0.45, 1.0, t));
  }
`;

const DOT_FRAG = /* glsl */ `
  varying vec3 vCol;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float a = 1.0 - smoothstep(0.0, 1.0, r);
    gl_FragColor = vec4(vCol * (a * a * vAlpha), 1.0);
  }
`;

/** A full-screen veil, darkest behind the copy on the left. Drawn above the planet, below the name. */
const SCRIM_VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const SCRIM_FRAG = /* glsl */ `
  uniform float uCover;
  varying vec2 vUv;
  void main() {
    float d = length((vUv - vec2(0.14, 0.48)) / vec2(0.78, 0.85));
    float a = d < 0.42 ? mix(0.86, 0.5, d / 0.42) : mix(0.5, 0.0, clamp((d - 0.42) / 0.28, 0.0, 1.0));
    gl_FragColor = vec4(0.012, 0.02, 0.04, a * uCover);
  }
`;

const NAME_FRAG = /* glsl */ `
  uniform float uBloom;
  varying vec3 vCol;
  varying float vAlpha;
  void main() {
    float r = length(gl_PointCoord - 0.5) * 2.0;
    float core = 1.0 - smoothstep(0.30, 0.62, r);
    float halo = exp(-r * r * 3.2);
    float a = mix(core + halo * 0.35, halo, uBloom);
    gl_FragColor = vec4(vCol * (a * vAlpha), 1.0);
  }
`;

const NAME_VERT = /* glsl */ `
  attribute vec3 aStart;
  attribute vec2 aTarget;
  attribute vec2 aRand;
  attribute vec3 aFlow;
  uniform float uMorph;
  uniform float uAppear;
  uniform float uPx;
  uniform float uSize;
  uniform float uGain;
  varying vec3 vCol;
  varying float vAlpha;

  float ease(float x) {
    x = clamp(x, 0.0, 1.0);
    return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
  }

  void main() {
    // Each light starts on the real city it was sampled from, wherever the camera puts it.
    vec4 clip = projectionMatrix * viewMatrix * vec4(aStart, 1.0);
    vec2 from = clip.xy / clip.w;
    float m = ease((uMorph - aRand.x * 0.35) / 0.65);
    vec2 p = mix(from, aTarget, m) + aFlow.xy;
    gl_Position = vec4(p, 0.0, 1.0);
    gl_PointSize = uSize * uPx * mix(1.3, 1.0, m) * (1.0 + aFlow.z * 0.8);
    vAlpha = uAppear * uGain * mix(0.8, 1.0, m) * (0.78 + 0.22 * aRand.y) * (1.0 + aFlow.z * 0.6);
    vCol = mix(vec3(1.0, 0.9, 0.74), vec3(1.0, 0.97, 0.92), aFlow.z);
  }
`;

interface Layout {
  w: number;
  h: number;
  orbitAltitude: number;
  landAltitude: number;
  /** Where the planet's centre sits at the start, as a fraction of the canvas. */
  from: { x: number; y: number };
  /** Where campus sits once the camera stops. */
  to: { x: number; y: number };
}

export async function createDescent(options: DescentOptions): Promise<DescentHandle> {
  const { canvas, wordmark, assetBase } = options;

  const density = window.devicePixelRatio || 1;
  const renderer = new THREE.WebGLRenderer({
    canvas,
    // Multisampling only earns its cost on low-density screens; above that the pixels are small enough.
    antialias: density < 1.5,
    alpha: false,
    powerPreference: "high-performance",
  });
  // Soft imagery looks the same at 1.5x as at 2x, for a little over half the pixels.
  renderer.setPixelRatio(Math.min(density, MAX_PIXEL_RATIO));
  renderer.setClearColor(0x020308, 1);

  const loader = new THREE.TextureLoader();
  const load = (name: string) => loader.loadAsync(`${assetBase}/${name}`);
  let disposed = false;

  let assets;
  try {
    assets = await Promise.all([
      load("earth-day.jpg"),
      load("earth-night.jpg"),
      load("mid-night.jpg"),
      load("region-night.jpg"),
      load("earth-clouds.jpg"),
      load("milkyway.jpg"),
      fetch(`${assetBase}/stars.bin`).then((r) => {
        if (!r.ok) throw new Error(`stars.bin: ${r.status}`);
        return r.arrayBuffer();
      }),
    ]);
  } catch (error) {
    renderer.dispose();
    throw error;
  }
  const [dayMap, nightMap, midMap, regionMap, cloudMap, milkyMap, starBuffer] = assets;

  const anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  for (const map of [dayMap, nightMap, midMap, regionMap, milkyMap]) {
    map.colorSpace = THREE.SRGBColorSpace;
    map.anisotropy = anisotropy;
  }
  for (const map of [dayMap, nightMap, cloudMap, milkyMap]) map.wrapS = THREE.RepeatWrapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.005, 300);
  const sunDir = toVector(SUN.lat, SUN.lon);
  const campusDir = toVector(CAMPUS.lat, CAMPUS.lon);
  const startDir = toVector(ORBIT_START.lat, ORBIT_START.lon);
  const arc = startDir.angleTo(campusDir);

  // Sky: the Milky Way's glow behind 8,920 catalogued stars. It follows the camera,
  // because stars are far enough away that moving around the Earth should not shift them.
  const sky = new THREE.Group();
  scene.add(sky);

  // The NASA map runs right ascension leftwards; mirror it to match the star positions.
  milkyMap.repeat.x = -1;
  milkyMap.offset.x = 1;
  const milkyWay = new THREE.Mesh(
    new THREE.SphereGeometry(90, 48, 24),
    new THREE.MeshBasicMaterial({
      map: milkyMap,
      side: THREE.BackSide,
      depthWrite: false,
      color: new THREE.Color(0.8, 0.82, 0.9),
    }),
  );
  milkyWay.renderOrder = 1;
  sky.add(milkyWay);

  const starData = new Float32Array(starBuffer);
  const starCount = Math.floor(starData.length / 5);
  const starPos = new Float32Array(starCount * 3);
  const starMag = new Float32Array(starCount);
  const starColour = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    starPos[i * 3] = starData[i * 5] * 60;
    starPos[i * 3 + 1] = starData[i * 5 + 1] * 60;
    starPos[i * 3 + 2] = starData[i * 5 + 2] * 60;
    starMag[i] = starData[i * 5 + 3];
    starColour[i] = starData[i * 5 + 4];
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute("position", new THREE.BufferAttribute(starPos, 3));
  starGeometry.setAttribute("aMag", new THREE.BufferAttribute(starMag, 1));
  starGeometry.setAttribute("aColour", new THREE.BufferAttribute(starColour, 1));
  const starUniforms = { uPx: { value: renderer.getPixelRatio() } };
  const stars = new THREE.Points(
    starGeometry,
    new THREE.ShaderMaterial({
      vertexShader: STAR_VERT,
      fragmentShader: DOT_FRAG,
      uniforms: starUniforms,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  stars.frustumCulled = false;
  stars.renderOrder = 2;
  sky.add(stars);

  const earthUniforms = {
    uDay: { value: dayMap },
    uNight: { value: nightMap },
    uMid: { value: midMap },
    uRegion: { value: regionMap },
    uClouds: { value: cloudMap },
    uSun: { value: sunDir },
    uMidRect: { value: uvRect(MID) },
    uRegionRect: { value: uvRect(REGION) },
    uLights: { value: 1 },
    uSoft: { value: 0 },
  };
  const earth = new THREE.Mesh(
    new THREE.SphereGeometry(1, 192, 96),
    new THREE.ShaderMaterial({
      vertexShader: EARTH_VERT,
      fragmentShader: EARTH_FRAG,
      uniforms: earthUniforms,
    }),
  );
  scene.add(earth);

  const halo = new THREE.Mesh(
    new THREE.SphereGeometry(1.045, 96, 48),
    new THREE.ShaderMaterial({
      vertexShader: HALO_VERT,
      fragmentShader: HALO_FRAG,
      uniforms: { uSun: { value: sunDir } },
      side: THREE.BackSide,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
    }),
  );
  scene.add(halo);

  const scrimUniforms = { uCover: { value: 0 } };
  const scrim = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      vertexShader: SCRIM_VERT,
      fragmentShader: SCRIM_FRAG,
      uniforms: scrimUniforms,
      transparent: true,
      depthTest: false,
      depthWrite: false,
    }),
  );
  scrim.frustumCulled = false;
  scrim.renderOrder = 5;
  scene.add(scrim);

  // Read the night-lights patch once, so the name's lights can be drawn from real cities.
  const REGION_W = 960;
  const REGION_H = 800;
  const regionCanvas = document.createElement("canvas");
  regionCanvas.width = REGION_W;
  regionCanvas.height = REGION_H;
  const regionCtx = regionCanvas.getContext("2d", { willReadFrequently: true });
  let regionPixels: Uint8ClampedArray | null = null;
  if (regionCtx) {
    regionCtx.drawImage(regionMap.image as CanvasImageSource, 0, 0, REGION_W, REGION_H);
    try {
      regionPixels = regionCtx.getImageData(0, 0, REGION_W, REGION_H).data;
    } catch {
      regionPixels = null;
    }
  }

  // Shared between the two passes, so one write moves both.
  const uMorph = { value: 0 };
  const uAppear = { value: 0 };
  const uPx = { value: renderer.getPixelRatio() };
  const coreSize = { value: 4 };
  const bloomSize = { value: 30 };
  const nameMaterial = (size: { value: number }, gain: number, bloom: number) =>
    new THREE.ShaderMaterial({
      vertexShader: NAME_VERT,
      fragmentShader: NAME_FRAG,
      uniforms: { uMorph, uAppear, uPx, uSize: size, uGain: { value: gain }, uBloom: { value: bloom } },
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
    });
  // Each light is drawn twice: a crisp dot, and a wide faint one that adds up to a glow.
  const coreMaterial = nameMaterial(coreSize, 1, 0);
  const bloomMaterial = nameMaterial(bloomSize, 0.022 / BLOOM_SHARE, 1);
  let name: THREE.Points | null = null;
  let bloom: THREE.Points | null = null;

  // Pointer physics state, one entry per light. Positions are CSS pixels.
  let homeX = new Float32Array(0);
  let homeY = new Float32Array(0);
  let offX = new Float32Array(0);
  let offY = new Float32Array(0);
  let velX = new Float32Array(0);
  let velY = new Float32Array(0);
  let flow: THREE.BufferAttribute | null = null;
  let reach = 110;

  let layout = measure();
  let clock = 0;
  let speed = 1;
  let raf = 0;
  /**
   * Timestamp of the previous frame, or -1 before the first one. Frame timestamps and
   * performance.now() are not interchangeable: after a long task a frame can carry a
   * timestamp older than "now", so the clock is only ever advanced frame to frame.
   */
  let last = -1;
  let mode: "idle" | "dive" | "flow" = "idle";
  let settled = false;
  let slowFrames = 0;
  let frameCount = 0;

  const mouse = { x: 0, y: 0, vx: 0, vy: 0, inside: false, at: 0 };

  function measure(): Layout {
    const w = Math.max(1, canvas.clientWidth);
    const h = Math.max(1, canvas.clientHeight);
    const wide = w >= h;
    // Size the opening planet against whichever side is shorter, so it never overflows a phone.
    const radiusPx = Math.min(0.26 * h, 0.31 * w);
    const tanAngular = (radiusPx * Math.tan((FOV * DEG) / 2)) / (h / 2);
    const orbitAltitude = 1 / Math.sin(Math.atan(tanAngular)) - 1;
    const halfWidth = Math.tan((FOV * DEG) / 2) * (w / h);
    const landAltitude = Math.min(
      LANDING_SPAN_KM / EARTH_RADIUS_KM / (2 * halfWidth),
      MAX_LANDING_ALTITUDE,
    );
    return {
      w,
      h,
      orbitAltitude,
      landAltitude,
      from: wide ? { x: 0.72, y: 0.46 } : { x: 0.66, y: 0.2 },
      // Campus stops right of the name, so the wordmark sits over quiet countryside
      // and Detroit's glow stays clear of the letters.
      to: wide ? { x: 0.66, y: 0.48 } : { x: 0.6, y: 0.24 },
    };
  }

  function pose(target: THREE.PerspectiveCamera, at: Layout, t: number) {
    const dive = easeInOut((t - TL.diveStart) / (TL.diveEnd - TL.diveStart));
    const aim = easeInOut((t - TL.diveStart) / (TL.aimEnd - TL.diveStart));
    // Altitude falls on a log scale, so the approach feels steady from orbit to rooftop.
    const altitude = at.orbitAltitude * Math.pow(at.landAltitude / at.orbitAltitude, dive);
    const sinArc = Math.sin(arc);
    const a = Math.sin((1 - aim) * arc) / sinArc;
    const b = Math.sin(aim * arc) / sinArc;
    target.position
      .set(
        startDir.x * a + campusDir.x * b,
        startDir.y * a + campusDir.y * b,
        startDir.z * a + campusDir.z * b,
      )
      .multiplyScalar(1 + altitude);
    target.up.set(0, 1, 0);
    target.lookAt(0, 0, 0);
    // Shift the optical centre rather than tilting the camera, so the planet stays undistorted.
    const px = lerp(at.from.x, at.to.x, aim) * at.w;
    const py = lerp(at.from.y, at.to.y, aim) * at.h;
    target.aspect = at.w / at.h;
    target.setViewOffset(at.w, at.h, at.w / 2 - px, at.h / 2 - py, at.w, at.h);
    target.updateMatrixWorld(true);
    return altitude;
  }

  /** Pixel positions of the wordmark's glyphs, in CSS pixels relative to the canvas. */
  function sampleWordmark(rand: () => number) {
    const rect = wordmark.getBoundingClientRect();
    const host = canvas.getBoundingClientRect();
    const style = getComputedStyle(wordmark);
    const size = parseFloat(style.fontSize) || 96;
    const pad = Math.ceil(size * 0.2);
    const width = Math.ceil(rect.width + pad * 2);
    const height = Math.ceil(size * 1.5);
    const points: number[] = [];
    const step = Math.max(1.5, size / 52);
    if (width < 4 || height < 4) return { points, size, step };

    const glyphs = document.createElement("canvas");
    glyphs.width = width;
    glyphs.height = height;
    const ctx = glyphs.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { points, size, step };
    ctx.font = `${style.fontWeight} ${size}px ${style.fontFamily}`;
    if ("letterSpacing" in ctx && style.letterSpacing !== "normal") {
      (ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing =
        style.letterSpacing;
    }
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fff";
    ctx.fillText((wordmark.textContent ?? "").trim(), pad, height / 2);
    const data = ctx.getImageData(0, 0, width, height).data;

    const left = rect.left - host.left - pad;
    const top = rect.top - host.top + rect.height / 2 - height / 2;
    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        if (data[(Math.floor(y) * width + Math.floor(x)) * 4 + 3] > 128) {
          points.push(
            left + x + (rand() - 0.5) * step * 0.5,
            top + y + (rand() - 0.5) * step * 0.5,
          );
        }
      }
    }
    return { points, size, step };
  }

  /** Pick ground positions for the lights, weighted towards the brightest real cities in frame. */
  function pickSources(count: number, rand: () => number) {
    const out = new Float32Array(count * 3);
    const probe = camera.clone();
    pose(probe, layout, TL.end);
    probe.updateProjectionMatrix();

    const candidates: number[] = [];
    const cumulative: number[] = [];
    let total = 0;
    const point = new THREE.Vector3();
    const lonSpan = REGION.lonMax - REGION.lonMin;
    const latSpan = REGION.latMax - REGION.latMin;

    if (regionPixels) {
      const x0 = Math.max(0, Math.floor(((CAMPUS.lon - 3.4 - REGION.lonMin) / lonSpan) * REGION_W));
      const x1 = Math.min(REGION_W, Math.ceil(((CAMPUS.lon + 3.4 - REGION.lonMin) / lonSpan) * REGION_W));
      const y0 = Math.max(0, Math.floor(((REGION.latMax - (CAMPUS.lat + 3.6)) / latSpan) * REGION_H));
      const y1 = Math.min(REGION_H, Math.ceil(((REGION.latMax - (CAMPUS.lat - 3.6)) / latSpan) * REGION_H));
      for (let y = y0; y < y1; y++) {
        for (let x = x0; x < x1; x++) {
          const i = (y * REGION_W + x) * 4;
          const lum = Math.max(regionPixels[i], regionPixels[i + 1], regionPixels[i + 2]) / 255;
          if (lum < 0.14) continue;
          const lon = REGION.lonMin + ((x + 0.5) / REGION_W) * lonSpan;
          const lat = REGION.latMax - ((y + 0.5) / REGION_H) * latSpan;
          point.copy(toVector(lat, lon)).project(probe);
          if (Math.abs(point.x) > 1.02 || Math.abs(point.y) > 1.02) continue;
          total += Math.pow(lum, 1.8);
          candidates.push(x, y);
          cumulative.push(total);
        }
      }
    }

    for (let k = 0; k < count; k++) {
      let lon = CAMPUS.lon + (rand() - 0.5) * 2;
      let lat = CAMPUS.lat + (rand() - 0.5) * 1.2;
      if (cumulative.length > 0) {
        const pick = rand() * total;
        let lo = 0;
        let hi = cumulative.length - 1;
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          if (cumulative[mid] < pick) lo = mid + 1;
          else hi = mid;
        }
        lon = REGION.lonMin + ((candidates[lo * 2] + rand()) / REGION_W) * lonSpan;
        lat = REGION.latMax - ((candidates[lo * 2 + 1] + rand()) / REGION_H) * latSpan;
      }
      const world = toVector(lat, lon, 1.0008);
      out[k * 3] = world.x;
      out[k * 3 + 1] = world.y;
      out[k * 3 + 2] = world.z;
    }
    return out;
  }

  function buildName() {
    if (name) {
      scene.remove(name);
      name.geometry.dispose();
      name = null;
    }
    if (bloom) {
      scene.remove(bloom);
      bloom.geometry.dispose();
      bloom = null;
    }
    const rand = seeded(20261019);
    const { points, size, step } = sampleWordmark(rand);
    const count = points.length / 2;
    if (count === 0) return;

    // Shuffle, so any leading slice of the lights is spread evenly over the letters.
    for (let i = count - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const x = points[i * 2];
      const y = points[i * 2 + 1];
      points[i * 2] = points[j * 2];
      points[i * 2 + 1] = points[j * 2 + 1];
      points[j * 2] = x;
      points[j * 2 + 1] = y;
    }
    const start = pickSources(count, rand);
    const target = new Float32Array(count * 2);
    const random = new Float32Array(count * 2);
    homeX = new Float32Array(count);
    homeY = new Float32Array(count);
    offX = new Float32Array(count);
    offY = new Float32Array(count);
    velX = new Float32Array(count);
    velY = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      homeX[i] = points[i * 2];
      homeY[i] = points[i * 2 + 1];
      target[i * 2] = (homeX[i] / layout.w) * 2 - 1;
      target[i * 2 + 1] = 1 - (homeY[i] / layout.h) * 2;
      random[i * 2] = rand();
      random[i * 2 + 1] = rand();
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(start, 3));
    geometry.setAttribute("aStart", new THREE.BufferAttribute(start, 3));
    geometry.setAttribute("aTarget", new THREE.BufferAttribute(target, 2));
    geometry.setAttribute("aRand", new THREE.BufferAttribute(random, 2));
    flow = new THREE.BufferAttribute(new Float32Array(count * 3), 3);
    flow.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute("aFlow", flow);

    // Dots sit just under one step apart, so strokes read as solid but still made of lights.
    coreSize.value = step * 2.0;
    bloomSize.value = step * 9;
    reach = Math.max(90, size * 1.2);
    // Same buffers, shorter draw range: the wide glow sprites are the expensive part.
    const bloomGeometry = new THREE.BufferGeometry();
    for (const key of ["position", "aStart", "aTarget", "aRand", "aFlow"]) {
      bloomGeometry.setAttribute(key, geometry.getAttribute(key));
    }
    bloomGeometry.setDrawRange(0, Math.ceil(count * BLOOM_SHARE));
    bloom = new THREE.Points(bloomGeometry, bloomMaterial);
    bloom.frustumCulled = false;
    bloom.renderOrder = 9;
    scene.add(bloom);
    name = new THREE.Points(geometry, coreMaterial);
    name.frustumCulled = false;
    name.renderOrder = 10;
    scene.add(name);
  }

  function draw(t: number) {
    const altitude = pose(camera, layout, t);
    sky.position.copy(camera.position);
    // Up close the horizon is out of frame and the camera is inside the shell.
    const appear = easeInOut((t - TL.appearStart) / 0.6);
    const cover = easeInOut((t - 1.7) / 1.5);
    // Skip whatever cannot be seen this frame: sky once the planet fills the view, lights before they exist.
    const horizonInView = altitude > 0.12;
    halo.visible = horizonInView;
    sky.visible = horizonInView;
    scrim.visible = cover > 0;
    if (name) name.visible = appear > 0;
    if (bloom) bloom.visible = appear > 0;
    const morph = clamp01((t - TL.morphStart) / TL.morphLength);
    earthUniforms.uLights.value = 1 - easeInOut(morph);
    earthUniforms.uSoft.value = 0.8 * (1 - clamp01((altitude - 0.06) / 0.2));
    uMorph.value = morph;
    uAppear.value = appear;
    // The veil arrives as the planet slides under the copy.
    scrimUniforms.uCover.value = cover;
    renderer.render(scene, camera);
  }

  function settle() {
    if (settled) return;
    settled = true;
    options.onSettled();
  }

  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
    mode = "idle";
  }

  function diveTick(now: number) {
    if (disposed) return;
    const dt = last < 0 ? 0 : Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    clock = Math.min(TL.end, clock + dt * speed);

    // A device that cannot hold the frame rate gets a lighter canvas, once.
    if (frameCount < 50) {
      frameCount++;
      if (dt > 0.036) slowFrames++;
      if (frameCount === 50 && slowFrames > 30 && renderer.getPixelRatio() > 1) {
        renderer.setPixelRatio(1);
        renderer.setSize(layout.w, layout.h, false);
        uPx.value = 1;
        starUniforms.uPx.value = 1;
      }
    }

    draw(clock);
    if (clock >= TL.end) {
      stop();
      settle();
      return;
    }
    raf = requestAnimationFrame(diveTick);
  }

  /** After the name has formed: lights near the pointer are pushed, carried and spring back. */
  function flowTick(now: number) {
    if (disposed || !flow) return;
    const dt = last < 0 ? 0 : Math.min(0.033, Math.max(0, (now - last) / 1000));
    last = now;
    const array = flow.array as Float32Array;
    const active = mouse.inside && performance.now() - mouse.at < 1200;
    const reach2 = reach * reach;
    const damp = Math.exp(-FLOW.damping * dt);
    // The pointer's own motion decays, so a pointer that stops stops stirring.
    mouse.vx *= Math.exp(-6 * dt);
    mouse.vy *= Math.exp(-6 * dt);
    const turn = mouse.vx >= 0 ? 1 : -1;
    let energy = 0;

    for (let i = 0; i < homeX.length; i++) {
      let vx = velX[i];
      let vy = velY[i];
      if (active) {
        const dx = homeX[i] + offX[i] - mouse.x;
        const dy = homeY[i] + offY[i] - mouse.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < reach2) {
          const d = Math.sqrt(d2) + 0.001;
          let f = 1 - d / reach;
          f *= f;
          vx += ((dx / d) * FLOW.push + mouse.vx * FLOW.carry - (dy / d) * FLOW.swirl * turn) * f * dt;
          vy += ((dy / d) * FLOW.push + mouse.vy * FLOW.carry + (dx / d) * FLOW.swirl * turn) * f * dt;
        }
      }
      vx = (vx - offX[i] * FLOW.spring * dt) * damp;
      vy = (vy - offY[i] * FLOW.spring * dt) * damp;
      offX[i] += vx * dt;
      offY[i] += vy * dt;
      velX[i] = vx;
      velY[i] = vy;

      const moving = Math.min(1, Math.sqrt(vx * vx + vy * vy) / 520);
      array[i * 3] = (offX[i] / layout.w) * 2;
      array[i * 3 + 1] = (-offY[i] / layout.h) * 2;
      array[i * 3 + 2] = moving;
      energy = Math.max(energy, moving, Math.abs(offX[i]) / 40, Math.abs(offY[i]) / 40);
    }
    flow.needsUpdate = true;
    renderer.render(scene, camera);

    // Go fully still again once nothing is moving, so the page costs nothing at rest.
    if (!active && energy < 0.01) {
      array.fill(0);
      offX.fill(0);
      offY.fill(0);
      velX.fill(0);
      velY.fill(0);
      flow.needsUpdate = true;
      renderer.render(scene, camera);
      stop();
      return;
    }
    raf = requestAnimationFrame(flowTick);
  }

  function resize() {
    layout = measure();
    renderer.setSize(layout.w, layout.h, false);
    buildName();
  }

  const onLost = (event: Event) => {
    event.preventDefault();
    stop();
    options.onContextLost();
  };
  canvas.addEventListener("webglcontextlost", onLost);

  resize();
  // Decode, upload and compile now, while the canvas is still hidden, so the dive's first frames are not the ones that pay for it.
  await Promise.all(
    [dayMap, nightMap, midMap, regionMap, cloudMap, milkyMap].map((map) =>
      (map.image as HTMLImageElement).decode?.().catch(() => undefined),
    ),
  );
  for (const map of [dayMap, nightMap, midMap, regionMap, cloudMap, milkyMap]) renderer.initTexture(map);
  renderer.compile(scene, camera);
  draw(0);

  return {
    play() {
      stop();
      clock = 0;
      speed = 1;
      settled = false;
      frameCount = 0;
      slowFrames = 0;
      mode = "dive";
      last = -1;
      raf = requestAnimationFrame(diveTick);
    },
    showEnd() {
      stop();
      clock = TL.end;
      draw(clock);
      settle();
    },
    freeze(seconds) {
      stop();
      clock = Math.max(0, Math.min(TL.end, seconds));
      draw(clock);
      if (clock >= TL.end) settle();
    },
    skip() {
      if (mode === "dive") speed = SKIP_SPEED;
    },
    relayout() {
      const wasDiving = mode === "dive";
      if (mode === "flow") stop();
      resize();
      if (!wasDiving) draw(clock);
    },
    pointer(x, y) {
      const now = performance.now();
      const dt = Math.max(0.008, (now - mouse.at) / 1000);
      if (mouse.inside && dt < 0.2) {
        mouse.vx = lerp(mouse.vx, (x - mouse.x) / dt, 0.5);
        mouse.vy = lerp(mouse.vy, (y - mouse.y) / dt, 0.5);
      }
      mouse.x = x;
      mouse.y = y;
      mouse.at = now;
      mouse.inside = true;
      if (settled && mode === "idle" && clock >= TL.end && !options.reducedMotion && flow) {
        mode = "flow";
        last = -1;
        raf = requestAnimationFrame(flowTick);
      }
    },
    pointerOut() {
      mouse.inside = false;
    },
    dispose() {
      disposed = true;
      stop();
      canvas.removeEventListener("webglcontextlost", onLost);
      if (name) name.geometry.dispose();
      if (bloom) bloom.geometry.dispose();
      coreMaterial.dispose();
      bloomMaterial.dispose();
      for (const mesh of [earth, halo, milkyWay, scrim]) {
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }
      starGeometry.dispose();
      (stars.material as THREE.Material).dispose();
      for (const map of [dayMap, nightMap, midMap, regionMap, cloudMap, milkyMap]) map.dispose();
      renderer.dispose();
    },
  };
}
