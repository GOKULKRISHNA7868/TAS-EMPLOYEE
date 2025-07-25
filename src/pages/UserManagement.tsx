import React, { useEffect, useState } from "react";
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../lib/firebase";

export default function ProjectTasksViewer() {
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [tasks, setTasks] = useState([]);
  const [employeesMap, setEmployeesMap] = useState({});
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    const fetchProjects = async () => {
      const snap = await getDocs(collection(db, "projects"));
      const projectData = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setProjects(projectData);
    };
    fetchProjects();
  }, []);

  useEffect(() => {
    const fetchEmployees = async () => {
      const snap = await getDocs(collection(db, "employees"));
      const empMap = {};
      snap.docs.forEach((doc) => {
        const { name } = doc.data();
        empMap[doc.id] = name;
      });
      setEmployeesMap(empMap);
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!selectedProjectId) return;
    const fetchTasks = async () => {
      const q = query(
        collection(db, "tasks"),
        where("project_id", "==", selectedProjectId)
      );
      const snap = await getDocs(q);
      const taskList = snap.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      setTasks(taskList);
    };
    fetchTasks();
  }, [selectedProjectId]);

  const getStatusColor = (status, dueDate) => {
    if (status === "completed") return "text-green-600 font-semibold";
    const due = new Date(dueDate);
    const now = new Date();
    if (due < now) return "text-red-600 font-semibold";
    return "text-gray-800";
  };

  const calculatePerformance = (createdAt, dueDate, updatedAt) => {
    if (!updatedAt || !createdAt || !dueDate) return "-";
    const start = new Date(createdAt.seconds * 1000);
    const end = new Date(dueDate);
    const done = new Date(updatedAt.seconds * 1000);
    const totalTime = end.getTime() - start.getTime();
    const usedTime = done.getTime() - start.getTime();
    if (totalTime <= 0 || usedTime <= 0) return "0%";
    const percent = ((1 - usedTime / totalTime) * 100).toFixed(1);
    return `${percent}%`;
  };

  const filteredTasks =
    statusFilter === "all"
      ? tasks
      : tasks.filter((task) => task.status === statusFilter);

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold mb-4">Select Project</h2>
      <div className="flex flex-wrap gap-3">
        {projects.map((project) => (
          <button
            key={project.id}
            onClick={() => setSelectedProjectId(project.id)}
            className={`px-4 py-2 rounded shadow transition duration-300 ease-in-out ${
              selectedProjectId === project.id
                ? "bg-blue-600 text-white scale-105"
                : "bg-gray-200 text-black hover:bg-gray-300"
            }`}
          >
            {project.name}
          </button>
        ))}
      </div>

      {selectedProjectId && (
        <>
          <div className="mt-6 flex justify-between items-center">
            <h3 className="text-xl font-semibold">
              Tasks for:{" "}
              {projects.find((proj) => proj.id === selectedProjectId)?.name}
            </h3>
            <select
              className="border px-3 py-2 rounded bg-white text-sm"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="all">All</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div className="overflow-x-auto mt-4 rounded-md border">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50 text-[13px]">
                <tr>
                  {[
                    "#",
                    "Title",
                    "Description",
                    "Status",
                    "Assigned To",
                    "Created By",
                    "Created At",
                    "Due Date",
                    "Progress",
                    "Description",
                    "Link",
                    "Updated At",
                    "Performance %",
                  ].map((heading) => (
                    <th
                      key={heading}
                      className="p-3 text-left font-medium text-gray-700 border"
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredTasks.map((task, idx) => (
                  <tr
                    key={task.id}
                    className="hover:bg-gray-50 transition-all duration-200"
                  >
                    <td className="p-2 border">{idx + 1}</td>
                    <td className="p-2 border">{task.title}</td>
                    <td className="p-2 border">{task.description}</td>
                    <td className="p-2 border">
                      <span
                        className={`inline-block px-2 py-1 rounded text-xs font-semibold ${
                          task.status === "completed"
                            ? "bg-green-100 text-green-700"
                            : "bg-yellow-100 text-yellow-700"
                        }`}
                      >
                        {task.status}
                        {task.status === "completed" && (
                          <span className="ml-1 text-green-600">✔</span>
                        )}
                      </span>
                    </td>
                    <td className="p-2 border">
                      {employeesMap[task.assigned_to] || task.assigned_to}
                    </td>
                    <td className="p-2 border">
                      {employeesMap[task.created_by] || task.created_by}
                    </td>
                    <td className="p-2 border">
                      {task.created_at
                        ? new Date(
                            task.created_at.seconds * 1000
                          ).toLocaleString()
                        : "-"}
                    </td>
                    <td className="p-2 border">{task.due_date}</td>
                    <td className="p-2 border min-w-[140px]">
                      <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 ${
                            task.progress_status === "completed"
                              ? "bg-green-500"
                              : "bg-yellow-400"
                          }`}
                          style={{
                            width:
                              task.progress_status === "completed"
                                ? "100%"
                                : task.progress_status === "in progress"
                                ? "50%"
                                : "10%",
                          }}
                        ></div>
                      </div>
                      <div className="text-xs mt-1 text-gray-600">
                        {task.progress_status}
                      </div>
                    </td>
                    <td className="p-2 border">
                      {task.progress_description || "-"}
                    </td>
                    <td className="p-2 border">
                      {task.progress_link ? (
                        <a
                          href={task.progress_link}
                          className="text-blue-600 underline"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          View
                        </a>
                      ) : (
                        "-"
                      )}
                    </td>
                    <td className="p-2 border">
                      {task.progress_updated_at
                        ? new Date(
                            task.progress_updated_at.seconds * 1000
                          ).toLocaleString()
                        : "-"}
                    </td>
                    <td className="p-2 border">
                      {task.status === "completed"
                        ? calculatePerformance(
                            task.created_at,
                            task.due_date,
                            task.progress_updated_at
                          )
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
