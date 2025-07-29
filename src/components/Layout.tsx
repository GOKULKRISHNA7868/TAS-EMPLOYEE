import React, { useEffect, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../store/authStore";
import {
  LayoutDashboard,
  Users,
  Calendar,
  Briefcase,
  CheckSquare,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../lib/firebase";

function Layout() {
  const { signOut, user } = useAuthStore(); // user should include `uid`
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isTeamLeader, setIsTeamLeader] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const isActive = (path: string) => location.pathname === path;

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => setIsSidebarOpen(false);

  useEffect(() => {
    const checkTeamLeader = async () => {
      if (!user?.uid) return setIsLoading(false);

      try {
        const docRef = doc(db, "teamLeaders", user.uid);
        const docSnap = await getDoc(docRef);
        setIsTeamLeader(docSnap.exists());
      } catch (err) {
        console.error("Failed to check teamLeader role:", err);
      } finally {
        setIsLoading(false);
      }
    };
    checkTeamLeader();
  }, [user?.uid]);

  const navLinks = [
    { path: "/", icon: LayoutDashboard, label: "Dashboard" },
    isTeamLeader && { path: "/TeamManager", icon: Users, label: "Manage Team" },
    isTeamLeader && {
      path: "/TeamMatrix",
      icon: Users,
      label: "Team Performance",
    },
    { path: "/projects", icon: Briefcase, label: "Projects" },
    isTeamLeader && {
      path: "/tasks",
      icon: CheckSquare,
      label: "Create Tasks",
    },
    isTeamLeader && {
      path: "/ViewTasks",
      icon: CheckSquare,
      label: "All Tasks",
    },
    { path: "Performance", icon: CheckSquare, label: "Performance" },
    { path: "/mytasks", icon: CheckSquare, label: "My Tasks" },
    {
      path: "/RaiseProjectTicket",
      icon: Briefcase,
      label: "View Project Tickets",
    },
    { path: "/ProjectDocCreator", icon: Briefcase, label: "Document Creator" },
    //{ path: "/calendar", icon: Calendar, label: "Calendar" },
    { path: "/settings", icon: Settings, label: "Settings" },
  ].filter(Boolean);

  return (
    <div className="min-h-screen flex bg-gray-100 dark:bg-gray-900">
      {/* Mobile Sidebar Toggle */}
      <button
        onClick={toggleSidebar}
        className="md:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-white dark:bg-gray-800 shadow-md"
      >
        {isSidebarOpen ? (
          <X className="h-6 w-6 text-gray-800 dark:text-white" />
        ) : (
          <Menu className="h-6 w-6 text-gray-800 dark:text-white" />
        )}
      </button>

      {/* Sidebar */}
      <aside
        className={`${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
        } md:translate-x-0 fixed md:static inset-y-0 left-0 z-40 w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 shadow-md transition-transform duration-300 ease-in-out`}
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400">
            StartupPM
          </h1>
        </div>

        {!isLoading && (
          <nav className="p-4 space-y-2">
            {navLinks.map(({ path, icon: Icon, label }) => (
              <Link
                key={path}
                to={path}
                onClick={closeSidebar}
                className={`flex items-center px-4 py-2 rounded-lg font-medium transition-all group ${
                  isActive(path)
                    ? "bg-blue-100 text-blue-700 dark:bg-blue-800 dark:text-white"
                    : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <Icon className="h-5 w-5 mr-3 group-hover:scale-110 transition-transform" />
                {label}
              </Link>
            ))}
          </nav>
        )}
      </aside>

      {/* Overlay for mobile */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-30 md:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Main content area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Navbar */}
        <header className="h-16 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 flex items-center justify-between shadow-sm">
          <div className="text-lg font-semibold text-gray-800 dark:text-white">
            {location.pathname === "/"
              ? "Dashboard"
              : location.pathname.replace("/", "").replace(/([A-Z])/g, " $1")}
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <img
                src={`https://api.dicebear.com/7.x/initials/svg?seed=${user?.email}`}
                alt="User Avatar"
                className="h-9 w-9 rounded-full border border-blue-300 shadow"
              />
              <div className="text-sm text-gray-800 dark:text-gray-200">
                {user?.email}
              </div>
            </div>
            <button
              onClick={signOut}
              className="flex items-center px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white text-sm font-medium rounded-lg transition"
            >
              <LogOut className="h-4 w-4 mr-1" />
              Sign out
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 bg-gray-50 dark:bg-gray-900">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

export default Layout;
