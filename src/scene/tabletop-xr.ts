/**
 * The tabletop solar system live in AR, on Android (ADR 0014): Scene Viewer can't take a
 * model made in the page, so the page shows it itself, through WebXR. A ring marks the
 * surface the phone finds; a tap puts the table there. Loaded only when asked.
 */
import * as THREE from 'three/webgpu';

/**
 * Shows `table` (metres, +Y up) in AR until the visitor closes it.
 * @param closeLabel The close button's text, in the visitor's language.
 * @param onEnd Called once the session has ended.
 */
export async function showInAr(
  table: THREE.Object3D,
  closeLabel: string,
  onEnd: () => void,
): Promise<void> {
  const overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;inset:0;pointer-events:none';
  const close = document.createElement('button');
  close.textContent = closeLabel;
  close.style.cssText =
    'position:absolute;top:calc(16px + env(safe-area-inset-top));right:16px;pointer-events:auto;' +
    'min-height:44px;padding:0 18px;border:0;border-radius:999px;' +
    'background:rgb(12 20 34 / 0.7);color:#fff;font:600 15px system-ui';
  overlay.append(close);
  document.body.append(overlay);

  const xr = navigator.xr!;
  const session = await xr.requestSession('immersive-ar', {
    requiredFeatures: ['hit-test'],
    optionalFeatures: ['dom-overlay'],
    domOverlay: { root: overlay },
  });
  // XR runs on WebGL: a renderer of its own, for the session only.
  const renderer = new THREE.WebGPURenderer({ antialias: true, alpha: true, forceWebGL: true });
  await renderer.init();
  renderer.xr.enabled = true;
  renderer.xr.setReferenceSpaceType('local');
  await renderer.xr.setSession(session);

  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.6));
  const sunlight = new THREE.PointLight(0xffffff, 1.6, 0, 0);
  table.add(sunlight); // at the table's centre, where the Sun is
  table.visible = false;
  scene.add(table);
  const camera = new THREE.PerspectiveCamera();

  const reticle = new THREE.Mesh(
    new THREE.RingGeometry(0.08, 0.1, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x7dd3fc }),
  );
  reticle.matrixAutoUpdate = false;
  reticle.visible = false;
  scene.add(reticle);

  const viewer = await session.requestReferenceSpace('viewer');
  const hitTest = await session.requestHitTestSource!({ space: viewer });
  session.addEventListener('select', () => {
    if (!reticle.visible) return;
    reticle.matrix.decompose(table.position, table.quaternion, table.scale);
    table.visible = true;
  });
  close.addEventListener('click', () => void session.end());

  renderer.setAnimationLoop((_time: number, frame?: XRFrame) => {
    const space = renderer.xr.getReferenceSpace();
    const hit = frame && space && hitTest ? frame.getHitTestResults(hitTest)[0] : undefined;
    const pose = hit && space ? hit.getPose(space) : undefined;
    reticle.visible = pose !== undefined && !table.visible;
    if (pose) reticle.matrix.fromArray(pose.transform.matrix);
    renderer.render(scene, camera);
  });

  session.addEventListener('end', () => {
    renderer.setAnimationLoop(null);
    hitTest?.cancel();
    renderer.dispose();
    overlay.remove();
    table.removeFromParent();
    onEnd();
  });
}
