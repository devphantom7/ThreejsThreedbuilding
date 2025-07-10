// src/components/GLBViewer.jsx
import React, { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// CONFIG: Adjust this as needed (in model units, e.g., 3 = 3 meters)
const FLOOR_HEIGHT = 3;

// UTILITY: Auto-detect "floors" by Y-axis slicing
function detectFloorsByHeight(scene, floorHeight = FLOOR_HEIGHT) {
  const meshInfos = [];
  scene.traverse((node) => {
    if (node.isMesh) {
      node.updateMatrixWorld();
      const box = new THREE.Box3().setFromObject(node);
      const center = box.getCenter(new THREE.Vector3());
      meshInfos.push({
        mesh: node,
        centerY: center.y,
      });
    }
  });
  if (meshInfos.length === 0) return [];

  const minY = Math.min(...meshInfos.map((m) => m.centerY));
  const maxY = Math.max(...meshInfos.map((m) => m.centerY));
  const floorCount = Math.max(1, Math.ceil((maxY - minY) / floorHeight));

  // Group meshes into floors
  const floors = Array.from({ length: floorCount }, (_, i) => ({
    label: `Floor ${i + 1}`,
    value: `auto_floor_${i + 1}`,
    nodes: [],
    allComponents: [],
    yRange: [minY + i * floorHeight, minY + (i + 1) * floorHeight],
  }));

  meshInfos.forEach(({ mesh, centerY }) => {
    const idx = Math.min(
      floors.length - 1,
      Math.floor((centerY - minY) / floorHeight)
    );
    floors[idx].nodes.push(mesh);
    floors[idx].allComponents.push(mesh);
  });

  // Remove empty floors
  return floors.filter((f) => f.nodes.length > 0);
}

// Load and parse model
const Model = ({ url, onFloorsDetected, onModelBounds, highlightedFloor }) => {
  const { scene } = useGLTF(url);
  const originalMaterials = useRef(new Map());

  useEffect(() => {
    const floorNodes = [];
    const allNodes = [];

    // Collect all nodes and identify floor nodes
    scene.traverse((node) => {
      if (node.isMesh) {
        allNodes.push(node);
        if (!originalMaterials.current.has(node.uuid)) {
          originalMaterials.current.set(node.uuid, node.material);
        }
        if (
          node.name.toLowerCase().includes("floor") ||
          node.name.toLowerCase().includes("level")
        ) {
          floorNodes.push(node);
        }
      }
    });

    // ----- Try Name-Based Floor Detection -----
    floorNodes.sort((a, b) => a.name.localeCompare(b.name));
    const floorMap = new Map();
    floorNodes.forEach((node) => {
      const floorMatch =
        node.name.match(/floor[\s_-]*(\d+)/i) ||
        node.name.match(/(\d+)(?:st|nd|rd|th)?[\s_-]*floor/i) ||
        node.name.match(/level[\s_-]*(\d+)/i) ||
        node.name.match(/(\d+)$/);
      let key;
      if (floorMatch) {
        key = `floor_${floorMatch[1]}`;
      } else {
        key = node.name.toLowerCase();
      }
      if (!floorMap.has(key)) {
        floorMap.set(key, {
          nodes: [node],
          name: node.name,
          floorNumber: floorMatch ? parseInt(floorMatch[1]) : null,
        });
      } else {
        floorMap.get(key).nodes.push(node);
      }
    });

    // ----- Map nodes to floors -----
    const floorComponentsMap = new Map();
    const assignedNodes = new Set();
    Array.from(floorMap.keys()).forEach((floorKey) => {
      const floorData = floorMap.get(floorKey);
      const floorNumber = floorData.floorNumber;
      const relatedNodes = [];
      allNodes.forEach((node) => {
        if (assignedNodes.has(node.uuid)) return;
        const nodeName = node.name.toLowerCase();
        let matched = false;
        // Name-based
        if (
          floorNumber &&
          (nodeName.includes(`floor${floorNumber}`) ||
            nodeName.includes(`floor_${floorNumber}`) ||
            nodeName.includes(`floor ${floorNumber}`) ||
            nodeName.includes(`level${floorNumber}`) ||
            nodeName.includes(`level_${floorNumber}`) ||
            nodeName.includes(`level ${floorNumber}`) ||
            nodeName.includes(`f${floorNumber}_`) ||
            nodeName.includes(`f${floorNumber}`) ||
            nodeName.match(
              new RegExp(`${floorNumber}(?:st|nd|rd|th)?[\\s_-]*floor`, "i")
            ))
        ) {
          matched = true;
        }
        // Fallback: y-position grouping
        if (!matched) {
          const floorBoundingBox = new THREE.Box3();
          floorData.nodes.forEach((floorNode) => {
            const nodeBox = new THREE.Box3().setFromObject(floorNode);
            floorBoundingBox.union(nodeBox);
          });
          const nodeBox = new THREE.Box3().setFromObject(node);
          const nodeCenter = new THREE.Vector3();
          nodeBox.getCenter(nodeCenter);
          const floorCenter = new THREE.Vector3();
          floorBoundingBox.getCenter(floorCenter);
          const yTolerance =
            floorBoundingBox.max.y - floorBoundingBox.min.y + 5;
          const yDifference = Math.abs(nodeCenter.y - floorCenter.y);
          if (yDifference <= yTolerance) {
            matched = true;
          }
        }
        if (matched) {
          assignedNodes.add(node.uuid);
          relatedNodes.push(node);
        }
      });
      floorComponentsMap.set(floorKey, relatedNodes);
    });

    // Build array of floor entries if found by name
    let uniqueFloors = [];
    if (floorMap.size > 0) {
      const floorEntries = Array.from(floorMap.entries()).sort((a, b) => {
        const aNum = a[1].floorNumber;
        const bNum = b[1].floorNumber;
        if (aNum !== null && bNum !== null) return aNum - bNum;
        return a[1].name.localeCompare(b[1].name);
      });
      uniqueFloors = floorEntries.map(([key, floorData], index) => ({
        label: floorData.floorNumber
          ? `Floor ${floorData.floorNumber}`
          : `Floor ${index + 1}`,
        value: key,
        node: floorData.nodes[0],
        nodes: floorData.nodes,
        allComponents: floorComponentsMap.get(key) || floorData.nodes,
        originalName: floorData.name,
      }));
    }

    // ----- Fallback: If NO named floors, use height slicing -----
    if (uniqueFloors.length === 0) {
      uniqueFloors = detectFloorsByHeight(scene, FLOOR_HEIGHT);
    }

    // Notify parent
    onFloorsDetected(uniqueFloors);

    // Model bounds
    const boundingBox = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    boundingBox.getCenter(center);
    boundingBox.getSize(size);

    onModelBounds({ center, size });
  }, [scene, onFloorsDetected, onModelBounds]);

  // Handle floor highlighting
  useEffect(() => {
    scene.traverse((node) => {
      if (node.isMesh) {
        const originalMaterial = originalMaterials.current.get(node.uuid);
        if (originalMaterial) {
          node.material = originalMaterial;
        }
      }
    });
    if (highlightedFloor?.allComponents) {
      const highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6b35,
        transparent: true,
        opacity: 0.7,
      });
      highlightedFloor.allComponents.forEach((node) => {
        if (node.isMesh) {
          node.material = highlightMaterial;
        }
      });
    }
  }, [scene, highlightedFloor]);

  return <primitive object={scene} />;
};

const SceneWrapper = ({
  modelPath,
  setFloors,
  selectedFloor,
  highlightedFloor,
  modelBounds,
  setModelBounds,
}) => {
  const { camera } = useThree();
  const controlsRef = useRef();
  const [hasInitialized, setHasInitialized] = useState(false);

  useEffect(() => {
    if (modelBounds && !hasInitialized) {
      const { center, size } = modelBounds;
      camera.position.set(
        center.x,
        center.y + size.y / 2,
        center.z + size.z * 2
      );
      if (controlsRef.current) {
        controlsRef.current.target.set(center.x, center.y, center.z);
        controlsRef.current.update();
      }
      setHasInitialized(true);
    }
  }, [modelBounds, hasInitialized, camera]);

  useEffect(() => {
    if (selectedFloor?.node && controlsRef.current && hasInitialized) {
      const box = new THREE.Box3();
      if (selectedFloor.nodes && selectedFloor.nodes.length > 1) {
        selectedFloor.nodes.forEach((node) => {
          const nodeBox = new THREE.Box3().setFromObject(node);
          box.union(nodeBox);
        });
      } else {
        box.setFromObject(selectedFloor.node);
      }
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);
      const distance = Math.max(size.x, size.y, size.z) * 1.5;
      const targetPosition = new THREE.Vector3(
        center.x + distance * 0.7,
        center.y + distance * 0.7,
        center.z + distance * 0.7
      );
      const startPosition = camera.position.clone();
      const startTarget = controlsRef.current.target.clone();

      let progress = 0;
      const animationSpeed = 0.02;

      const animate = () => {
        progress += animationSpeed;
        if (progress >= 1) {
          camera.position.copy(targetPosition);
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
          return;
        }
        camera.position.lerpVectors(startPosition, targetPosition, progress);
        controlsRef.current.target.lerpVectors(startTarget, center, progress);
        controlsRef.current.update();
        requestAnimationFrame(animate);
      };
      animate();
    }
  }, [selectedFloor, camera, hasInitialized]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 10]} />
      <Suspense fallback={null}>
        <Model
          url={modelPath}
          onFloorsDetected={setFloors}
          onModelBounds={setModelBounds}
          highlightedFloor={highlightedFloor}
        />
      </Suspense>
      <OrbitControls
        ref={controlsRef}
        enableDamping={true}
        dampingFactor={0.1}
        minDistance={1}
        maxDistance={1000}
        enablePan={true}
        enableZoom={true}
        enableRotate={true}
      />
    </>
  );
};

const GLBViewer = ({ modelPath }) => {
  const [floors, setFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [highlightedFloor, setHighlightedFloor] = useState(null);
  const [modelBounds, setModelBounds] = useState(null);

  return (
    <div style={{ height: "90vh", width: "100vw", position: "relative" }}>
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10 }}>
        <div style={{ marginBottom: "10px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              color: "white",
              fontSize: "14px",
            }}
          >
            Zoom to Floor:
          </label>
          <select
            className="p-2 border rounded bg-white text-black"
            onChange={(e) => {
              const selected = floors.find((f) => f.value === e.target.value);
              setSelectedFloor(selected);
            }}
            style={{ width: "150px" }}
          >
            <option value="">Select Floor</option>
            {floors.map((floor) => (
              <option key={floor.value} value={floor.value}>
                {floor.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              color: "white",
              fontSize: "14px",
            }}
          >
            Highlight Floor:
          </label>
          <select
            className="p-2 border rounded bg-white text-black"
            onChange={(e) => {
              const selected = floors.find((f) => f.value === e.target.value);
              setHighlightedFloor(selected);
            }}
            style={{ width: "150px" }}
          >
            <option value="">No Highlight</option>
            {floors.map((floor) => (
              <option key={floor.value} value={floor.value}>
                {floor.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <Canvas camera={{ position: [0, 0, 0], fov: 60 }}>
        <SceneWrapper
          modelPath={modelPath}
          setFloors={setFloors}
          selectedFloor={selectedFloor}
          highlightedFloor={highlightedFloor}
          modelBounds={modelBounds}
          setModelBounds={setModelBounds}
        />
      </Canvas>
    </div>
  );
};

export default GLBViewer;
