import React, { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "react-query";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import { PlusCircle, Edit2, Trash2 } from "lucide-react";
import toast from "react-hot-toast";

interface Project {
  id: string;
  name: string;
  description: string;
  startDate: string;
  deadline: string;
  teamId: string;
  created_by: string;
  created_at: any;
}

function Projects() {
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [sortBy, setSortBy] = useState<"deadline" | "status">("deadline");
  const [searchQuery, setSearchQuery] = useState("");
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    startDate: "",
    deadline: "",
    teamId: "",
  });
  const queryClient = useQueryClient();
  const { user } = useAuthStore();

  const { data: projects = [] } = useQuery("projects", async () => {
    const q = query(collection(db, "projects"));
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  });

  const { data: teams = [] } = useQuery("teams", async () => {
    const snap = await getDocs(collection(db, "teams"));
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  });

  const { data: employees = [] } = useQuery("employees", async () => {
    const snap = await getDocs(collection(db, "employees"));
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  });

  const getEmployeeName = (id: string) =>
    employees.find((e: any) => e.id === id)?.name || id;

  const getEmployeeNameById = (uid: string) =>
    employees.find((e: any) => e.id === uid)?.name || "Unknown";

  const createProject = useMutation(
    async (data: typeof formData) => {
      await addDoc(collection(db, "projects"), {
        ...data,
        created_by: user?.uid,
        created_at: serverTimestamp(),
      });
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries("projects");
        toast.success("Project created");
        setShowModal(false);
      },
    }
  );

  const updateProject = useMutation(
    async ({ id, data }: { id: string; data: Partial<Project> }) => {
      await updateDoc(doc(db, "projects", id), data);
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries("projects");
        toast.success("Project updated");
        setShowModal(false);
      },
    }
  );

  const deleteProject = useMutation(
    async (id: string) => {
      await deleteDoc(doc(db, "projects", id));
    },
    {
      onSuccess: () => {
        queryClient.invalidateQueries("projects");
        toast.success("Project deleted");
      },
    }
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingProject) {
      updateProject.mutate({ id: editingProject.id, data: formData });
    } else {
      createProject.mutate(formData);
    }
  };

  const sortedProjects = [...projects]
    .filter((p: any) => {
      const team = teams.find((t) => t.id === p.teamId);
      const isCreator = p.created_by === user?.uid;
      const isMember = team?.members?.includes(user?.uid);
      return (
        (isCreator || isMember) &&
        p.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    })
    .sort((a: any, b: any) => {
      if (sortBy === "deadline") {
        return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
      }
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between mb-6 gap-4">
        <div className="w-full md:w-1/2">
          <h1 className="text-2xl font-bold text-gray-800">Projects</h1>
          <input
            type="text"
            placeholder="Search Projects..."
            className="mt-2 border border-gray-300 px-4 py-2 rounded w-full shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-4 items-end">
          <select
            className="border border-gray-300 px-3 py-2 rounded shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "deadline" | "status")}
          >
            <option value="deadline">Sort by Deadline</option>
            <option value="status">Sort by Name</option>
          </select>
          <button
            className="flex items-center bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 transition duration-200 shadow"
            onClick={() => {
              setEditingProject(null);
              setFormData({
                name: "",
                description: "",
                startDate: "",
                deadline: "",
                teamId: "",
              });
              setShowModal(true);
            }}
          >
            <PlusCircle className="mr-2 w-5 h-5" /> New Project
          </button>
        </div>
      </div>

      <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
        {sortedProjects.map((project: any) => {
          const team = teams.find((t) => t.id === project.teamId);
          const isCreator = project.created_by === user?.uid;
          const isMember = team?.members?.includes(user?.uid);
          const roleLabel = isCreator
            ? "You created this project"
            : isMember
            ? "You are a member"
            : "";

          return (
            <div
              key={project.id}
              className={`p-5 rounded-2xl border-2 shadow-sm transition duration-300 hover:shadow-lg flex flex-col justify-between ${
                isCreator
                  ? "bg-white border-blue-300"
                  : "bg-blue-50 border-blue-400"
              }`}
            >
              <div>
                <div className="flex justify-between items-center mb-2">
                  <h2 className="font-semibold text-xl text-gray-800">
                    {project.name}
                  </h2>
                  {roleLabel && (
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-medium ${
                        isCreator
                          ? "bg-blue-100 text-blue-800"
                          : "bg-blue-200 text-blue-900"
                      }`}
                    >
                      {roleLabel}
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-2">
                  {project.description}
                </p>
                <p className="text-sm text-gray-500 mb-1">
                  <strong>Team:</strong> {team?.teamName || "N/A"}
                </p>
                {team?.members && (
                  <ul className="text-xs text-gray-500 list-disc ml-4 mt-1 max-h-24 overflow-auto">
                    {team.members.map((member: string, idx: number) => (
                      <li key={idx}>{getEmployeeName(member)}</li>
                    ))}
                  </ul>
                )}
                <p className="text-sm text-gray-500 mt-2">
                  <strong>Start:</strong> {project.startDate}
                </p>
                <p className="text-sm text-gray-500">
                  <strong>Deadline:</strong> {project.deadline}
                </p>
                <p className="text-xs text-gray-400 mt-1 italic">
                  Created by: {getEmployeeNameById(project.created_by)}
                </p>
              </div>

              {project.created_by === user?.uid && (
                <div className="mt-4 flex justify-end space-x-3">
                  <button
                    onClick={() => {
                      setEditingProject(project);
                      setFormData({
                        name: project.name,
                        description: project.description,
                        startDate: project.startDate,
                        deadline: project.deadline,
                        teamId: project.teamId,
                      });
                      setShowModal(true);
                    }}
                    className="text-blue-600 hover:text-blue-800 transition"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteProject.mutate(project.id)}
                    className="text-red-600 hover:text-red-800 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
          <div className="bg-white p-6 rounded-lg shadow-xl w-full max-w-md animate-fade-in">
            <h2 className="text-lg font-semibold mb-4">
              {editingProject ? "Edit Project" : "Create Project"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium">
                  Project Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) =>
                    setFormData({ ...formData, startDate: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Deadline</label>
                <input
                  type="date"
                  value={formData.deadline}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium">
                  Assign to Team
                </label>
                <select
                  value={formData.teamId}
                  onChange={(e) =>
                    setFormData({ ...formData, teamId: e.target.value })
                  }
                  className="w-full mt-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-400"
                  required
                >
                  <option value="">Select team</option>
                  {teams.map((team: any) => (
                    <option key={team.id} value={team.id}>
                      {team.teamName}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded hover:bg-gray-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  {editingProject ? "Update" : "Create"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Projects;
