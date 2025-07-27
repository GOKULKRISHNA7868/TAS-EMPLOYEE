import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "react-query";
import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";

function Projects() {
  const [taskForms, setTaskForms] = useState({});
  const [selectedTeamMembers, setSelectedTeamMembers] = useState({});
  const [projectTasks, setProjectTasks] = useState({});
  const [expandedProject, setExpandedProject] = useState(null);
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editedTask, setEditedTask] = useState({});

  const { user } = useAuthStore();

  const { data: teams = [] } = useQuery(["teams", user?.uid], async () => {
    if (!user?.uid) return [];
    const q = query(
      collection(db, "teams"),
      where("created_by", "==", user.uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  });

  const { data: projects = [] } = useQuery(
    ["projects", user?.uid],
    async () => {
      if (!user?.uid) return [];
      const q = query(
        collection(db, "projects"),
        where("created_by", "==", user.uid)
      );
      const snap = await getDocs(q);
      return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    }
  );

  const { data: employees = [] } = useQuery("employees", async () => {
    const snap = await getDocs(collection(db, "employees"));
    return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  });

  const getEmployeeName = (id) =>
    employees.find((e) => e.id === id)?.name || id;

  const createTask = useMutation(
    async (taskData) => {
      await addDoc(collection(db, "tasks"), taskData);
    },
    {
      onSuccess: () => toast.success("Task(s) assigned successfully"),
      onError: () => toast.error("Failed to assign task"),
    }
  );

  const updateStatus = useMutation(
    async ({ id, status }) => {
      await updateDoc(doc(db, "tasks", id), { status });
    },
    {
      onSuccess: () => toast.success("Task updated"),
      onError: () => toast.error("Failed to update task"),
    }
  );

  const getProjectTasks = async (projectId) => {
    const q = query(
      collection(db, "tasks"),
      where("project_id", "==", projectId)
    );
    const snap = await getDocs(q);
    setProjectTasks((prev) => ({
      ...prev,
      [projectId]: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
    }));
  };

  useEffect(() => {
    projects.forEach((project) => {
      getProjectTasks(project.id);
    });
  }, [projects]);

  const getTaskForm = (projectId) => {
    return (
      taskForms[projectId] || {
        title: "",
        description: "",
        dueDate: "",
        assignToAll: false,
        assignToMember: "",
      }
    );
  };

  const updateTaskForm = (projectId, field, value) => {
    setTaskForms((prev) => ({
      ...prev,
      [projectId]: {
        ...getTaskForm(projectId),
        [field]: value,
      },
    }));
  };

  const handleAssignTask = async (projectId, teamId) => {
    const form = getTaskForm(projectId);
    if (!form.title || !form.dueDate)
      return toast.error("Title and Due Date required");

    let members = selectedTeamMembers[teamId];
    if (!members) {
      const teamDoc = await getDoc(doc(db, "teams", teamId));
      const data = teamDoc.data();
      members = data?.members || [];
      setSelectedTeamMembers((prev) => ({ ...prev, [teamId]: members }));
    }

    const project = projects.find((p) => p.id === projectId);
    const projectPrefix = project?.name
      .split(" ")
      .map((w) => w[0])
      .join("")
      .toUpperCase(); // e.g., "Exam Portal" -> "EP"

    const existingTasks = projectTasks[projectId] || [];
    let taskCount = existingTasks.length;

    const createTaskWithID = (assignedTo) => {
      taskCount += 1;
      const taskId = `Task-${projectPrefix}${taskCount}`;

      const task = {
        title: form.title,
        task_id: taskId, // ✅ store generated task ID separately
        description: form.description,
        due_date: form.dueDate,
        project_id: projectId,
        created_by: user?.uid,
        created_at: serverTimestamp(),
        status: "pending",
        progress_status: "pending",
        progress_description: "",
        progress_link: "",
        progress_updated_at: null,
        assigned_to: assignedTo,
      };

      createTask.mutate(task);
    };

    if (form.assignToAll) {
      members.forEach((memberId) => {
        createTaskWithID(memberId);
      });
    } else if (form.assignToMember) {
      createTaskWithID(form.assignToMember);
    } else {
      toast.error("Select member or choose assign to all");
    }

    setTaskForms((prev) => ({
      ...prev,
      [projectId]: {
        title: "",
        description: "",
        dueDate: "",
        assignToAll: false,
        assignToMember: "",
      },
    }));

    getProjectTasks(projectId);
  };

  const handleEditClick = (task) => {
    setEditingTaskId(task.id);
    setEditedTask({
      title: task.title,
      due_date: task.due_date,
      description: task.description,
    });
  };

  const handleEditSave = async (taskId, projectId) => {
    try {
      await updateDoc(doc(db, "tasks", taskId), editedTask);
      toast.success("Task updated");
      setEditingTaskId(null);
      getProjectTasks(projectId);
    } catch {
      toast.error("Update failed");
    }
  };

  const handleDelete = async (taskId, projectId) => {
    try {
      await deleteDoc(doc(db, "tasks", taskId));
      toast.success("Task deleted");
      getProjectTasks(projectId);
    } catch {
      toast.error("Delete failed");
    }
  };

  return (
    // Only the return JSX is updated — all state, hooks, logic remain unchanged.

    <div className="p-4 space-y-8">
      {teams.map((team) => {
        const teamProjects = projects.filter((p) => p.teamId === team.id);

        return (
          <div
            key={team.id}
            className="border rounded-xl p-6 bg-white shadow-md"
          >
            <h2 className="text-2xl font-semibold text-gray-800 mb-1">
              Team: {team.teamName}
            </h2>
            <p className="text-sm text-gray-500 mb-4">
              Members: {team.members.map(getEmployeeName).join(", ")}
            </p>

            {teamProjects.map((project) => {
              const form = getTaskForm(project.id);
              const tasks = projectTasks[project.id] || [];

              return (
                <div key={project.id} className="border-t pt-4 mt-6">
                  <h3
                    className="text-lg font-semibold text-blue-700 cursor-pointer hover:underline mb-1"
                    onClick={() =>
                      setExpandedProject((p) =>
                        p === project.id ? null : project.id
                      )
                    }
                  >
                    📁 {project.name}
                  </h3>
                  <p className="text-sm text-gray-600 mb-3">
                    {project.description}
                  </p>

                  {expandedProject === project.id && (
                    <>
                      {/* Task Form */}
                      <div className="grid md:grid-cols-2 gap-4 mb-4">
                        <input
                          placeholder="Task Title"
                          value={form.title}
                          onChange={(e) =>
                            updateTaskForm(project.id, "title", e.target.value)
                          }
                          className="border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <input
                          type="date"
                          value={form.dueDate}
                          onChange={(e) =>
                            updateTaskForm(
                              project.id,
                              "dueDate",
                              e.target.value
                            )
                          }
                          className="border p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <textarea
                          placeholder="Task Description"
                          value={form.description}
                          onChange={(e) =>
                            updateTaskForm(
                              project.id,
                              "description",
                              e.target.value
                            )
                          }
                          className="border p-2 rounded-lg col-span-full focus:outline-none focus:ring-2 focus:ring-blue-400"
                        />
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={form.assignToAll}
                            onChange={() =>
                              updateTaskForm(
                                project.id,
                                "assignToAll",
                                !form.assignToAll
                              )
                            }
                          />
                          <label className="text-sm">Assign to all</label>
                        </div>
                        {!form.assignToAll && (
                          <select
                            value={form.assignToMember}
                            onChange={(e) =>
                              updateTaskForm(
                                project.id,
                                "assignToMember",
                                e.target.value
                              )
                            }
                            className="border p-2 rounded-lg"
                          >
                            <option value="">Select Member</option>
                            {team.members.map((id) => (
                              <option key={id} value={id}>
                                {getEmployeeName(id)}
                              </option>
                            ))}
                          </select>
                        )}
                        <button
                          onClick={() => handleAssignTask(project.id, team.id)}
                          className="col-span-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                        >
                          ➕ Assign Task
                        </button>
                      </div>

                      {/* Task Table */}
                      {tasks.length > 0 && (
                        <div className="overflow-x-auto mt-6">
                          <table className="w-full border text-sm text-left rounded-lg overflow-hidden shadow-sm">
                            <thead className="bg-gray-100 text-gray-700 uppercase">
                              <tr>
                                <th className="p-3 border">Task ID</th>
                                <th className="p-3 border">Title</th>
                                <th className="p-3 border">Assigned To</th>
                                <th className="p-3 border">Due Date</th>
                                <th className="p-3 border">Status</th>
                                <th className="p-3 border">Progress</th>
                                <th className="p-3 border text-center">
                                  Actions
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {tasks.map((task, idx) => {
                                const isOverdue =
                                  new Date(task.due_date) < new Date();
                                const isEditing = editingTaskId === task.id;
                                const rowBg =
                                  idx % 2 === 0 ? "bg-white" : "bg-gray-50";

                                return (
                                  <tr key={task.id} className={rowBg}>
                                    <td className="p-2 border">
                                      {task.task_id}
                                    </td>
                                    <td className="p-2 border">
                                      {isEditing ? (
                                        <input
                                          className="border p-1 rounded w-full"
                                          value={editedTask.title}
                                          onChange={(e) =>
                                            setEditedTask((prev) => ({
                                              ...prev,
                                              title: e.target.value,
                                            }))
                                          }
                                        />
                                      ) : (
                                        task.title
                                      )}
                                    </td>
                                    <td className="p-2 border">
                                      {getEmployeeName(task.assigned_to)}
                                    </td>
                                    <td
                                      className={`p-2 border ${
                                        isOverdue
                                          ? "text-red-600 font-semibold"
                                          : ""
                                      }`}
                                    >
                                      {isEditing ? (
                                        <input
                                          type="date"
                                          className="border p-1 rounded"
                                          value={editedTask.due_date}
                                          onChange={(e) =>
                                            setEditedTask((prev) => ({
                                              ...prev,
                                              due_date: e.target.value,
                                            }))
                                          }
                                        />
                                      ) : (
                                        task.due_date
                                      )}
                                    </td>
                                    <td className="p-2 border">
                                      <select
                                        value={task.status}
                                        onChange={(e) =>
                                          updateStatus.mutate({
                                            id: task.id,
                                            status: e.target.value,
                                          })
                                        }
                                        className="border rounded px-2 py-1"
                                      >
                                        <option value="pending">Pending</option>
                                        <option value="in_progress">
                                          In Progress
                                        </option>
                                        <option value="completed">
                                          Completed
                                        </option>
                                      </select>
                                    </td>
                                    <td className="p-2 border text-gray-600 text-xs">
                                      {task.progress_status || (
                                        <span className="italic text-gray-400">
                                          Not submitted
                                        </span>
                                      )}
                                    </td>
                                    <td className="p-2 border">
                                      <div className="flex items-center justify-center gap-2">
                                        {isEditing ? (
                                          <>
                                            <button
                                              onClick={() =>
                                                handleEditSave(
                                                  task.id,
                                                  project.id
                                                )
                                              }
                                              className="text-green-600 hover:underline text-sm"
                                            >
                                              Save
                                            </button>
                                            <button
                                              onClick={() =>
                                                setEditingTaskId(null)
                                              }
                                              className="text-gray-500 hover:underline text-sm"
                                            >
                                              Cancel
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <Pencil
                                              onClick={() =>
                                                handleEditClick(task)
                                              }
                                              className="text-blue-600 cursor-pointer hover:text-blue-800"
                                              size={18}
                                            />
                                            <Trash2
                                              onClick={() =>
                                                handleDelete(
                                                  task.id,
                                                  project.id
                                                )
                                              }
                                              className="text-red-600 cursor-pointer hover:text-red-800"
                                              size={18}
                                            />
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
export default Projects;
