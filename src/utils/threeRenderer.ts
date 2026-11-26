import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { PALETTE } from "../data/defaults";
import type { AnimationStyle, TimedLine } from "../types";

export interface ThreeRenderOptions {
  timeSec: number;
  style: AnimationStyle;
  mode: "3d-animation" | "3d-slideshow";
  timedLines: TimedLine[];
}

export function detectSoftwareWebGL(): boolean {
  try {
    const testCanvas = document.createElement("canvas");
    const gl = testCanvas.getContext("webgl2");
    if (!gl) return true;
    const ext = gl.getExtension("WEBGL_debug_renderer_info");
    const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
    const gpu = String(gl.getParameter(param) || "");
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
  } catch {
    return true;
  }
}

function clamp(v: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, v));
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * clamp(t);
}

function easeInOut(t: number): number {
  const x = clamp(t);
  return x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
}

function easeOutBack(t: number): number {
  const x = clamp(t);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

export type Pt2 = [number, number];

function sampleCubic(p0: Pt2, p1: Pt2, p2: Pt2, p3: Pt2, steps = 28): Pt2[] {
  const pts: Pt2[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const x =
      mt * mt * mt * p0[0] +
      3 * mt * mt * t * p1[0] +
      3 * mt * t * t * p2[0] +
      t * t * t * p3[0];
    const z =
      mt * mt * mt * p0[1] +
      3 * mt * mt * t * p1[1] +
      3 * mt * t * t * p2[1] +
      t * t * t * p3[1];
    pts.push([x, z]);
  }
  return pts;
}

export interface GraphiteDotNode {
  timeSec: number;
  pos: Pt2;
  radius: number;
}

export interface GraphiteStroke {
  startSec: number;
  endSec: number;
  points: Pt2[];
  width: number;
}

/**
 * Timed graphite dots placed by the Yellow Pencil across Beat 1 (1st dot) and Beat 2
 * (11 rhythmic scattered dots), positioned secretly along the flower's silhouette.
 */
export function buildFlowerDotNodes(): GraphiteDotNode[] {
  return [
    { timeSec: 1.45, pos: [0.05, 1.85], radius: 11.5 },  // Beat 1: First little dot
    { timeSec: 7.60, pos: [-0.06, 0.92], radius: 9.5 },  // Stem mid / left leaf base
    { timeSec: 8.02, pos: [-1.1, 0.08], radius: 9.5 },   // Left leaf tip
    { timeSec: 8.82, pos: [0.14, 0.55], radius: 9.5 },   // Right leaf base
    { timeSec: 9.58, pos: [1.05, -0.28], radius: 9.5 },  // Right leaf tip
    { timeSec: 10.30, pos: [0.0, -0.55], radius: 9.5 },  // Calyx / stem top
    { timeSec: 10.98, pos: [-1.05, -0.78], radius: 9.5 },// Lower-left petal outer
    { timeSec: 11.62, pos: [1.05, -0.78], radius: 9.5 }, // Lower-right petal outer
    { timeSec: 12.26, pos: [-0.72, -1.62], radius: 9.5 },// Upper-left petal apex
    { timeSec: 12.92, pos: [0.72, -1.62], radius: 9.5 }, // Upper-right petal apex
    { timeSec: 13.62, pos: [0.0, -2.05], radius: 10.0 }, // Top crown petal peak
    { timeSec: 14.44, pos: [0.0, -0.94], radius: 10.0 }, // Flower center
  ];
}

/**
 * Beat 3 (15.0s -> 19.3s): Pencil physically connects the existing dots with organic
 * graphite lines; Beat 4 (25.2s -> 26.7s): Pencil adds final petal & flourish detail.
 */
export function buildBotanicalFlowerStrokes(): GraphiteStroke[] {
  const stem = sampleCubic([0.05, 1.85], [-0.42, 1.12], [0.38, 0.25], [0.0, -0.55], 32);

  const leftLeaf = [
    ...sampleCubic([-0.06, 0.92], [-0.82, 0.88], [-1.32, 0.35], [-1.1, 0.08], 22),
    ...sampleCubic([-1.1, 0.08], [-0.65, 0.05], [-0.25, 0.48], [-0.06, 0.92], 22),
  ];

  const rightLeaf = [
    ...sampleCubic([0.14, 0.55], [0.82, 0.52], [1.26, -0.02], [1.05, -0.28], 22),
    ...sampleCubic([1.05, -0.28], [0.62, -0.24], [0.28, 0.14], [0.14, 0.55], 22),
  ];

  const petalLowerLeft = sampleCubic(
    [-0.12, -0.68],
    [-1.18, -0.22],
    [-1.38, -1.04],
    [-0.22, -0.92],
    24
  );
  const petalLowerRight = sampleCubic(
    [0.12, -0.68],
    [1.18, -0.22],
    [1.38, -1.04],
    [0.22, -0.92],
    24
  );
  const petalTopLeft = sampleCubic(
    [-0.16, -0.9],
    [-1.04, -1.52],
    [-0.36, -2.14],
    [0.0, -1.18],
    24
  );
  const petalTopRight = sampleCubic(
    [0.16, -0.9],
    [1.04, -1.52],
    [0.36, -2.14],
    [0.0, -1.18],
    24
  );
  const petalCrown = sampleCubic(
    [-0.24, -1.14],
    [-0.36, -2.32],
    [0.36, -2.32],
    [0.24, -1.14],
    24
  );

  const centerCircle: Pt2[] = [];
  for (let i = 0; i <= 24; i++) {
    const a = (i / 24) * Math.PI * 2;
    centerCircle.push([Math.cos(a) * 0.24, -0.94 + Math.sin(a) * 0.22]);
  }

  // Beat 4 final detail: delicate stem-base curl
  const finalDetail = sampleCubic(
    [0.08, 1.38],
    [0.64, 1.34],
    [0.86, 0.96],
    [0.58, 0.86],
    22
  );

  return [
    { startSec: 15.05, endSec: 15.85, points: stem, width: 5.2 },
    { startSec: 15.85, endSec: 16.45, points: leftLeaf, width: 4.5 },
    { startSec: 16.45, endSec: 17.0, points: rightLeaf, width: 4.5 },
    { startSec: 17.0, endSec: 17.48, points: petalLowerLeft, width: 4.8 },
    { startSec: 17.48, endSec: 17.95, points: petalLowerRight, width: 4.8 },
    { startSec: 17.95, endSec: 18.4, points: petalTopLeft, width: 4.8 },
    { startSec: 18.4, endSec: 18.85, points: petalTopRight, width: 4.8 },
    { startSec: 18.85, endSec: 19.25, points: petalCrown, width: 4.8 },
    { startSec: 19.25, endSec: 19.6, points: centerCircle, width: 4.2 },
    { startSec: 25.15, endSec: 26.6, points: finalDetail, width: 4.0 },
  ];
}

export function sampleDotPositionAlongStrokes(
  strokes: GraphiteStroke[],
  timeSec: number
): Pt2 | null {
  for (const s of strokes) {
    if (timeSec >= s.startSec && timeSec <= s.endSec) {
      const p = clamp((timeSec - s.startSec) / Math.max(0.01, s.endSec - s.startSec));
      const fIdx = p * (s.points.length - 1);
      const i0 = Math.floor(fIdx);
      const i1 = Math.min(s.points.length - 1, i0 + 1);
      const frac = fIdx - i0;
      return [
        lerp(s.points[i0][0], s.points[i1][0], frac),
        lerp(s.points[i0][1], s.points[i1][1], frac),
      ];
    }
  }
  return null;
}

/**
 * Samples Pencil tip world (x, y, z) during Beat 2 rhythmic dot-tapping sequence.
 */
export function sampleBeat2PencilTap(
  nodes: GraphiteDotNode[],
  t: number
): { x: number; y: number; z: number; tapping: boolean } {
  const b2 = nodes.slice(1); // 11 Beat-2 dot nodes
  if (t <= b2[0].timeSec) {
    const p = easeInOut((t - 7.0) / Math.max(0.1, b2[0].timeSec - 7.0));
    const arc = Math.sin(p * Math.PI) * 0.28;
    return {
      x: lerp(0.05, b2[0].pos[0], p),
      y: lerp(0.18, 0.01, p) + arc,
      z: lerp(1.85, b2[0].pos[1], p),
      tapping: t > b2[0].timeSec - 0.08,
    };
  }
  for (let i = 0; i < b2.length - 1; i++) {
    const cur = b2[i];
    const nxt = b2[i + 1];
    if (t >= cur.timeSec && t <= nxt.timeSec) {
      const span = nxt.timeSec - cur.timeSec;
      const p = clamp((t - cur.timeSec) / span);
      // Pause briefly right on the dot for ~0.12s, then arc gracefully to the next dot
      const moveP = easeInOut(clamp((p - 0.14) / 0.86));
      const arc = Math.sin(moveP * Math.PI) * 0.26;
      return {
        x: lerp(cur.pos[0], nxt.pos[0], moveP),
        y: arc,
        z: lerp(cur.pos[1], nxt.pos[1], moveP),
        tapping: p < 0.16 || p > 0.92,
      };
    }
  }
  const last = b2[b2.length - 1];
  return { x: last.pos[0], y: 0.04, z: last.pos[1], tapping: false };
}

/**
 * Generates an organic warm ivory drawing paper fiber texture.
 */
function createPaperFiberTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;

  ctx.fillStyle = PALETTE.warmIvory;
  ctx.fillRect(0, 0, size, size);

  for (let i = 0; i < 4500; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const alpha = 0.02 + Math.random() * 0.025;
    ctx.fillStyle =
      Math.random() > 0.5
        ? `rgba(180, 174, 162, ${alpha})`
        : `rgba(255, 255, 255, ${alpha * 1.4})`;
    ctx.fillRect(x, y, 1.5, 1.5);
  }
  ctx.strokeStyle = "rgba(180, 174, 162, 0.05)";
  ctx.lineWidth = 0.8;
  for (let i = 0; i < 260; i++) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const ang = Math.random() * Math.PI * 2;
    const len = 4 + Math.random() * 11;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(ang) * len, y + Math.sin(ang) * len);
    ctx.stroke();
  }

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 2);
  return tex;
}

/**
 * Subtle matte rubber micro-grain bump texture for the cobalt-blue eraser.
 */
function createRubberGrainTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 114 + Math.floor(Math.random() * 26);
    img.data[i] = n;
    img.data[i + 1] = n;
    img.data[i + 2] = n;
    img.data[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(2, 2);
  return tex;
}

function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  g.addColorStop(0, "rgba(36, 36, 36, 0.34)");
  g.addColorStop(0.55, "rgba(36, 36, 36, 0.13)");
  g.addColorStop(1, "rgba(36, 36, 36, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * Expressive Eyes-Only Rig (strictly NO mouth, NO eyebrows, NO arms/legs/accessories).
 */
interface EyesOnlyRig {
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  leftPupil: THREE.Mesh;
  rightPupil: THREE.Mesh;
  baseLeftX: number;
  baseRightX: number;
  baseY: number;
  baseZ: number;
}

function createEyesOnlyRig(
  eyeRadius: number,
  spacingX: number,
  yPos: number,
  zOffset: number
): { group: THREE.Group; rig: EyesOnlyRig } {
  const group = new THREE.Group();
  const whiteMat = new THREE.MeshStandardMaterial({
    color: "#FFFFFF",
    roughness: 0.28,
    metalness: 0.0,
  });
  const pupilMat = new THREE.MeshStandardMaterial({
    color: PALETTE.darkGraphite,
    roughness: 0.18,
    metalness: 0.05,
  });

  const eyeGeo = new THREE.SphereGeometry(eyeRadius, 18, 14);
  const leftEye = new THREE.Mesh(eyeGeo, whiteMat);
  leftEye.position.set(-spacingX, yPos, zOffset);
  leftEye.scale.set(1, 1.15, 0.52);

  const rightEye = new THREE.Mesh(eyeGeo, whiteMat);
  rightEye.position.set(spacingX, yPos, zOffset);
  rightEye.scale.set(1, 1.15, 0.52);

  const pupilGeo = new THREE.SphereGeometry(eyeRadius * 0.54, 14, 12);
  const pupilZ = zOffset + eyeRadius * 0.42;
  const leftPupil = new THREE.Mesh(pupilGeo, pupilMat);
  leftPupil.position.set(-spacingX, yPos, pupilZ);
  leftPupil.scale.set(1, 1, 0.6);

  const rightPupil = new THREE.Mesh(pupilGeo, pupilMat);
  rightPupil.position.set(spacingX, yPos, pupilZ);
  rightPupil.scale.set(1, 1, 0.6);

  group.add(leftEye, rightEye, leftPupil, rightPupil);
  return {
    group,
    rig: {
      leftEye,
      rightEye,
      leftPupil,
      rightPupil,
      baseLeftX: -spacingX,
      baseRightX: spacingX,
      baseY: yPos,
      baseZ: pupilZ,
    },
  };
}

function updateEyesOnly(
  rig: EyesOnlyRig,
  mood: "curious" | "nervous" | "strict" | "amazed" | "relaxed",
  lookX: number,
  lookY: number,
  timeSec: number,
  blinkOffset = 0
) {
  const period = mood === "nervous" ? 2.2 : 3.9;
  const blinkCycle = (timeSec + blinkOffset) % period;
  const isBlinking = blinkCycle > period - 0.14;

  let targetScaleY = 1.12;
  let targetScaleX = 1.0;
  if (isBlinking) {
    targetScaleY = 0.12;
  } else if (mood === "strict") {
    targetScaleY = 0.66;
    targetScaleX = 1.05;
  } else if (mood === "amazed") {
    targetScaleY = 1.38;
    targetScaleX = 1.12;
  } else if (mood === "nervous") {
    targetScaleY = 1.22 + Math.sin(timeSec * 11) * 0.06;
  } else if (mood === "relaxed") {
    targetScaleY = 0.96;
  }

  rig.leftEye.scale.set(targetScaleX, targetScaleY, 0.52);
  rig.rightEye.scale.set(targetScaleX, targetScaleY, 0.52);
  rig.leftPupil.visible = !isBlinking;
  rig.rightPupil.visible = !isBlinking;

  const jitterX = mood === "nervous" ? Math.sin(timeSec * 13) * 0.014 : 0;
  const ox = clamp(lookX, -1, 1) * 0.018 + jitterX;
  const oy = clamp(lookY, -1, 1) * 0.016;

  rig.leftPupil.position.set(rig.baseLeftX + ox, rig.baseY + oy, rig.baseZ);
  rig.rightPupil.position.set(rig.baseRightX + ox, rig.baseY + oy, rig.baseZ);
}

export class ThreeFilmStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly isSoftwareGl: boolean;

  private paperTex: THREE.CanvasTexture;
  private rubberBump: THREE.CanvasTexture;
  private contactTex: THREE.CanvasTexture;
  private graphiteCanvas: HTMLCanvasElement;
  private graphiteCtx: CanvasRenderingContext2D;
  private graphiteTex: THREE.CanvasTexture;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  // Characters
  private pencilGroup: THREE.Group;
  private pencilEyes: EyesOnlyRig;
  private pencilShadow: THREE.Mesh;
  private pencilYellowMat: THREE.MeshStandardMaterial;

  private eraserGroup: THREE.Group;
  private eraserEyes: EyesOnlyRig;
  private eraserShadow: THREE.Mesh;
  private eraserBlueMat: THREE.MeshStandardMaterial;

  private paperMat: THREE.MeshStandardMaterial;
  private dotNodes: GraphiteDotNode[];
  private flowerStrokes: GraphiteStroke[];

  // Reusable math helpers
  private readonly _camTarget = new THREE.Vector3();
  private readonly _camPos = new THREE.Vector3();
  private disposables: Array<{ dispose: () => void }> = [];

  // Paper world bounds mapped to graphiteCanvas (1280x960 covering [-4.8..4.8] x [-3.6..3.6])
  private readonly paperWorldW = 9.6;
  private readonly paperWorldH = 7.2;

  constructor(canvas?: HTMLCanvasElement) {
    this.isSoftwareGl = detectSoftwareWebGL();
    this.dotNodes = buildFlowerDotNodes();
    this.flowerStrokes = buildBotanicalFlowerStrokes();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.isSoftwareGl,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.warmIvory);
    this.scene.fog = new THREE.Fog(PALETTE.warmIvory, 16, 38);

    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
    this.camera.position.set(0, 2.8, 8.2);

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.envRT = rt;
    this.scene.environment = rt.texture;
    pmrem.dispose();

    // 3-Point Studio Lighting
    this.hemiLight = new THREE.HemisphereLight(0xfffef9, 0xd8d2c6, 0.92);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff7ec, 1.54);
    this.keyLight.position.set(5.5, 11.5, 6.8);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 32;
    const d = 8.5;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.keyLight.shadow.radius = 4;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xeef3f8, 0.5);
    this.fillLight.position.set(-7, 6, 5);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xfffaf0, 0.44);
    this.rimLight.position.set(-2, 7, -8);
    this.scene.add(this.rimLight);

    // Procedural Textures
    this.paperTex = createPaperFiberTexture();
    this.paperTex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.rubberBump = createRubberGrainTexture();
    this.contactTex = createContactShadowTexture();
    this.disposables.push(this.paperTex, this.rubberBump, this.contactTex);

    // Progressive Graphite Artwork Canvas Texture
    this.graphiteCanvas = document.createElement("canvas");
    this.graphiteCanvas.width = 1280;
    this.graphiteCanvas.height = 960;
    this.graphiteCtx = this.graphiteCanvas.getContext("2d")!;
    this.graphiteTex = new THREE.CanvasTexture(this.graphiteCanvas);
    this.graphiteTex.colorSpace = THREE.SRGBColorSpace;
    this.graphiteTex.anisotropy = Math.min(8, this.renderer.capabilities.getMaxAnisotropy());
    this.disposables.push(this.graphiteTex);

    // Bright Studio Table & Warm Ivory Drawing Paper Sheet
    const tableMat = new THREE.MeshStandardMaterial({
      color: "#EFECE4",
      roughness: 0.94,
      metalness: 0.0,
      envMapIntensity: 0.16,
    });
    const tableGeo = new THREE.PlaneGeometry(80, 60);
    const tableMesh = new THREE.Mesh(tableGeo, tableMat);
    tableMesh.rotation.x = -Math.PI / 2;
    tableMesh.position.y = -0.06;
    tableMesh.receiveShadow = true;
    this.scene.add(tableMesh);

    this.paperMat = new THREE.MeshStandardMaterial({
      color: "#FFFFFF",
      map: this.paperTex,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.18,
    });
    const paperGeo = new RoundedBoxGeometry(10.6, 0.06, 8.0, 2, 0.015);
    const paperMesh = new THREE.Mesh(paperGeo, this.paperMat);
    paperMesh.position.set(0, -0.03, 0);
    paperMesh.receiveShadow = true;
    paperMesh.castShadow = true;
    this.scene.add(paperMesh);

    const graphiteMat = new THREE.MeshStandardMaterial({
      map: this.graphiteTex,
      transparent: true,
      roughness: 0.42,
      metalness: 0.12,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const graphitePlaneGeo = new THREE.PlaneGeometry(this.paperWorldW, this.paperWorldH);
    const graphitePlane = new THREE.Mesh(graphitePlaneGeo, graphiteMat);
    graphitePlane.rotation.x = -Math.PI / 2;
    graphitePlane.position.set(0, 0.008, 0);
    graphitePlane.receiveShadow = true;
    this.scene.add(graphitePlane);

    this.disposables.push(
      tableMat,
      tableGeo,
      this.paperMat,
      paperGeo,
      graphiteMat,
      graphitePlaneGeo
    );

    // --- Character 1: Vivid Yellow Hexagonal Wooden Pencil (#F5C518) ---
    // Local origin (0, 0, 0) is right at the sharpened graphite tip!
    this.pencilGroup = new THREE.Group();

    const leadMat = new THREE.MeshStandardMaterial({
      color: PALETTE.darkGraphite,
      roughness: 0.35,
      metalness: 0.18,
      envMapIntensity: 0.5,
    });
    const woodMat = new THREE.MeshStandardMaterial({
      color: "#E4C093",
      roughness: 0.78,
      metalness: 0.0,
      envMapIntensity: 0.22,
    });
    this.pencilYellowMat = new THREE.MeshStandardMaterial({
      color: PALETTE.pencilYellow,
      roughness: 0.28,
      metalness: 0.04,
      envMapIntensity: 0.65,
    });
    const ferruleMat = new THREE.MeshStandardMaterial({
      color: "#D8D2C5",
      roughness: 0.32,
      metalness: 0.68,
      envMapIntensity: 0.8,
    });
    const topCapMat = new THREE.MeshStandardMaterial({
      color: "#ECE6D8",
      roughness: 0.84,
      metalness: 0.0,
    });

    // 1. Dark graphite sharpened cone tip (y: 0.0 -> 0.18)
    const leadGeo = new THREE.ConeGeometry(0.068, 0.18, 14);
    leadGeo.rotateX(Math.PI);
    leadGeo.translate(0, 0.09, 0);
    const leadMesh = new THREE.Mesh(leadGeo, leadMat);
    leadMesh.castShadow = true;

    // 2. Sharpened hexagonal cedar wood collar (y: 0.17 -> 0.56)
    const woodGeo = new THREE.CylinderGeometry(0.185, 0.066, 0.39, 6);
    woodGeo.translate(0, 0.365, 0);
    const woodMesh = new THREE.Mesh(woodGeo, woodMat);
    woodMesh.castShadow = true;
    woodMesh.receiveShadow = true;

    // 3. Vivid yellow hexagonal painted wooden barrel (y: 0.55 -> 2.38)
    const barrelGeo = new THREE.CylinderGeometry(0.188, 0.188, 1.83, 6);
    barrelGeo.translate(0, 1.465, 0);
    const barrelMesh = new THREE.Mesh(barrelGeo, this.pencilYellowMat);
    barrelMesh.castShadow = true;
    barrelMesh.receiveShadow = true;

    // 4. Brushed ferrule band (y: 2.38 -> 2.55)
    const ferruleGeo = new THREE.CylinderGeometry(0.19, 0.19, 0.17, 24);
    ferruleGeo.translate(0, 2.465, 0);
    const ferruleMesh = new THREE.Mesh(ferruleGeo, ferruleMat);
    ferruleMesh.castShadow = true;

    // 5. Clean rounded top cap (y: 2.55 -> 2.66)
    const capGeo = new THREE.CylinderGeometry(0.172, 0.186, 0.11, 24);
    capGeo.translate(0, 2.605, 0);
    const capMesh = new THREE.Mesh(capGeo, topCapMat);
    capMesh.castShadow = true;

    // ONLY two small expressive eyes on the hexagonal body (no mouth, no eyebrows)
    const { group: pencilEyesGrp, rig: pencilEyesRig } = createEyesOnlyRig(
      0.048,
      0.078,
      1.34,
      0.175
    );
    this.pencilEyes = pencilEyesRig;

    this.pencilGroup.add(
      leadMesh,
      woodMesh,
      barrelMesh,
      ferruleMesh,
      capMesh,
      pencilEyesGrp
    );
    this.scene.add(this.pencilGroup);

    const shadowGeo = new THREE.PlaneGeometry(1.25, 1.25);
    const pencilShadowMat = new THREE.MeshBasicMaterial({
      map: this.contactTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.42,
    });
    this.pencilShadow = new THREE.Mesh(shadowGeo, pencilShadowMat);
    this.pencilShadow.rotation.x = -Math.PI / 2;
    this.pencilShadow.position.y = 0.012;
    this.scene.add(this.pencilShadow);

    // --- Character 2: Saturated Cobalt-Blue Rectangular Rubber Eraser (#2449D8) ---
    this.eraserGroup = new THREE.Group();
    this.eraserBlueMat = new THREE.MeshStandardMaterial({
      color: PALETTE.eraserBlue,
      roughness: 0.88,
      metalness: 0.0,
      bumpMap: this.rubberBump,
      bumpScale: 0.014,
      envMapIntensity: 0.24,
    });

    const eraserBodyGeo = new RoundedBoxGeometry(0.92, 1.18, 0.58, 5, 0.11);
    const eraserBody = new THREE.Mesh(eraserBodyGeo, this.eraserBlueMat);
    eraserBody.castShadow = true;
    eraserBody.receiveShadow = true;

    // ONLY two small expressive eyes on upper front face (no mouth, no eyebrows, no sleeve)
    const { group: eraserEyesGrp, rig: eraserEyesRig } = createEyesOnlyRig(
      0.064,
      0.155,
      0.24,
      0.292
    );
    this.eraserEyes = eraserEyesRig;

    this.eraserGroup.add(eraserBody, eraserEyesGrp);
    this.scene.add(this.eraserGroup);

    const eraserShadowMat = new THREE.MeshBasicMaterial({
      map: this.contactTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.48,
    });
    this.eraserShadow = new THREE.Mesh(shadowGeo, eraserShadowMat);
    this.eraserShadow.rotation.x = -Math.PI / 2;
    this.eraserShadow.position.y = 0.012;
    this.eraserShadow.scale.set(1.35, 1.05, 1);
    this.scene.add(this.eraserShadow);

    this.disposables.push(
      leadMat,
      woodMat,
      this.pencilYellowMat,
      ferruleMat,
      topCapMat,
      leadGeo,
      woodGeo,
      barrelGeo,
      ferruleGeo,
      capGeo,
      shadowGeo,
      pencilShadowMat,
      this.eraserBlueMat,
      eraserBodyGeo,
      eraserShadowMat
    );

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  setSize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private worldToCanvasPx(pt: Pt2): Pt2 {
    const u = (pt[0] / this.paperWorldW + 0.5) * this.graphiteCanvas.width;
    const v = (pt[1] / this.paperWorldH + 0.5) * this.graphiteCanvas.height;
    return [u, v];
  }

  private updateProgressiveGraphiteCanvas(timeSec: number) {
    const ctx = this.graphiteCtx;
    ctx.clearRect(0, 0, this.graphiteCanvas.width, this.graphiteCanvas.height);

    // 1. Render all graphite dots placed so far (Beat 1 + Beat 2 dot-by-dot)
    for (const node of this.dotNodes) {
      if (timeSec < node.timeSec) continue;
      const appearP = clamp((timeSec - node.timeSec) / 0.14);
      const r = lerp(2.5, node.radius, easeOutBack(appearP));
      const [px, pz] = this.worldToCanvasPx(node.pos);
      ctx.fillStyle = PALETTE.darkGraphite;
      ctx.beginPath();
      ctx.arc(px, pz, r, 0, Math.PI * 2);
      ctx.fill();
    }

    // 2. Unnecessary stray graphite marks near (1.85, 1.25) wiped by Eraser in Beat 4
    if (timeSec >= 8.2 && timeSec < 24.75) {
      const fade = timeSec > 23.75 ? 1 - clamp((timeSec - 23.75) / 0.95) : 1;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.fillStyle = PALETTE.darkGraphite;
      const [sx, sz] = this.worldToCanvasPx([1.85, 1.25]);
      ctx.beginPath();
      ctx.ellipse(sx, sz, 9.5, 6.0, 0.32, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(sx + 20, sz - 7, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // 3. Beat 3 & Beat 4: Organic graphite lines progressively connecting the dots
    ctx.save();
    ctx.strokeStyle = PALETTE.darkGraphite;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (const stroke of this.flowerStrokes) {
      if (timeSec < stroke.startSec) continue;
      const prog = clamp(
        (timeSec - stroke.startSec) / Math.max(0.01, stroke.endSec - stroke.startSec)
      );
      const maxIndex = prog * (stroke.points.length - 1);
      const whole = Math.floor(maxIndex);
      const frac = maxIndex - whole;

      ctx.lineWidth = stroke.width;
      ctx.beginPath();
      const first = this.worldToCanvasPx(stroke.points[0]);
      ctx.moveTo(first[0], first[1]);

      for (let i = 1; i <= whole; i++) {
        const p = this.worldToCanvasPx(stroke.points[i]);
        ctx.lineTo(p[0], p[1]);
      }

      if (frac > 0 && whole < stroke.points.length - 1) {
        const a = stroke.points[whole];
        const b = stroke.points[whole + 1];
        const interp = this.worldToCanvasPx([
          lerp(a[0], b[0], frac),
          lerp(a[1], b[1], frac),
        ]);
        ctx.lineTo(interp[0], interp[1]);
      }
      ctx.stroke();
    }

    // Delicate stamen dots inside flower center once center finishes (~19.5s)
    if (timeSec >= 19.5) {
      const alpha = clamp((timeSec - 19.5) / 0.5);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = PALETTE.darkGraphite;
      [
        [0, -0.94],
        [-0.08, -0.88],
        [0.08, -0.89],
        [0.02, -1.02],
      ].forEach((pt) => {
        const [px, pz] = this.worldToCanvasPx(pt as Pt2);
        ctx.beginPath();
        ctx.arc(px, pz, 3.8, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    ctx.restore();
    this.graphiteTex.needsUpdate = true;
  }

  private applyStyleAndLighting(style: AnimationStyle, timeSec: number) {
    const is2D = style === "2D animation";
    const isClay = style === "Clay";
    const isWatercolor = style === "Watercolor";
    const isLive = style === "Live-action style";

    this.pencilYellowMat.roughness = isClay ? 0.62 : is2D ? 0.88 : isLive ? 0.24 : 0.28;
    this.eraserBlueMat.roughness = isClay ? 0.94 : is2D ? 0.96 : isLive ? 0.82 : 0.88;
    this.pencilYellowMat.envMapIntensity = is2D || isWatercolor ? 0.16 : 0.65;

    if (timeSec < 7) {
      this.keyLight.color.setHex(0xfff7ec);
      this.keyLight.intensity = 1.5;
      this.hemiLight.intensity = 0.92;
      this.fillLight.intensity = 0.5;
    } else if (timeSec < 15) {
      this.keyLight.color.setHex(0xf8fafe);
      this.keyLight.intensity = 1.56;
      this.hemiLight.intensity = 0.84;
      this.fillLight.intensity = 0.44;
    } else if (timeSec < 23) {
      // Slightly warmer studio lighting during the overhead flower reveal
      const p = clamp((timeSec - 16.5) / 3.5);
      this.keyLight.color.setHex(p > 0.35 ? 0xffecc9 : 0xfbf5ec);
      this.keyLight.intensity = lerp(1.56, 1.62, p);
      this.hemiLight.intensity = lerp(0.86, 0.96, p);
      this.fillLight.intensity = lerp(0.46, 0.56, p);
    } else {
      this.keyLight.color.setHex(0xffe9c4);
      this.keyLight.intensity = 1.6;
      this.hemiLight.intensity = 0.96;
      this.fillLight.intensity = 0.58;
    }
  }

  renderAtTime(options: ThreeRenderOptions) {
    const t = clamp(options.timeSec, 0, 30);
    this.applyStyleAndLighting(options.style, t);
    this.updateProgressiveGraphiteCanvas(t);

    this.pencilGroup.visible = true;
    this.pencilShadow.visible = true;
    this.pencilGroup.rotation.set(0, 0, 0);
    this.pencilGroup.scale.set(1, 1, 1);
    this.eraserGroup.rotation.set(0, 0, 0);
    this.eraserGroup.scale.set(1, 1, 1);

    if (t < 7) {
      // --- BEAT 1 (0–7s): Yellow pencil enters, tilts & places 1st graphite dot; Cobalt-blue eraser enters ---
      if (t < 1.1) {
        const p = easeInOut(t / 1.1);
        this.pencilGroup.position.set(lerp(-2.4, 0.05, p), lerp(0.85, 0.16, p), 1.85);
        this.pencilGroup.rotation.set(0.14, 0.15, lerp(-0.26, -0.18, p));
        updateEyesOnly(this.pencilEyes, "curious", 0.3, -0.7, t);
      } else if (t < 1.85) {
        // Gentle forward tilt tapping onto paper at (0.05, 1.85) around t = 1.45s
        const tapP = clamp((t - 1.1) / 0.75);
        const touchDip = tapP < 0.48 ? tapP / 0.48 : 1 - (tapP - 0.48) / 0.52;
        const y = lerp(0.16, 0.005, easeInOut(touchDip));
        this.pencilGroup.position.set(0.05, y, 1.85);
        this.pencilGroup.rotation.set(lerp(0.12, 0.24, touchDip), 0.18, -0.16);
        updateEyesOnly(this.pencilEyes, "curious", 0.0, -0.9, t);
      } else {
        // Pencil lifts slightly and glides back left, looking curiously at incoming cobalt-blue eraser
        const settleP = easeInOut((t - 1.85) / 1.6);
        const px = lerp(0.05, -0.95, settleP);
        this.pencilGroup.position.set(px, 0.12 + Math.sin(t * 2.4) * 0.015, 1.82);
        this.pencilGroup.rotation.set(0.14, lerp(0.18, 0.42, settleP), -0.18);
        updateEyesOnly(this.pencilEyes, "curious", 0.85, 0.1, t);
      }

      // Cobalt-blue eraser slides into frame from right at t = 2.1s -> notices dot
      const eP = easeInOut((t - 2.1) / 2.2);
      const ex = lerp(5.8, 1.28, eP);
      const slideTilt = t > 2.1 && t < 4.3 ? Math.sin(t * 7) * 0.04 : 0.06;
      this.eraserGroup.position.set(ex, 0.59, 1.75);
      this.eraserGroup.rotation.set(t > 4.4 ? 0.1 : 0.04, -0.36, slideTilt);
      updateEyesOnly(
        this.eraserEyes,
        t > 3.6 ? "strict" : "curious",
        -0.8,
        t > 4.0 ? -0.6 : -0.1,
        t,
        0.9
      );

      // Camera: Macro shot of sharpened tip touching paper (0..2.5s), then widen to show both
      if (t < 2.5) {
        const cp = easeInOut(t / 2.5);
        this._camPos.set(0.05, lerp(0.95, 1.35, cp), lerp(3.45, 4.45, cp));
        this._camTarget.set(0.05, lerp(0.14, 0.55, cp), 1.85);
      } else {
        const cp = easeInOut((t - 2.5) / 3.8);
        this._camPos.set(lerp(0.05, 0.25, cp), lerp(1.35, 1.85, cp), lerp(4.45, 6.2, cp));
        this._camTarget.set(lerp(0.05, 0.18, cp), 0.65, 1.78);
      }
    } else if (t < 15) {
      // --- BEAT 2 (7–15s): Eraser chases; Pencil rhythmically taps 11 scattered flower dots ---
      const tap = sampleBeat2PencilTap(this.dotNodes, t);
      this.pencilGroup.position.set(tap.x, tap.y, tap.z);
      this.pencilGroup.rotation.set(
        tap.tapping ? 0.2 : 0.14,
        0.22 + Math.sin(t * 3.5) * 0.12,
        -0.2 + Math.sin(t * 6) * 0.06
      );
      updateEyesOnly(
        this.pencilEyes,
        "nervous",
        Math.sin(t * 5.2),
        -0.4,
        t
      );

      // Eraser chases behind & attempts to erase marks
      const lagTap = sampleBeat2PencilTap(this.dotNodes, Math.max(7.1, t - 1.15));
      const chaseIn = easeInOut((t - 7.0) / 1.3);
      const ex = lerp(1.28, lagTap.x + 0.92, chaseIn);
      const ez = lerp(1.75, lagTap.z + 0.62, chaseIn);
      this.eraserGroup.position.set(ex, 0.59, ez);
      this.eraserGroup.rotation.set(0.14, -0.38, Math.sin(t * 9) * 0.07);
      updateEyesOnly(this.eraserEyes, "strict", -0.75, -0.45, t, 1.1);

      // Low-angle tracking close-up so overall flower outline remains hidden
      const trackP = easeInOut((t - 7.0) / 8.0);
      this._camPos.set(
        tap.x * 0.65 + 0.45,
        lerp(1.45, 2.05, trackP),
        tap.z + lerp(3.35, 3.85, trackP)
      );
      this._camTarget.set(tap.x + 0.15, 0.52, tap.z);
    } else if (t < 23) {
      // --- BEAT 3 (15–23s): Pencil connects existing dots; Eraser watches; Overhead flower reveal! ---
      const bt = t - 15; // 0..8
      const strokePos = sampleDotPositionAlongStrokes(this.flowerStrokes, t);
      const px = strokePos ? strokePos[0] : lerp(0.0, -1.68, easeInOut((bt - 4.6) / 1.5));
      const pz = strokePos ? strokePos[1] : lerp(-0.94, 0.96, easeInOut((bt - 4.6) / 1.5));

      this.pencilGroup.position.set(px, strokePos ? 0.004 : 0.12, pz);
      this.pencilGroup.rotation.set(0.24, 0.25, -0.22);
      updateEyesOnly(
        this.pencilEyes,
        bt > 4.6 ? "relaxed" : "curious",
        bt > 4.6 ? 0.8 : 0.0,
        bt > 4.6 ? 0.1 : -0.8,
        t
      );

      // Eraser stops moving and watches curiously, then widens eyes in surprise at 18.1s musical accent
      const ex = lerp(1.35, 2.02, easeInOut(bt / 2.2));
      const ez = lerp(0.65, 0.35, easeInOut(bt / 2.2));
      this.eraserGroup.position.set(ex, 0.59, ez);
      this.eraserGroup.rotation.set(bt > 3.05 ? -0.04 : 0.05, -0.58, bt > 3.05 ? -0.05 : 0);
      updateEyesOnly(
        this.eraserEyes,
        bt > 3.05 ? "amazed" : "curious",
        -0.8,
        -0.25,
        t,
        0.4
      );

      // Extreme close-up connecting dots (0..1.6s), then smooth crane up to overhead wide flower reveal!
      const revealP = easeInOut((bt - 1.6) / 4.4);
      this._camPos.set(
        lerp(px * 0.4, 0.15, revealP),
        lerp(1.45, 6.6, revealP),
        lerp(pz + 2.4, 3.6, revealP)
      );
      this._camTarget.set(lerp(px, 0.08, revealP), lerp(0.18, 0.04, revealP), lerp(pz, -0.15, revealP));
    } else {
      // --- BEAT 4 (23–30s): Eraser wipes stray marks, Pencil adds final detail, apologetic tilt & peaceful art print ---
      const bt = t - 23; // 0..7

      // Eraser moves to stray marks at (1.85, 1.25), wipes gently, then tilts toward Pencil in apology
      let ex = 2.02;
      let ez = 0.35;
      let erotZ = 0;
      let erotY = -0.58;
      if (bt < 0.85) {
        const p = easeInOut(bt / 0.85);
        ex = lerp(2.02, 1.85, p);
        ez = lerp(0.35, 1.25, p);
      } else if (bt < 1.9) {
        ex = 1.85 + Math.sin((bt - 0.85) * 14) * 0.18;
        ez = 1.25;
        erotZ = Math.sin((bt - 0.85) * 14) * 0.09;
      } else {
        const p = easeInOut((bt - 1.9) / 1.8);
        ex = lerp(1.85, 1.65, p);
        ez = lerp(1.25, 1.08, p);
        erotY = lerp(-0.58, -0.45, p);
        // Gentle apologetic tilt toward Pencil around 25.0s..27.4s
        const tiltEnv = Math.sin(clamp((bt - 2.0) / 2.6) * Math.PI);
        erotZ = tiltEnv * 0.12;
      }
      this.eraserGroup.position.set(ex, 0.59, ez);
      this.eraserGroup.rotation.set(0.02, erotY, erotZ);
      updateEyesOnly(
        this.eraserEyes,
        "relaxed",
        bt < 4.5 ? -0.65 : -0.35,
        -0.1,
        t,
        0.5
      );

      // Yellow pencil adds final detail (25.15..26.6), then rests gracefully beside Eraser & flower
      const strokePos = sampleDotPositionAlongStrokes(this.flowerStrokes, t);
      let px = -1.68;
      let py = 0.12;
      let pz = 0.96;
      if (bt < 2.15) {
        const p = easeInOut(bt / 2.15);
        px = lerp(-1.68, 0.08, p);
        py = lerp(0.12, 0.005, p) + Math.sin(p * Math.PI) * 0.15;
        pz = lerp(0.96, 1.38, p);
      } else if (strokePos) {
        px = strokePos[0];
        py = 0.004;
        pz = strokePos[1];
      } else {
        const p = easeInOut((bt - 3.6) / 1.5);
        px = lerp(0.58, -1.58, p);
        py = lerp(0.005, 0.08, p) + Math.sin(p * Math.PI) * 0.14;
        pz = lerp(0.86, 1.05, p);
      }
      this.pencilGroup.position.set(px, py, pz);
      this.pencilGroup.rotation.set(0.16, 0.3, -0.22);
      updateEyesOnly(this.pencilEyes, "relaxed", 0.55, 0.0, t, 1.3);

      // Pull camera back into balanced minimalist contemporary art-print composition
      const pullP = easeInOut(bt / 6.8);
      this._camPos.set(
        lerp(0.15, 0.05, pullP),
        lerp(6.4, 5.5, pullP),
        lerp(3.8, 5.6, pullP)
      );
      this._camTarget.set(0.05, 0.15, lerp(-0.1, 0.1, pullP));
    }

    if (options.mode === "3d-slideshow") {
      this._camPos.z += Math.sin(t * 0.7) * 0.24;
    }

    // Grounded contact shadows
    this.pencilShadow.position.set(
      this.pencilGroup.position.x + 0.15,
      0.012,
      this.pencilGroup.position.z
    );
    const pencilAir = Math.max(0, this.pencilGroup.position.y);
    this.pencilShadow.scale.setScalar(clamp(0.75 - pencilAir * 0.2, 0.3, 0.8));

    this.eraserShadow.position.set(
      this.eraserGroup.position.x,
      0.012,
      this.eraserGroup.position.z
    );

    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camTarget);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Renders the locked Character Reference Sheet (Yellow Pencil + Cobalt-Blue Eraser side-by-side).
   */
  renderReferenceSheet(style: AnimationStyle) {
    this.applyStyleAndLighting(style, 1.5);
    this.updateProgressiveGraphiteCanvas(20.0);

    this.pencilGroup.visible = true;
    this.pencilShadow.visible = true;
    this.pencilGroup.position.set(-1.12, 0.04, 1.25);
    this.pencilGroup.rotation.set(0.12, 0.26, -0.18);
    this.pencilGroup.scale.set(0.95, 0.95, 0.95);
    updateEyesOnly(this.pencilEyes, "curious", 0.25, 0.0, 1.0);
    this.pencilShadow.position.set(-1.0, 0.012, 1.25);
    this.pencilShadow.scale.setScalar(0.76);

    this.eraserGroup.position.set(1.05, 0.59, 1.2);
    this.eraserGroup.rotation.set(0, -0.32, 0);
    this.eraserGroup.scale.set(1, 1, 1);
    updateEyesOnly(this.eraserEyes, "relaxed", -0.25, 0.0, 1.0);
    this.eraserShadow.position.set(1.05, 0.012, 1.2);

    this.camera.position.set(0, 1.9, 5.7);
    this.camera.lookAt(0, 0.72, 0.9);
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    if (this.envRT) {
      this.envRT.dispose();
      this.envRT = null;
    }
    this.renderer.dispose();
  }
}
