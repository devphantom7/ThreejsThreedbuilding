import React from "react";
import { Link, useLocation } from "react-router-dom";
import { Box, Home, Building, Grid3x3 } from "lucide-react";

const DefaultLayout = ({ children }) => {
  const location = useLocation();

  const navItems = [
    { path: "/", label: "Default", icon: Home },
    { path: "/building1", label: "Building 1", icon: Building },
    { path: "/multi", label: "Multi View", icon: Grid3x3 },
    { path: "/city", label: "city", icon: Building },
    { path: "/house", label: "house", icon: Building },
    { path: "/cyber", label: "Cyber", icon: Building },
    { path: "/docs", label: "Docs", icon: Building },

  ];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen no-scrollbar flex flex-col bg-gray-900">
      {/* Modern Dark Navbar */}
      <nav className="bg-gray-800/90 backdrop-blur-lg border-b border-gray-700/50 shadow-xl sticky top-0 z-50">
        <div className="max-w-9xl mx-auto px-2 lg:px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo/Brand */}
            <div className="flex items-center space-x-3">
              <div className="relative">
                <div className="w-10 h-10 bg-gradient-to-br from-gray-600 via-slate-600 to-gray-700 rounded-xl flex items-center justify-center shadow-lg">
                  <Box className="w-5 h-5 text-gray-200" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-gradient-to-r from-slate-400 to-gray-500 rounded-full animate-pulse"></div>
              </div>
              <div>
                <h2 className="text-2xl font-bold bg-gradient-to-r from-gray-200 via-slate-200 to-gray-300 bg-clip-text text-transparent">
                  3D Viewer
                </h2>
              </div>
            </div>

            {/* Navigation Links */}
            <div className="flex items-center space-x-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.path);

                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`
                      relative group flex items-center space-x-2 px-4 py-2.5 rounded-xl font-medium text-sm transition-all duration-300 transform hover:scale-105
                      ${
                        active
                          ? "bg-gradient-to-r from-gray-600 to-slate-700 text-gray-100 shadow-lg shadow-gray-900/30"
                          : "text-gray-300 hover:text-gray-100 hover:bg-gray-700/60"
                      }
                    `}
                  >
                    <Icon
                      className={`w-4 h-4 transition-transform duration-300 ${
                        active
                          ? "text-gray-100"
                          : "text-gray-400 group-hover:text-slate-300"
                      }`}
                    />
                    <span className="relative z-10">{item.label}</span>

                    {/* Hover effect */}
                    {!active && (
                      <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-gray-600/10 to-slate-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    )}

                    {/* Active indicator */}
                    {active && (
                      <div className="absolute -bottom-1 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-gray-300 rounded-full"></div>
                    )}
                  </Link>
                );
              })}
            </div>

            {/* Right side decoration */}
            {/* <div className="flex items-center space-x-3">
              <div className="hidden sm:flex items-center space-x-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-400 font-medium">LIVE</span>
              </div>
              <div className="w-8 h-8 bg-gradient-to-br from-gray-700 to-gray-800 rounded-lg flex items-center justify-center">
                <div className="w-3 h-3 bg-gradient-to-br from-slate-400 to-gray-500 rounded-full"></div>
              </div>
            </div> */}
          </div>
        </div>

        {/* Subtle bottom border gradient */}
        <div className="h-px bg-gradient-to-r from-transparent via-gray-600/20 to-transparent"></div>
      </nav>

      {/* Page Content */}
      <main className="flex-1 relative">{children}</main>
    </div>
  );
};

export default DefaultLayout;
