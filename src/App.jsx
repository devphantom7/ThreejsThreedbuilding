import React from "react";
import GLBViewer from "./components/GLBViewer";
// import ABCViewer from "./components/ABCViewe";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import DefaultLayout from "./components/DefaultLayout";
import GLBViewerDocs from "./components/GLBViewerDocs";

function App() {
  return (
    <Router>
      <DefaultLayout>
        <Routes>
          <Route
            path="/building1"
            element={
              <GLBViewer modelPath="/models/Residential Buildings 007.glb" />
            }
          />
          <Route
            path="/"
            element={<GLBViewer modelPath="/models/tallbldg.glb" />}
          />
          <Route
            path="/astronaut"
            element={<GLBViewer modelPath="/models/Astronaut.glb" />}
          />
          <Route
            path="/multi"
            element={
              <GLBViewer modelPath="/models/02 Residential Buildings Set BI Version.glb" />
            }
          />
          <Route
            path="/city"
            element={
              <GLBViewer modelPath="/models/uploads_files_2720101_BusGameMap.glb" />
            }
          />
           <Route
            path="/house"
            element={
              <GLBViewer modelPath="/models/building_04.glb" />
            }
          /> 
          <Route
            path="/cyber"
            element={
              <GLBViewer modelPath="/models/CYBER.glb" />
            }
          />
          <Route
            path="/docs"
            element={
              <GLBViewerDocs />
            }
          />
          {/* Catch-all route */}
          {/* <Route path="*" element={<NotFound />} /> */}
        </Routes>
      </DefaultLayout>
    </Router>
  );
}

export default App;
