import React, { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Define component type matchers
const MODEL_COMPONENT_TYPES = [
  { label: "Windows", key: "window", patterns: [/window/i, /win/i] },
  { label: "Doors", key: "door", patterns: [/door/i, /dr/i] },
];

// Helper: walk up the parent chain and check name/userData.name
function matchesAnyPattern(node, patterns) {
  let curr = node;
  while (curr) {
    const toTest = [
      curr.name || "",
      curr.userData?.name || ""
    ];
    if (toTest.some(str =>
      patterns.some(pattern => pattern.test(str))
    )) {
      return true;
    }
    curr = curr.parent;
  }
  return false;
}

const Model = ({
  url,
  onFloorsDetected,
  onModelBounds,
  highlightedFloor,
  highlightedComponentType,
  setComponentTypes,
}) => {
  const { scene } = useGLTF(url);
  const originalMaterials = useRef(new Map());
  const floorComponents = useRef(new Map());

  useEffect(() => {
    const floorNodes = [];
    const allNodes = [];
    const typeNodesMap = new Map();

    // Traverse scene and collect everything
    scene.traverse((node) => {
      if (node.isMesh) {
        allNodes.push(node);

        // Log for debug: show mesh name, parent name, userData
        console.log(
          "Mesh:",
          node.name,
          "| Parent:", node.parent?.name,
          "| userData:", node.userData?.name
        );

        if (!originalMaterials.current.has(node.uuid)) {
          originalMaterials.current.set(node.uuid, node.material);
        }

        if (node.name.toLowerCase().includes("floor")) {
          floorNodes.push(node);
        }

        // NEW: check mesh itself, parent chain, AND userData for each type
        MODEL_COMPONENT_TYPES.forEach((type) => {
          if (matchesAnyPattern(node, type.patterns)) {
            if (!typeNodesMap.has(type.key)) typeNodesMap.set(type.key, []);
            typeNodesMap.get(type.key).push(node);
          }
        });
      }
    });

    setComponentTypes(
      MODEL_COMPONENT_TYPES
        .filter((type) => typeNodesMap.get(type.key)?.length)
        .map((type) => ({
          label: type.label,
          key: type.key,
          nodes: typeNodesMap.get(type.key),
        }))
    );

    // ---- Floor logic unchanged ----
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

        if (
          floorNumber &&
          (
            nodeName.includes(`floor${floorNumber}`) ||
            nodeName.includes(`floor_${floorNumber}`) ||
            nodeName.includes(`floor ${floorNumber}`) ||
            nodeName.includes(`level${floorNumber}`) ||
            nodeName.includes(`level_${floorNumber}`) ||
            nodeName.includes(`level ${floorNumber}`) ||
            nodeName.includes(`f${floorNumber}_`) ||
            nodeName.includes(`f${floorNumber}`) ||
            nodeName.match(
              new RegExp(`${floorNumber}(?:st|nd|rd|th)?[\\s_-]*floor`, "i")
            )
          )
        ) {
          matched = true;
        }

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

          const yTolerance = floorBoundingBox.max.y - floorBoundingBox.min.y + 5;
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
  }, [scene, onFloorsDetected, onModelBounds, setComponentTypes]);

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
        if (node.isMesh) node.material = highlightMaterial;
      });
    }

    if (highlightedComponentType?.nodes?.length) {
      const highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0x36a2eb,
        transparent: true,
        opacity: 0.7,
      });
      highlightedComponentType.nodes.forEach((node) => {
        if (node.isMesh) node.material = highlightMaterial;
      });
    }
  }, [scene, highlightedFloor, highlightedComponentType]);

  return <primitive object={scene} />;
};

const SceneWrapper = ({
  modelPath,
  setFloors,
  selectedFloor,
  highlightedFloor,
  highlightedComponentType,
  modelBounds,
  setModelBounds,
  setComponentTypes,
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
          highlightedComponentType={highlightedComponentType}
          setComponentTypes={setComponentTypes}
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
  const [highlightedComponentType, setHighlightedComponentType] = useState(null);
  const [componentTypes, setComponentTypes] = useState([]);
  const [modelBounds, setModelBounds] = useState(null);

  useEffect(() => {
    if (highlightedFloor) setHighlightedComponentType(null);
  }, [highlightedFloor]);
  useEffect(() => {
    if (highlightedComponentType) setHighlightedFloor(null);
  }, [highlightedComponentType]);

  return (
    <div style={{ height: "90vh", width: "100vw", position: "relative" }}>
      {/* UI Dropdowns */}
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
            value={selectedFloor?.value || ""}
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
            value={highlightedFloor?.value || ""}
          >
            <option value="">No Highlight</option>
            {floors.map((floor) => (
              <option key={floor.value} value={floor.value}>
                {floor.label}
              </option>
            ))}
          </select>
        </div>

        {/* NEW: Dropdown for Windows/Doors/other types */}
        <div style={{ marginTop: "18px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              color: "white",
              fontSize: "14px",
            }}
          >
            Highlight Type:
          </label>
          <select
            className="p-2 border rounded bg-white text-black"
            onChange={(e) => {
              const selected = componentTypes.find((t) => t.key === e.target.value);
              setHighlightedComponentType(selected || null);
            }}
            style={{ width: "150px" }}
            value={highlightedComponentType?.key || ""}
          >
            <option value="">No Highlight</option>
            {componentTypes.length === 0 && (
              <option value="" disabled>
                No Types Found
              </option>
            )}
            {componentTypes.map((type) => (
              <option key={type.key} value={type.key}>
                {type.label} ({type.nodes.length})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Canvas */}
      <Canvas camera={{ position: [0, 0, 0], fov: 60 }}>
        <SceneWrapper
          modelPath={modelPath}
          setFloors={setFloors}
          selectedFloor={selectedFloor}
          highlightedFloor={highlightedFloor}
          highlightedComponentType={highlightedComponentType}
          modelBounds={modelBounds}
          setModelBounds={setModelBounds}
          setComponentTypes={setComponentTypes}
        />
      </Canvas>
    </div>
  );
};

export default GLBViewer;
