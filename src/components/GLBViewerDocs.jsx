import React from "react";

const GLBViewerDoc = () => (
  <div className="w-[100vw] scrollbar-none mx-auto px-4 py-10 text-gray-100 font-sans">
    <h1 className="text-3xl font-extrabold mb-4 text-orange-400 tracking-tight">
      GLBViewer component
    </h1>
    <h2 className="text-lg font-bold mb-2">GLBViewer Component Suite</h2>
    <div className="mb-6 text-gray-400">
      React + Drei + Three.js
      <br />
      3D model viewer with floor detection, component highlighting, and fly-to
      controls
    </div>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">1. High-Level Overview</h2>
      <div>
        GLBViewer is a React component designed to visualize GLB/GLTF 3D
        building models using Three.js via <b>@react-three/fiber</b> and{" "}
        <b>drei</b>.<br />
        <br />
        It allows users to:
        <br />
        <ul className="list-disc ml-6">
          <li>Fly to floors (auto-detected from model naming)</li>
          <li>Highlight floors or component types (e.g., windows/doors)</li>
          <li>Explore the model with smooth orbit/zoom controls</li>
        </ul>
      </div>
    </section>

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">
        2. The 3D Data Model: Three.js Scene Graph Essentials
      </h2>
      <ul className="list-disc ml-6">
        <li>
          Scene: The root of your 3D world. Every object (mesh, light, camera)
          hangs from this.
        </li>
        <li>
          Mesh: Represents visible geometry (e.g., wall, door, window),
          consisting of:
          <ul className="list-disc ml-6">
            <li>Geometry: The shape (vertices, faces)</li>
            <li>Material: How it looks (color, texture, etc.)</li>
          </ul>
        </li>
        <li>
          Node: Any object in the scene graph (including Meshes, Groups,
          Lights).
        </li>
        <li>
          Hierarchy: Each node can have children/parents, so you can traverse
          up/down the model structure (critical for identifying relationships
          like "this window is part of Floor 2").
        </li>
      </ul>
    </section>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">3. Component Architecture</h2>
      <ul className="list-disc ml-6">
        <li>
          GLBViewer: Top-level orchestrator, manages UI state, dropdowns, and
          passes props.
        </li>
        <li>
          SceneWrapper: Handles scene/camera state, animation (fly-to logic),
          lighting, and embeds the loaded model.
        </li>
        <li>
          Model: Loads the GLB model, analyzes the scene graph, detects
          floors/components, sets up highlight logic, and passes structure data
          upward for UI rendering.
        </li>
      </ul>
    </section>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">
        4. How Each Piece Works – Deep Dive
      </h2>

      <h3 className="text-lg font-semibold mt-4 mb-1">
        A. Model Loading & Scene Analysis
      </h3>
      <b>Model component</b>
      <ul className="list-decimal ml-6 mt-1">
        <li>
          Load GLB Model
          <br />
          <pre className="bg-gray-900 rounded p-2 text-green-400 text-sm overflow-x-auto">
            const {"{"} scene {"}"} = useGLTF(url);
          </pre>
          Loads your 3D model file. The returned scene is the root node of your
          building.
        </li>
        <li>
          Traverse the Scene
          <br />
          <pre className="bg-gray-900 rounded p-2 text-green-400 text-sm overflow-x-auto">
            scene.traverse((node) =&gt; {"{"}
            if (node.isMesh) {"{"} ... {"}"}
            {"}"});
          </pre>
          Walks every node in the scene graph, focusing on Mesh objects (actual
          geometry).
          <br />
          Why? Only meshes represent tangible, highlightable objects (walls,
          floors, windows, etc.)
        </li>
        <li>
          Floor Detection
          <br />
          Looks for meshes whose name matches patterns like "floor1", "1st
          floor", "level_2", etc.
          <br />
          Stores these in a floorNodes array and then sorts them by floor number
          or name.
        </li>
        <li>
          Component Type Detection
          <br />
          Defines types: Windows, Doors with their respective regex patterns.
          <br />
          For each mesh, walks up the parent chain to check if the name or
          userData.name matches these patterns (robust to varying model
          hierarchies).
          <br />
          Stores all detected types in a map keyed by type (window, door).
        </li>
        <li>
          Map Components to Floors
          <br />
          For each detected floor, finds all nodes that:
          <ul className="list-disc ml-6">
            <li>Explicitly match the floor in their name (floor1_window1)</li>
            <li>
              Or, if not matched by name, are spatially close in 3D (bounding
              box overlap in Y axis), assuming they belong to the floor.
            </li>
          </ul>
        </li>
        <li>
          Build Floor/Component Structures
          <br />
          Outputs uniqueFloors and componentTypes arrays, each containing:
          <ul className="list-disc ml-6">
            <li>
              Label, value/key, nodes, and other relevant data for the UI.
            </li>
          </ul>
        </li>
        <li>
          Bounding Box Calculation
          <br />
          Uses Three.js Box3 to compute the center and size of the entire model
          (for initial camera fit).
        </li>
      </ul>

      <hr className="my-6 border-gray-700" />

      <h3 className="text-lg font-semibold mt-4 mb-1">B. Highlighting Logic</h3>
      <ul className="list-disc ml-6">
        <li>
          When a floor is highlighted:
          <br />
          All its nodes are assigned a new MeshBasicMaterial (with highlight
          color, e.g., orange).
        </li>
        <li>
          When a component type (windows/doors) is highlighted:
          <br />
          Those meshes are colored with a different highlight material (e.g.,
          blue).
        </li>
        <li>
          If a new highlight is chosen, original materials are restored from
          originalMaterials.current.
        </li>
      </ul>

      <hr className="my-6 border-gray-700" />

      <h3 className="text-lg font-semibold mt-4 mb-1">
        C. Camera Fly-To Animation
      </h3>
      <ul className="list-disc ml-6">
        <li>
          On floor selection, smoothly animates camera position and orbit
          controls' target to the center of the floor, zooming out just enough
          to view the floor.
        </li>
        <li>Uses Three.js vector lerping for silky-smooth transitions.</li>
      </ul>

      <hr className="my-6 border-gray-700" />

      <h3 className="text-lg font-semibold mt-4 mb-1">D. Orbit Controls</h3>
      <ul className="list-disc ml-6">
        <li>
          Implements orbit (mouse rotate), pan, zoom, and damped motion with
          OrbitControls from drei.
        </li>
        <li>
          Camera initially frames the entire model, then dynamically animates to
          selected floor/component as needed.
        </li>
      </ul>

      <hr className="my-6 border-gray-700" />

      <h3 className="text-lg font-semibold mt-4 mb-1">
        E. UI Controls and State
      </h3>
      <ul className="list-disc ml-6">
        <li>UI is decoupled from 3D logic:</li>
        <ul className="list-disc ml-10">
          <li>
            State for floors, selected/highlighted floor, highlighted component
            type, and model bounds are all managed in GLBViewer.
          </li>
          <li>
            Dropdowns for: "Zoom to Floor", "Highlight Floor", "Highlight Type"
            (windows/doors).
          </li>
          <li>
            On selection, relevant state is passed down to re-render
            highlights/camera position.
          </li>
        </ul>
      </ul>
    </section>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">
        5. Data Flow & React State Management
      </h2>
      <pre className="bg-gray-900 rounded p-2 text-orange-300 text-sm overflow-x-auto mb-2">
        {`
graph TD
  A[GLBViewer] -->|modelPath, setters| B(SceneWrapper)
  B -->|modelPath, highlight/floor/type, setComponentTypes| C(Model)
  C -->|setFloors, setComponentTypes, setModelBounds| A
  A -->|selectedFloor, highlightedFloor, highlightedComponentType| B
  B -->|props| C
      `}
      </pre>
      <ul className="list-disc ml-6">
        <li>
          Data out: Floor and component type arrays for populating dropdowns,
          model bounds for initial camera setup.
        </li>
        <li>Data in: Selected floor/type to highlight or fly-to.</li>
      </ul>
    </section>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">
        6. Key Algorithms & Design Decisions
      </h2>
      <ul className="list-disc ml-6">
        <li>
          Scene Graph Traversal: Deep scan using scene.traverse ensures even
          deeply-nested meshes are found.
        </li>
        <li>
          Flexible Detection: Uses name + userData + parent chain with regex,
          making detection robust to varied GLB model naming conventions.
        </li>
        <li>
          Highlighting: Materials are always reset to original before applying
          highlight—prevents color stacking bugs.
        </li>
        <li>
          Spatial Heuristics: When in doubt, nodes are matched to floors via
          bounding box proximity in Y (vertical) axis—smart fallback when naming
          is inconsistent.
        </li>
      </ul>
    </section>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">7. Concepts Explained</h2>
      <ul className="list-disc ml-6">
        <li>
          Three.js Node: Generic 3D object (can be a group, mesh, camera, light,
          etc.).
        </li>
        <li>
          Mesh: A node with geometry and material; the visible part of the
          model.
        </li>
        <li>
          Bounding Box (Box3): 3D volume encapsulating an object—used for
          fitting camera, finding centers, and spatial matching.
        </li>
        <li>
          GLTF/GLB: Standardized 3D model formats that keep geometry, textures,
          and scene graph info.
        </li>
        <li>
          useRef/useState: React hooks for maintaining mutable references (to
          materials, nodes) and component state.
        </li>
        <li>
          Suspense: React’s async data loader boundary—shows nothing until GLB
          is loaded.
        </li>
      </ul>
    </section>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">8. Extension Ideas</h2>
      <ul className="list-disc ml-6">
        <li>
          Add more component types—just extend the MODEL_COMPONENT_TYPES array.
        </li>
        <li>Add more highlight colors/materials.</li>
        <li>Animate highlights (e.g., pulsing effect).</li>
        <li>Implement click-to-select mesh/floor in 3D.</li>
      </ul>
    </section>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">9. Code Organization</h2>
      <ul className="list-disc ml-6">
        <li>
          GLBViewer (root)
          <ul className="list-disc ml-6">
            <li>UI state, dropdowns, passes to...</li>
          </ul>
        </li>
        <li>
          SceneWrapper
          <ul className="list-disc ml-6">
            <li>Camera, controls, lights, embeds...</li>
          </ul>
        </li>
        <li>
          Model
          <ul className="list-disc ml-6">
            <li>
              Loads GLB, analyzes, triggers highlights, passes structure data
              up.
            </li>
          </ul>
        </li>
      </ul>
    </section>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">10. Full Example Usage</h2>
      <pre className="bg-gray-900 rounded p-2 text-blue-300 text-sm overflow-x-auto mb-2">{`<GLBViewer modelPath="/models/my_building.glb" />`}</pre>
      <ul className="list-disc ml-6">
        <li>
          UI appears with three dropdowns: floor fly-to, floor highlight,
          component type highlight (populated dynamically from your model's
          detected floors/windows/doors).
        </li>
      </ul>
    </section>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">11. FAQ & Troubleshooting</h2>
      <ul className="list-disc ml-6">
        <li>
          Why are some types/floors not detected?
          <ul className="list-disc ml-6">
            <li>
              Ensure mesh names or their parent group names contain relevant
              keywords (e.g., window, door, floor2).
            </li>
          </ul>
        </li>
        <li>
          Highlight is not working?
          <ul className="list-disc ml-6">
            <li>
              Check that materials are not being shared across meshes in the
              model; GLB export settings may need tweaking.
            </li>
          </ul>
        </li>
        <li>
          Model loads black?
          <ul className="list-disc ml-6">
            <li>
              Try adding more/different lights, or check for materials/textures
              missing in export.
            </li>
          </ul>
        </li>
      </ul>
    </section>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">12. In-Situ Debugging</h2>
      <ul className="list-disc ml-6">
        <li>
          Mesh name, parent name, and userData are logged for each mesh as it’s
          traversed:
        </li>
      </ul>
      <pre className="bg-gray-900 rounded p-2 text-green-300 text-sm overflow-x-auto mb-2">{`console.log(
  "Mesh:",
  node.name,
  "| Parent:", node.parent?.name,
  "| userData:", node.userData?.name
);`}</pre>
      <ul className="list-disc ml-6">
        <li>
          This helps you tune your detection logic and debug model issues
          quickly.
        </li>
      </ul>
    </section>

    <hr className="my-6 border-gray-700" />

    <section className="mb-8">
      <h2 className="text-2xl font-bold mb-2">13. Additionals</h2>
      <ul className="list-disc ml-6">
        <li>Detection is robust to messy real-world models.</li>
        <li>
          Code is modular—easily extended for more types or custom highlighting.
        </li>
        <li>
          UI is minimal but can be styled further with Material Tailwind or your
          library of choice.
        </li>
        <li>Designed for production-grade, scalable 3D building management.</li>
      </ul>
    </section>
  </div>
);

export default GLBViewerDoc;
