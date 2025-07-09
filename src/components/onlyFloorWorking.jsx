// src/components/GLBViewer.jsx
import React, { Suspense, useEffect, useRef, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

// Load and parse model
const Model = ({ url, onFloorsDetected, onModelBounds, highlightedFloor }) => {
  const { scene } = useGLTF(url);
  const originalMaterials = useRef(new Map());

  useEffect(() => {
    const floorNodes = [];

    scene.traverse((node) => {
      if (node.name.toLowerCase().includes("floor") && node.isMesh) {
        floorNodes.push(node);
        
        // Store original material for restoration
        if (!originalMaterials.current.has(node.uuid)) {
          originalMaterials.current.set(node.uuid, node.material);
        }
      }
    });

    // Sort floors by name to ensure consistent ordering
    floorNodes.sort((a, b) => a.name.localeCompare(b.name));

    // Create a map to handle duplicate names and group related floor parts
    const floorMap = new Map();
    floorNodes.forEach((node) => {
      // Try to extract floor number from various naming patterns
      const floorMatch = node.name.match(/floor[\s_-]*(\d+)/i) || 
                        node.name.match(/(\d+)(?:st|nd|rd|th)?[\s_-]*floor/i) ||
                        node.name.match(/level[\s_-]*(\d+)/i) ||
                        node.name.match(/(\d+)$/);
      
      let key;
      if (floorMatch) {
        key = `floor_${floorMatch[1]}`;
      } else {
        // If no number found, use the full name as key
        key = node.name.toLowerCase();
      }

      if (!floorMap.has(key)) {
        floorMap.set(key, {
          nodes: [node],
          name: node.name,
          floorNumber: floorMatch ? parseInt(floorMatch[1]) : null
        });
      } else {
        // Add to existing floor group (for floors with multiple parts)
        floorMap.get(key).nodes.push(node);
      }
    });

    // Convert to array and sort by floor number
    const floorEntries = Array.from(floorMap.entries()).sort((a, b) => {
      const aNum = a[1].floorNumber;
      const bNum = b[1].floorNumber;
      if (aNum !== null && bNum !== null) {
        return aNum - bNum;
      }
      return a[1].name.localeCompare(b[1].name);
    });

    const uniqueFloors = floorEntries.map(([key, floorData], index) => ({
      label: floorData.floorNumber ? `floor ${floorData.floorNumber}` : `floor ${index + 1}`,
      value: key,
      node: floorData.nodes[0], // Use the first node for positioning
      nodes: floorData.nodes, // Keep all nodes for potential highlighting
      originalName: floorData.name
    }));

    onFloorsDetected(uniqueFloors);

    // Debug: Log detected floors
    console.log("Detected floors:", uniqueFloors.map(f => ({
      label: f.label,
      value: f.value,
      originalName: f.originalName,
      nodeCount: f.nodes.length
    })));

    // Get overall model bounds
    const boundingBox = new THREE.Box3().setFromObject(scene);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    boundingBox.getCenter(center);
    boundingBox.getSize(size);

    onModelBounds({ center, size });
  }, [scene, onFloorsDetected, onModelBounds]);

  // Handle floor highlighting
  useEffect(() => {
    // Reset all materials to original
    scene.traverse((node) => {
      if (node.name.toLowerCase().includes("floor") && node.isMesh) {
        const originalMaterial = originalMaterials.current.get(node.uuid);
        if (originalMaterial) {
          node.material = originalMaterial;
        }
      }
    });

    // Apply highlight to selected floor
    if (highlightedFloor?.nodes) {
      const highlightMaterial = new THREE.MeshBasicMaterial({
        color: 0xff6b35, // Orange highlight color
        transparent: true,
        opacity: 0.8
      });

      highlightedFloor.nodes.forEach(node => {
        if (node.isMesh) {
          node.material = highlightMaterial;
        }
      });
    }
  }, [scene, highlightedFloor]);

  return <primitive object={scene} />;
};

// Controls scene + camera
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

  // Initial positioning (only once when model loads)
  useEffect(() => {
    if (modelBounds && !hasInitialized) {
      const { center, size } = modelBounds;

      // Set initial camera position
      camera.position.set(center.x, center.y + size.y / 2, center.z + size.z * 2);
      
      // Set target for OrbitControls
      if (controlsRef.current) {
        controlsRef.current.target.set(center.x, center.y, center.z);
        controlsRef.current.update();
      }
      
      setHasInitialized(true);
    }
  }, [modelBounds, hasInitialized, camera]);

  // Animate to selected floor (smooth transition)
  useEffect(() => {
    if (selectedFloor?.node && controlsRef.current && hasInitialized) {
      // Calculate bounding box for all nodes of the selected floor
      const box = new THREE.Box3();
      
      if (selectedFloor.nodes && selectedFloor.nodes.length > 1) {
        // If multiple nodes, calculate combined bounding box
        selectedFloor.nodes.forEach(node => {
          const nodeBox = new THREE.Box3().setFromObject(node);
          box.union(nodeBox);
        });
      } else {
        // Single node
        box.setFromObject(selectedFloor.node);
      }
      
      const center = new THREE.Vector3();
      const size = new THREE.Vector3();
      box.getCenter(center);
      box.getSize(size);

      // Calculate optimal camera position for the floor
      const distance = Math.max(size.x, size.y, size.z) * 1.5;
      const targetPosition = new THREE.Vector3(
        center.x + distance * 0.7,
        center.y + distance * 0.7,
        center.z + distance * 0.7
      );

      // Debug: Log floor selection info
      console.log("Selected floor:", {
        label: selectedFloor.label,
        center: center.toArray(),
        size: size.toArray(),
        nodeCount: selectedFloor.nodes?.length || 1
      });

      // Smoothly animate to the new position
      const startPosition = camera.position.clone();
      const startTarget = controlsRef.current.target.clone();
      
      let progress = 0;
      const animationSpeed = 0.02;
      
      const animate = () => {
        progress += animationSpeed;
        
        if (progress >= 1) {
          // Animation complete
          camera.position.copy(targetPosition);
          controlsRef.current.target.copy(center);
          controlsRef.current.update();
          return;
        }
        
        // Interpolate position and target
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

// Main Viewer
const GLBViewer = ({ modelPath }) => {
  const [floors, setFloors] = useState([]);
  const [selectedFloor, setSelectedFloor] = useState(null);
  const [highlightedFloor, setHighlightedFloor] = useState(null);
  const [modelBounds, setModelBounds] = useState(null);

  return (
    <div style={{ height: "100vh", width: "100vw", position: "relative" }}>
      {/* UI Dropdowns */}
      <div style={{ position: "absolute", top: 20, left: 20, zIndex: 10 }}>
        <div style={{ marginBottom: "10px" }}>
          <label style={{ display: "block", marginBottom: "5px", color: "black", fontSize: "14px" }}>
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
          <label style={{ display: "block", marginBottom: "5px", color: "black", fontSize: "14px" }}>
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

      {/* Canvas */}
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