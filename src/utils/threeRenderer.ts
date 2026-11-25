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

/**
 * Generates a subtle matte ceramic micro-grain bump texture procedurally.
 */
function createCeramicGrainTexture(): THREE.CanvasTexture {
  const size = 256;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const n = 122 + Math.floor(Math.random() * 14);
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

/**
 * Generates a soft radial contact shadow texture to ground characters cleanly.
 */
function createContactShadowTexture(): THREE.CanvasTexture {
  const size = 128;
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 8, 64, 64, 60);
  g.addColorStop(0, "rgba(72, 71, 68, 0.36)");
  g.addColorStop(0.55, "rgba(72, 71, 68, 0.14)");
  g.addColorStop(1, "rgba(72, 71, 68, 0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

interface CharacterFaceRig {
  leftEye: THREE.Mesh;
  rightEye: THREE.Mesh;
  leftBrow: THREE.Mesh;
  rightBrow: THREE.Mesh;
  mouth: THREE.Mesh;
}

function createMinimalFaceRig(
  inkMat: THREE.MeshStandardMaterial,
  zOffset: number
): { group: THREE.Group; rig: CharacterFaceRig } {
  const group = new THREE.Group();

  const eyeGeo = new THREE.SphereGeometry(0.045, 16, 12);
  const leftEye = new THREE.Mesh(eyeGeo, inkMat);
  leftEye.position.set(-0.14, 0.06, zOffset);
  const rightEye = new THREE.Mesh(eyeGeo, inkMat);
  rightEye.position.set(0.14, 0.06, zOffset);

  const browGeo = new THREE.BoxGeometry(0.1, 0.018, 0.02);
  const leftBrow = new THREE.Mesh(browGeo, inkMat);
  leftBrow.position.set(-0.14, 0.15, zOffset);
  const rightBrow = new THREE.Mesh(browGeo, inkMat);
  rightBrow.position.set(0.14, 0.15, zOffset);

  const mouthGeo = new THREE.SphereGeometry(0.048, 16, 12);
  const mouth = new THREE.Mesh(mouthGeo, inkMat);
  mouth.scale.set(1.25, 0.32, 0.55);
  mouth.position.set(0, -0.1, zOffset);

  group.add(leftEye, rightEye, leftBrow, rightBrow, mouth);
  return {
    group,
    rig: { leftEye, rightEye, leftBrow, rightBrow, mouth },
  };
}

function updateFaceMood(
  rig: CharacterFaceRig,
  mood: "sad" | "worried" | "neutral" | "helping" | "happy",
  isTalking: boolean,
  timeSec: number
) {
  // Subtle natural blink every ~3.6s
  const blinkCycle = (timeSec * 1.05) % 3.6;
  const eyeScaleY = blinkCycle > 3.45 ? 0.14 : mood === "happy" ? 0.72 : 1.0;
  rig.leftEye.scale.set(1, eyeScaleY, 0.75);
  rig.rightEye.scale.set(1, eyeScaleY, 0.75);

  if (mood === "sad") {
    rig.leftBrow.rotation.z = 0.22;
    rig.rightBrow.rotation.z = -0.22;
    rig.leftBrow.position.y = 0.145;
    rig.rightBrow.position.y = 0.145;
  } else if (mood === "worried") {
    rig.leftBrow.rotation.z = 0.32;
    rig.rightBrow.rotation.z = -0.32;
    rig.leftBrow.position.y = 0.165;
    rig.rightBrow.position.y = 0.165;
  } else if (mood === "happy" || mood === "helping") {
    rig.leftBrow.rotation.z = -0.1;
    rig.rightBrow.rotation.z = 0.1;
    rig.leftBrow.position.y = 0.165;
    rig.rightBrow.position.y = 0.165;
  } else {
    rig.leftBrow.rotation.z = 0;
    rig.rightBrow.rotation.z = 0;
    rig.leftBrow.position.y = 0.15;
    rig.rightBrow.position.y = 0.15;
  }

  if (isTalking) {
    const open = 0.4 + Math.abs(Math.sin(timeSec * 14.5)) * 0.75;
    rig.mouth.scale.set(1.05, open, 0.6);
  } else if (mood === "happy" || mood === "helping") {
    rig.mouth.scale.set(1.38, 0.34, 0.55);
  } else if (mood === "sad" || mood === "worried") {
    rig.mouth.scale.set(0.9, 0.38, 0.55);
  } else {
    rig.mouth.scale.set(1.1, 0.26, 0.55);
  }
}

export class ThreeFilmStage {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly isSoftwareGl: boolean;

  private ceramicBump: THREE.CanvasTexture;
  private contactTex: THREE.CanvasTexture;
  private envRT: THREE.WebGLRenderTarget | null = null;

  private keyLight: THREE.DirectionalLight;
  private fillLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private rimLight: THREE.DirectionalLight;

  // Characters
  private cubeGroup: THREE.Group;
  private cubeBodyMesh: THREE.Mesh;
  private cubeFaceRig: CharacterFaceRig;
  private cubeShadow: THREE.Mesh;
  private cubeMat: THREE.MeshStandardMaterial;

  private spheres: Array<{
    root: THREE.Group;
    rollGroup: THREE.Group;
    faceGroup: THREE.Group;
    faceRig: CharacterFaceRig;
    shadow: THREE.Mesh;
    radius: number;
  }> = [];
  private sphereMat: THREE.MeshStandardMaterial;

  // Architectural pathway with toggleable gap plug
  private gapPlug: THREE.Mesh;
  private groundMat: THREE.MeshStandardMaterial;
  private archMat: THREE.MeshStandardMaterial;

  // Reusable scratch vectors (zero GC in loop)
  private readonly _camTarget = new THREE.Vector3();
  private readonly _camPos = new THREE.Vector3();
  private disposables: Array<{ dispose: () => void }> = [];

  constructor(canvas?: HTMLCanvasElement) {
    this.isSoftwareGl = detectSoftwareWebGL();

    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: !this.isSoftwareGl,
      powerPreference: "high-performance",
      preserveDrawingBuffer: true,
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(PALETTE.warmIvory);
    this.scene.fog = new THREE.Fog(PALETTE.warmIvory, 15, 36);

    this.camera = new THREE.PerspectiveCamera(34, 16 / 9, 0.1, 100);
    this.camera.position.set(0, 2.5, 10.5);

    // Studio Environment Reflection (RoomEnvironment)
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const rt = pmrem.fromScene(new RoomEnvironment(), 0.04);
    this.envRT = rt;
    this.scene.environment = rt.texture;
    pmrem.dispose();

    // 3-Point Warm/Cool Studio Lighting
    this.hemiLight = new THREE.HemisphereLight(0xfffcf6, 0xc9c3b8, 0.85);
    this.scene.add(this.hemiLight);

    this.keyLight = new THREE.DirectionalLight(0xfff3e2, 1.55);
    this.keyLight.position.set(6, 11, 7.5);
    this.keyLight.castShadow = !this.isSoftwareGl;
    this.keyLight.shadow.mapSize.width = 2048;
    this.keyLight.shadow.mapSize.height = 2048;
    this.keyLight.shadow.camera.near = 1;
    this.keyLight.shadow.camera.far = 32;
    const d = 9.5;
    this.keyLight.shadow.camera.left = -d;
    this.keyLight.shadow.camera.right = d;
    this.keyLight.shadow.camera.top = d;
    this.keyLight.shadow.camera.bottom = -d;
    this.keyLight.shadow.bias = -0.0005;
    this.keyLight.shadow.normalBias = 0.02;
    this.keyLight.shadow.radius = 4;
    this.scene.add(this.keyLight);

    this.fillLight = new THREE.DirectionalLight(0xe6ecf2, 0.45);
    this.fillLight.position.set(-7, 5, 6);
    this.scene.add(this.fillLight);

    this.rimLight = new THREE.DirectionalLight(0xfff7eb, 0.42);
    this.rimLight.position.set(-2, 6, -8);
    this.scene.add(this.rimLight);

    // Procedural Textures
    this.ceramicBump = createCeramicGrainTexture();
    this.contactTex = createContactShadowTexture();
    this.disposables.push(this.ceramicBump, this.contactTex);

    // Materials (Matte ceramic-like PBR)
    this.cubeMat = new THREE.MeshStandardMaterial({
      color: PALETTE.apricotOrange,
      roughness: 0.78,
      metalness: 0.02,
      bumpMap: this.ceramicBump,
      bumpScale: 0.008,
      envMapIntensity: 0.35,
    });
    const cubeTrimMat = new THREE.MeshStandardMaterial({
      color: "#C7875E",
      roughness: 0.56,
      metalness: 0.04,
      envMapIntensity: 0.4,
    });
    this.sphereMat = new THREE.MeshStandardMaterial({
      color: PALETTE.sageGreen,
      roughness: 0.76,
      metalness: 0.02,
      bumpMap: this.ceramicBump,
      bumpScale: 0.008,
      envMapIntensity: 0.35,
    });
    const sphereBandMat = new THREE.MeshStandardMaterial({
      color: "#8EA189",
      roughness: 0.52,
      metalness: 0.04,
      envMapIntensity: 0.4,
    });
    const inkMat = new THREE.MeshStandardMaterial({
      color: PALETTE.softCharcoal,
      roughness: 0.48,
      metalness: 0.05,
    });
    this.groundMat = new THREE.MeshStandardMaterial({
      color: "#EBE5DA",
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.2,
    });
    const pathMat = new THREE.MeshStandardMaterial({
      color: "#E4DDD0",
      roughness: 0.88,
      metalness: 0.01,
      envMapIntensity: 0.25,
    });
    const trimMat = new THREE.MeshStandardMaterial({
      color: PALETTE.warmGray,
      roughness: 0.82,
      metalness: 0.02,
      envMapIntensity: 0.25,
    });
    this.archMat = new THREE.MeshStandardMaterial({
      color: "#E7E1D5",
      roughness: 0.9,
      metalness: 0.0,
      envMapIntensity: 0.22,
    });

    this.disposables.push(
      this.cubeMat,
      cubeTrimMat,
      this.sphereMat,
      sphereBandMat,
      inkMat,
      this.groundMat,
      pathMat,
      trimMat,
      this.archMat
    );

    // --- Architectural Ivory Landscape & Sculptural Pathway ---
    const floorGeo = new THREE.PlaneGeometry(80, 50);
    const floor = new THREE.Mesh(floorGeo, this.groundMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -1.04;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.disposables.push(floorGeo);

    // Gap sits at x = 1.0, width = 1.06
    const gapX = 1.0;
    const gapWidth = 1.06;
    const leftLen = 22;
    const rightLen = 22;

    const leftPathGeo = new RoundedBoxGeometry(leftLen, 1.04, 2.8, 3, 0.05);
    const leftPath = new THREE.Mesh(leftPathGeo, pathMat);
    leftPath.position.set(gapX - gapWidth / 2 - leftLen / 2, -0.52, 0);
    leftPath.receiveShadow = true;
    leftPath.castShadow = true;
    this.scene.add(leftPath);

    const rightPathGeo = new RoundedBoxGeometry(rightLen, 1.04, 2.8, 3, 0.05);
    const rightPath = new THREE.Mesh(rightPathGeo, pathMat);
    rightPath.position.set(gapX + gapWidth / 2 + rightLen / 2, -0.52, 0);
    rightPath.receiveShadow = true;
    rightPath.castShadow = true;
    this.scene.add(rightPath);

    // Subtle recessed floor inside the gap + architectural rail accent
    const gapFloorGeo = new THREE.BoxGeometry(gapWidth + 0.1, 0.06, 2.8);
    const gapFloor = new THREE.Mesh(gapFloorGeo, trimMat);
    gapFloor.position.set(gapX, -1.01, 0);
    gapFloor.receiveShadow = true;
    this.scene.add(gapFloor);

    // Plug that hides the gap cleanly during Beats 1 & 2
    const plugGeo = new RoundedBoxGeometry(gapWidth, 1.04, 2.8, 3, 0.05);
    this.gapPlug = new THREE.Mesh(plugGeo, pathMat);
    this.gapPlug.position.set(gapX, -0.52, 0);
    this.gapPlug.receiveShadow = true;
    this.scene.add(this.gapPlug);

    this.disposables.push(leftPathGeo, rightPathGeo, gapFloorGeo, plugGeo);

    // Minimalist sculptural background objects (architectural depth)
    const bgMonolithGeo = new RoundedBoxGeometry(1.4, 3.8, 1.4, 3, 0.08);
    const bgMonolith = new THREE.Mesh(bgMonolithGeo, this.archMat);
    bgMonolith.position.set(-5.8, 0.85, -5.5);
    bgMonolith.receiveShadow = true;
    bgMonolith.castShadow = true;
    this.scene.add(bgMonolith);

    const bgSphereGeo = new THREE.SphereGeometry(1.15, 32, 24);
    const bgSphere = new THREE.Mesh(bgSphereGeo, this.archMat);
    bgSphere.position.set(5.4, 0.1, -6.2);
    bgSphere.receiveShadow = true;
    bgSphere.castShadow = true;
    this.scene.add(bgSphere);

    const bgArchGeo = new THREE.TorusGeometry(2.4, 0.28, 16, 48, Math.PI);
    const bgArch = new THREE.Mesh(bgArchGeo, this.archMat);
    bgArch.position.set(0.2, -1.0, -7.8);
    bgArch.receiveShadow = true;
    this.scene.add(bgArch);

    const bgStepGeo = new RoundedBoxGeometry(3.2, 0.7, 2.0, 3, 0.06);
    const bgStep = new THREE.Mesh(bgStepGeo, this.archMat);
    bgStep.position.set(8.8, -0.68, -4.4);
    bgStep.receiveShadow = true;
    this.scene.add(bgStep);

    this.disposables.push(bgMonolithGeo, bgSphereGeo, bgArchGeo, bgStepGeo);

    // --- Hero Square Character (Composite 7-part sculptural rounded cube) ---
    this.cubeGroup = new THREE.Group();
    const cubeGeo = new RoundedBoxGeometry(1.0, 1.0, 1.0, 6, 0.14);
    this.cubeBodyMesh = new THREE.Mesh(cubeGeo, this.cubeMat);
    this.cubeBodyMesh.castShadow = true;
    this.cubeBodyMesh.receiveShadow = true;

    const collarGeo = new RoundedBoxGeometry(0.92, 0.1, 0.92, 4, 0.04);
    const collarMesh = new THREE.Mesh(collarGeo, cubeTrimMat);
    collarMesh.position.y = -0.46;
    collarMesh.castShadow = true;

    const { group: cubeFaceGrp, rig: cubeFaceRig } = createMinimalFaceRig(
      inkMat,
      0.51
    );
    this.cubeFaceRig = cubeFaceRig;
    this.cubeGroup.add(this.cubeBodyMesh, collarMesh, cubeFaceGrp);
    this.scene.add(this.cubeGroup);

    const shadowGeo = new THREE.PlaneGeometry(1.5, 1.5);
    const cubeShadowMat = new THREE.MeshBasicMaterial({
      map: this.contactTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.55,
    });
    this.cubeShadow = new THREE.Mesh(shadowGeo, cubeShadowMat);
    this.cubeShadow.rotation.x = -Math.PI / 2;
    this.cubeShadow.position.y = 0.015;
    this.scene.add(this.cubeShadow);

    this.disposables.push(cubeGeo, collarGeo, shadowGeo, cubeShadowMat);

    // --- Three Sage-Green Spheres (Composite sculptural spheres) ---
    const radii = [0.47, 0.43, 0.49];
    radii.forEach((r) => {
      const root = new THREE.Group();
      const rollGroup = new THREE.Group();

      const sphGeo = new THREE.SphereGeometry(r, 40, 32);
      const sphMesh = new THREE.Mesh(sphGeo, this.sphereMat);
      sphMesh.castShadow = true;
      sphMesh.receiveShadow = true;

      const bandGeo = new THREE.TorusGeometry(r * 0.99, 0.013, 12, 48);
      const bandMesh = new THREE.Mesh(bandGeo, sphereBandMat);
      bandMesh.rotation.y = Math.PI / 2;

      rollGroup.add(sphMesh, bandMesh);

      const { group: faceGroup, rig: faceRig } = createMinimalFaceRig(
        inkMat,
        r + 0.01
      );
      faceGroup.scale.setScalar(r / 0.47);
      root.add(rollGroup, faceGroup);
      this.scene.add(root);

      const sShadowMat = new THREE.MeshBasicMaterial({
        map: this.contactTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.5,
      });
      const sShadow = new THREE.Mesh(shadowGeo, sShadowMat);
      sShadow.rotation.x = -Math.PI / 2;
      sShadow.position.y = 0.015;
      sShadow.scale.setScalar(r * 2.1);
      this.scene.add(sShadow);

      this.spheres.push({
        root,
        rollGroup,
        faceGroup,
        faceRig,
        shadow: sShadow,
        radius: r,
      });
      this.disposables.push(sphGeo, bandGeo, sShadowMat);
    });

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }
  }

  setSize(width: number, height: number) {
    this.camera.aspect = width / Math.max(1, height);
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  private applyStyleMood(style: AnimationStyle, timeSec: number) {
    // Keep same colors & shapes while subtly tuning lighting/material expression per style
    const is2D = style === "2D animation";
    const isClay = style === "Clay";
    const isWatercolor = style === "Watercolor";
    const isLive = style === "Live-action style";
    const isMotion = style === "Minimalist 3D motion graphics";

    this.cubeMat.roughness = isClay ? 0.92 : is2D ? 0.96 : isLive ? 0.68 : 0.78;
    this.sphereMat.roughness = isClay ? 0.9 : is2D ? 0.96 : isLive ? 0.66 : 0.76;
    this.cubeMat.envMapIntensity = is2D || isWatercolor ? 0.12 : isMotion ? 0.42 : 0.35;
    this.sphereMat.envMapIntensity = is2D || isWatercolor ? 0.12 : isMotion ? 0.42 : 0.35;

    // Beat-driven lighting temperature & shadow intensity
    if (timeSec < 7) {
      // Beat 1: Soft diffused natural light
      this.keyLight.color.setHex(0xfff4e6);
      this.keyLight.intensity = isLive ? 1.7 : 1.45;
      this.hemiLight.intensity = 0.92;
      this.fillLight.intensity = 0.5;
    } else if (timeSec < 15) {
      // Beat 2: Slightly cooler light, subtly stronger shadows
      const p = clamp((timeSec - 7) / 2.5);
      this.keyLight.color.setHex(0xf3f5f8);
      this.keyLight.intensity = lerp(1.45, 1.72, p);
      this.hemiLight.intensity = lerp(0.92, 0.68, p);
      this.fillLight.intensity = lerp(0.5, 0.32, p);
    } else if (timeSec < 23) {
      // Beat 3: Gradually introduce warmer light as cube helps
      const p = clamp((timeSec - 15) / 5.0);
      this.keyLight.color.setHex(p > 0.4 ? 0xffeccf : 0xf7f2ea);
      this.keyLight.intensity = lerp(1.65, 1.55, p);
      this.hemiLight.intensity = lerp(0.7, 0.88, p);
      this.fillLight.intensity = lerp(0.35, 0.5, p);
    } else {
      // Beat 4: Warm golden diffused light with soft shadows
      this.keyLight.color.setHex(0xffe7c2);
      this.keyLight.intensity = 1.62;
      this.hemiLight.intensity = 0.96;
      this.fillLight.intensity = 0.56;
    }
  }

  renderAtTime(options: ThreeRenderOptions) {
    const t = clamp(options.timeSec, 0, 30);
    const activeLine = options.timedLines.find(
      (l) => t >= l.startSec && t <= l.endSec
    );
    const squareTalking = activeLine?.speaker === "Square";
    const circleTalking = activeLine?.speaker === "Circle";

    this.applyStyleMood(options.style, t);

    // Gap visibility: hidden in Beats 1 & 2, open in Beats 3 & 4
    const showGap = t >= 15;
    this.gapPlug.visible = !showGap;

    // Reset base transforms
    this.cubeGroup.rotation.set(0, 0, 0);
    this.cubeGroup.scale.set(1, 1, 1);

    if (t < 7) {
      // --- BEAT 1 (0–7s): Hook ---
      const bt = t / 7;
      // Cube stands alone on left
      this.cubeGroup.position.set(-2.9, 0.5, 0.15);
      this.cubeGroup.rotation.y = 0.18;
      updateFaceMood(this.cubeFaceRig, "sad", squareTalking, t);

      // Three sage-green spheres roll gracefully across pathway
      const leadX = lerp(-1.8, 7.2, easeInOut(bt));
      const spacing = [0, -1.25, -2.5];
      this.spheres.forEach((s, idx) => {
        const sx = leadX + spacing[idx];
        const hop = Math.abs(Math.sin(t * 3.2 + idx * 0.7)) * 0.04;
        s.root.position.set(sx, s.radius + hop, -0.3 + idx * 0.22);
        s.rollGroup.rotation.z = -sx / s.radius;
        s.faceGroup.rotation.y = -0.1;
        updateFaceMood(s.faceRig, "happy", false, t + idx * 0.3);
        s.shadow.position.set(sx, 0.015, s.root.position.z);
      });

      // Camera: Wide shot slowly pushing toward the solitary orange cube
      this._camPos.set(
        lerp(0.5, -1.5, easeInOut(bt)),
        lerp(2.7, 2.0, easeInOut(bt)),
        lerp(11.0, 7.6, easeInOut(bt))
      );
      this._camTarget.set(lerp(0.2, -2.1, easeInOut(bt)), 0.55, 0);
    } else if (t < 15) {
      // --- BEAT 2 (7–15s): Problem ---
      const bt = t - 7; // 0..8
      // Move background spheres peacefully off to far right distance
      this.spheres.forEach((s, idx) => {
        s.root.position.set(14 + idx * 1.4, s.radius, -1);
        s.shadow.position.set(14 + idx * 1.4, 0.015, -1);
      });

      let cx = 0;
      let cy = 0.5;
      let rz = 0;
      let sx = 1;
      let sy = 1;

      if (bt < 2.5) {
        // Attempt 1: tilts onto bevel, loses balance, falls onto side
        const p = bt / 2.5;
        if (p < 0.52) {
          const tilt = easeInOut(p / 0.52);
          rz = -tilt * (Math.PI / 4);
          cx = tilt * 0.35;
          cy = 0.5 + Math.sin(tilt * Math.PI) * 0.21;
        } else {
          const fall = easeOutBack((p - 0.52) / 0.48);
          rz = lerp(-Math.PI / 4, -Math.PI / 2, fall);
          cx = 0.35 + fall * 0.32;
          cy = 0.5;
          sx = 1 + Math.sin(fall * Math.PI) * 0.06;
          sy = 1 - Math.sin(fall * Math.PI) * 0.06;
        }
      } else if (bt < 5.3) {
        // Attempt 2: recovers and tries rolling left, tumbles again
        const p = (bt - 2.5) / 2.8;
        if (p < 0.45) {
          const tilt = easeInOut(p / 0.45);
          rz = lerp(-Math.PI / 2, Math.PI / 4, tilt);
          cx = lerp(0.67, -0.25, tilt);
          cy = 0.5 + Math.sin(tilt * Math.PI) * 0.26;
        } else {
          const fall = easeOutBack((p - 0.45) / 0.55);
          rz = lerp(Math.PI / 4, Math.PI / 2, fall);
          cx = lerp(-0.25, -0.68, fall);
          cy = 0.5;
        }
      } else {
        // Settles upright, subtle anxious tremble
        const p = clamp((bt - 5.3) / 0.9);
        rz = lerp(Math.PI / 2, 0, easeOutBack(p));
        cx = lerp(-0.68, 0, easeInOut(p));
        if (p >= 1) {
          rz = Math.sin((bt - 6.2) * 8) * 0.04;
        }
      }

      this.cubeGroup.position.set(cx, cy, 0.2);
      this.cubeGroup.rotation.z = rz;
      this.cubeGroup.scale.set(sx, sy, 1);
      updateFaceMood(this.cubeFaceRig, "worried", squareTalking, t);

      // Camera: Medium shot gently moving to subtle close-up for frustration
      const camZoom = easeInOut(bt / 8);
      this._camPos.set(
        lerp(0.2, 0.0, camZoom),
        lerp(1.85, 1.45, camZoom),
        lerp(6.8, 4.9, camZoom)
      );
      this._camTarget.set(cx * 0.5, 0.5, 0.1);
    } else if (t < 23) {
      // --- BEAT 3 (15–23s): Turn (Gap at x = 1.0) ---
      const bt = t - 15; // 0..8
      const gapX = 1.0;

      // Cube moves from x=-2.4 into gap x=1.0, y=-0.50 (flush top at y=0!)
      let cubeX = -2.4;
      let cubeY = 0.5;
      let cubeMood: "neutral" | "helping" = "neutral";

      if (bt < 2.2) {
        cubeX = -2.4;
        cubeY = 0.5;
      } else if (bt < 3.5) {
        const p = easeInOut((bt - 2.2) / 1.3);
        cubeX = lerp(-2.4, gapX, p);
        cubeY = 0.5 + Math.sin(p * Math.PI) * 0.52;
        cubeMood = "helping";
      } else if (bt < 4.2) {
        const p = easeOutBack((bt - 3.5) / 0.7);
        cubeX = gapX;
        cubeY = lerp(0.5, -0.5, p);
        cubeMood = "helping";
      } else {
        cubeX = gapX;
        cubeY = -0.5; // Flush bridge!
        cubeMood = "helping";
      }

      this.cubeGroup.position.set(cubeX, cubeY, 0);
      updateFaceMood(this.cubeFaceRig, cubeMood, squareTalking, t);

      // Three spheres roll in, stop at gap edge (x ~ -0.15), then roll smoothly across cube bridge!
      const stopXs = [-0.2, -1.25, -2.35];
      const endXs = [4.9, 3.8, 2.75];

      this.spheres.forEach((s, idx) => {
        let sx = stopXs[idx];
        let sy = s.radius;
        let mood: "worried" | "happy" | "neutral" = "worried";

        if (bt < 1.6) {
          const p = easeInOut(bt / 1.6);
          sx = lerp(stopXs[idx] - 3.6, stopXs[idx], p);
          mood = bt > 1.1 ? "worried" : "happy";
        } else if (bt < 4.4) {
          sx = stopXs[idx];
          mood = "worried";
        } else {
          const delay = idx * 0.42;
          const p = easeInOut((bt - 4.4 - delay) / 2.2);
          sx = lerp(stopXs[idx], endXs[idx], p);
          const hop = p > 0 && p < 1 ? Math.abs(Math.sin(p * Math.PI * 3)) * 0.04 : 0;
          sy = s.radius + hop;
          mood = p > 0.35 ? "happy" : "neutral";
        }

        s.root.position.set(sx, sy, (idx - 1) * 0.25);
        s.rollGroup.rotation.z = -sx / s.radius;
        updateFaceMood(s.faceRig, mood, circleTalking && idx === 0, t + idx * 0.25);
        s.shadow.position.set(sx, 0.015, s.root.position.z);
      });

      // Camera: Wide elevated shot showing gap, moving closer to frame bridge clearly
      const camP = easeInOut(bt / 8);
      this._camPos.set(
        lerp(-0.2, 1.35, camP),
        lerp(3.2, 2.55, camP),
        lerp(9.2, 7.5, camP)
      );
      this._camTarget.set(lerp(0.3, 1.1, camP), 0.3, 0);
    } else {
      // --- BEAT 4 (23–30s): Close ---
      const bt = t - 23; // 0..7
      const gapX = 1.0;

      let cubeX = gapX;
      let cubeY = -0.5;
      if (bt < 1.3) {
        const p = easeOutBack(bt / 1.3);
        cubeX = lerp(gapX, 2.1, easeInOut(bt / 1.3));
        cubeY = lerp(-0.5, 0.5, p) + Math.sin(clamp(bt / 1.3) * Math.PI) * 0.45;
      } else if (bt < 3.6) {
        cubeX = 2.1;
        cubeY = 0.5 + Math.abs(Math.sin((bt - 1.3) * 2.5)) * 0.06;
      } else {
        const p = easeInOut((bt - 3.6) / 3.4);
        cubeX = lerp(2.1, 5.4, p);
        cubeY = 0.5 + Math.abs(Math.sin((bt - 3.6) * 3.2)) * 0.07;
      }

      this.cubeGroup.position.set(cubeX, cubeY, 0.15);
      this.cubeGroup.rotation.y = 0.12;
      updateFaceMood(this.cubeFaceRig, "happy", squareTalking, t);

      const startXs = [4.9, 3.8, 2.75];
      const gatherXs = [4.6, 3.45, 0.95];

      this.spheres.forEach((s, idx) => {
        let sx = startXs[idx];
        let sy = s.radius;
        if (bt < 1.6) {
          const p = easeInOut(bt / 1.6);
          sx = lerp(startXs[idx], gatherXs[idx], p);
          sy = s.radius + Math.abs(Math.sin(bt * 3.5 + idx)) * 0.07;
        } else if (bt < 3.6) {
          sx = gatherXs[idx];
          sy = s.radius + Math.abs(Math.sin((bt - 1.6) * 3 + idx * 0.7)) * 0.05;
        } else {
          // Spheres slow down to match the cube's peaceful pace!
          const p = easeInOut((bt - 3.6) / 3.4);
          sx = lerp(gatherXs[idx], gatherXs[idx] + 3.3, p);
          sy = s.radius + Math.abs(Math.sin((bt - 3.6) * 3 + idx)) * 0.04;
        }
        s.root.position.set(sx, sy, (idx - 1) * 0.35 - 0.15);
        s.rollGroup.rotation.z = -sx / s.radius;
        updateFaceMood(s.faceRig, "happy", false, t + idx * 0.2);
        s.shadow.position.set(sx, 0.015, s.root.position.z);
      });

      // Camera: Pull slowly back into calm, balanced wide shot
      const pullP = easeInOut(bt / 7);
      this._camPos.set(
        lerp(2.2, 3.9, pullP),
        lerp(2.3, 2.85, pullP),
        lerp(7.6, 11.4, pullP)
      );
      this._camTarget.set(lerp(2.6, 4.1, pullP), 0.65, 0);
    }

    // Slideshow fallback subtle Ken Burns framing emphasis
    if (options.mode === "3d-slideshow") {
      const zoomDrift = Math.sin(t * 0.7) * 0.25;
      this._camPos.z += zoomDrift;
    }

    // Update Cube contact shadow height & opacity
    const cubeHeight = Math.max(0, this.cubeGroup.position.y - 0.5);
    this.cubeShadow.position.set(
      this.cubeGroup.position.x,
      this.cubeGroup.position.y < 0 ? -0.99 : 0.015,
      this.cubeGroup.position.z
    );
    const sScale = clamp(1.1 - cubeHeight * 0.35, 0.55, 1.15);
    this.cubeShadow.scale.setScalar(sScale);

    this.camera.position.copy(this._camPos);
    this.camera.lookAt(this._camTarget);
    this.renderer.render(this.scene, this.camera);
  }

  /**
   * Renders a clean Character Reference Sheet pose (Square & Circle side-by-side)
   * on the warm ivory studio plinth.
   */
  renderReferenceSheet(style: AnimationStyle) {
    this.applyStyleMood(style, 1.5);
    this.gapPlug.visible = true;

    this.cubeGroup.position.set(-1.15, 0.5, 0);
    this.cubeGroup.rotation.set(0, 0.34, 0);
    this.cubeGroup.scale.set(1, 1, 1);
    updateFaceMood(this.cubeFaceRig, "neutral", false, 1.0);
    this.cubeShadow.position.set(-1.15, 0.015, 0);
    this.cubeShadow.scale.setScalar(1.05);

    const refPos = [0.65, 1.65, 2.55];
    this.spheres.forEach((s, idx) => {
      s.root.position.set(refPos[idx], s.radius, idx === 1 ? 0.15 : -0.15);
      s.rollGroup.rotation.set(0, 0, -0.3 * idx);
      updateFaceMood(s.faceRig, "happy", false, 1.0 + idx * 0.2);
      s.shadow.position.set(refPos[idx], 0.015, s.root.position.z);
    });

    this.camera.position.set(0.4, 1.55, 6.2);
    this.camera.lookAt(0.45, 0.55, 0);
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
