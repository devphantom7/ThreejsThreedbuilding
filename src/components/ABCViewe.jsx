// src/components/ABCViewer.jsx
import React, { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { AlembicLoader } from "../loaders/AlembicLoader"; // Use correct path

// Custom hook to load .abc file
function useABC(url) {
  const [scene, setScene] = useState(null);

  useEffect(() => {
    let loader = new AlembicLoader();
    loader.load(url, (abcScene) => {
      setScene(abcScene);
    });

    // Optional cleanup
    return () => {
      setScene(null);
    };
  }, [url]);

  return scene;
}

// Load and parse model
const ABCModel = ({
  url,
  onFloorsDetected,
  onModelBounds,
  highlightedFloor,
}) => {
  const scene = useABC(url);
  const originalMaterials = useRef(new Map());
  const floorComponents = useRef(new Map());

  useEffect(() => {
    if (!scene) return;

    const floorNodes = [];
    const allNodes = [];

    // You may need to adjust this traversal if your Alembic files have different conventions!
    scene.traverse((node) => {
      if (node.isMesh) {
        allNodes.push(node);

        // Save original material
        if (!originalMaterials.current.has(node.uuid)) {
          originalMaterials.current.set(node.uuid, node.material);
        }

        // Floor detection logic (customize this for your ABC files)
        if (node.name && node.name.toLowerCase().includes("floor")) {
          floorNodes.push(node);
        }
      }
    });

    // Floor grouping & mapping logic (copy-pasted, tweak as per actual Alembic hierarchy if needed)
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

    // Group ALL nodes by floor (same logic)
    const floorComponentsMap = new Map();
    const assignedNodes = new Set();
    Array.from(floorMap.keys()).forEach((floorKey) => {
      const floorData = floorMap.get(floorKey);
      const floorNumber = floorData.floorNumber;
      const relatedNodes = [];
      allNodes.forEach((node) => {
        if (assignedNodes.has(node.uuid)) return;
        const nodeName = node.name?.toLowerCase() ?? "";
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

        // Y-position fallback
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

    floorComponents.current = floorComponentsMap;

    const floorEntries = Array.from(floorMap.entries()).sort((a, b) => {
      const aNum = a[1].floorNumber;
      const bNum = b[1].floorNumber;
      if (aNum !== null && bNum !== null) {
        return aNum - bNum;
      }
      return a[1].name.localeCompare(b[1].name);
    });

    const uniqueFloors = floorEntries.map(([key, floorData], index) => ({
      label: floorData.floorNumber
        ? `floor ${floorData.floorNumber}`
        : `floor ${index + 1}`,
      value: key,
      node: floorData.nodes[0],
      nodes: floorData.nodes,
      allComponents: floorComponentsMap.get(key) || floorData.nodes,
      originalName: floorData.name,
    }));

    onFloorsDetected(uniqueFloors);

    // Model bounds
    const boundingBox = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    boundingBox.getCenter(center);
    boundingBox.getSize(size);

    onModelBounds({ center, size });
  }, [scene, onFloorsDetected, onModelBounds]);

  // Highlight logic
  useEffect(() => {
    if (!scene) return;
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

  if (!scene) return null;
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
        <ABCModel
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

const ABCViewer = ({ modelPath }) => {
  const [floors, setFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [highlightedFloor, setHighlightedFloor] = useState(null);
  const [modelBounds, setModelBounds] = useState(null);

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10 }}>
        <div style={{ marginBottom: "10px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              color: "black",
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
              color: "black",
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

export default ABCViewer;
