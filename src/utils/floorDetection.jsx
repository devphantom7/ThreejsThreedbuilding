import * as THREE from "three";

/**
 * Auto-detects "floors" in a 3D model by mesh name or by Y-axis clustering.
 * @param {THREE.Scene|THREE.Group} scene
 * @param {object} [opts]
 * @param {string[]} [opts.floorKeywords] - List of keywords to search in mesh names.
 * @param {number} [opts.floorHeight] - Height (Y units) for auto-slicing if not found.
 */
export function detectFloors(scene, opts = {}) {
  const floorKeywords = opts.floorKeywords || ["floor", "level"];
  const floorHeight = opts.floorHeight || 3; // adjust based on your model units

  // 1. Try name-based detection
  let floors = {};
  scene.traverse((node) => {
    if (node.isMesh) {
      const name = node.name.toLowerCase();
      const match = floorKeywords.find((kw) => name.includes(kw));
      if (match) {
        if (!floors[name]) floors[name] = [];
        floors[name].push(node);
      }
    }
  });

  // Convert to array
  let detected = Object.entries(floors).map(([name, meshes]) => ({
    name,
    meshes,
  }));

  // 2. If not found, use Y slicing
  if (detected.length === 0) {
    // Gather mesh Y centers
    let meshInfos = [];
    scene.traverse((node) => {
      if (node.isMesh) {
        node.updateMatrixWorld();
        const box = new THREE.Box3().setFromObject(node);
        const center = box.getCenter(new THREE.Vector3());
        meshInfos.push({ mesh: node, centerY: center.y });
      }
    });
    if (meshInfos.length === 0) return [];

    // Find Y range
    const minY = Math.min(...meshInfos.map((m) => m.centerY));
    const maxY = Math.max(...meshInfos.map((m) => m.centerY));
    const floorCount = Math.ceil((maxY - minY) / floorHeight);

    let slices = Array.from({ length: floorCount }, (_, i) => ({
      name: `Floor ${i + 1}`,
      yRange: [minY + i * floorHeight, minY + (i + 1) * floorHeight],
      meshes: [],
    }));

    meshInfos.forEach(({ mesh, centerY }) => {
      const idx = Math.floor((centerY - minY) / floorHeight);
      if (slices[idx]) slices[idx].meshes.push(mesh);
    });

    // Filter empty
    detected = slices.filter((s) => s.meshes.length > 0);
  }

  return detected;
}
