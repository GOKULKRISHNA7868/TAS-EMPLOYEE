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
import { Dialog } from "@headlessui/react";
import { useAuthStore } from "../store/authStore";
import toast from "react-hot-toast";
import { Pencil, Trash2 } from "lucide-react";
import { format } from "date-fns";

function Projects() {
  const [taskForms, setTaskForms] = useState({});
  const [selectedTeamMembers, setSelectedTeamMembers] = useState({});
  const [projectTasks, setProjectTasks] = useState({});
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editedTask, setEditedTask] = useState({});
  const [newComments, setNewComments] = useState({});
  const [searchTerm, setSearchTerm] = useState("");

  const { user } = useAuthStore();
  const [reassigningTask, setReassigningTask] = useState(null);
  const [reassignComment, setReassignComment] = useState("");
  const [projectMap, setProjectMap] = useState({});

  const handleReassign = async (task, projectId) => {
    try {
      const taskRef = doc(db, "tasks", task.id);
      const taskSnap = await getDoc(taskRef);
      const taskData = taskSnap.data();

      const existingComments = taskData?.comments || [];
      const existingHistory = taskData?.reassign_history || [];

      const newComment = reassignComment.trim()
        ? {
            userId: user?.uid,
            text: reassignComment,
            timestamp: new Date().toISOString(),
          }
        : null;

      const updateData = {
        progress_status: "pending", // ✅ updated as requested
        ...(newComment && {
          comments: [...existingComments, newComment],
        }),
        reassign_history: [
          ...existingHistory,
          {
            userId: user?.uid,
            comment: reassignComment || "",
            reassigned_at: new Date().toISOString(),
          },
        ],
      };

      await updateDoc(taskRef, updateData);

      toast.success("Task reassigned");
      getProjectTasks(projectId);
    } catch (err) {
      console.error(err);
      toast.error("Failed to reassign task");
    } finally {
      setReassigningTask(null);
      setReassignComment("");
    }
  };

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
    async (taskData) => await addDoc(collection(db, "tasks"), taskData),
    {
      onSuccess: () => toast.success("Task(s) assigned successfully"),
      onError: () => toast.error("Failed to assign task"),
    }
  );

  const updateStatus = useMutation(
    async ({ id, status }) => await updateDoc(doc(db, "tasks", id), { status }),
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

    const commonTask = {
      title: form.title,
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
    };

    if (form.assignToAll) {
      members.forEach((memberId) => {
        createTask.mutate({ ...commonTask, assigned_to: memberId });
      });
    } else if (form.assignToMember) {
      createTask.mutate({ ...commonTask, assigned_to: form.assignToMember });
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

  const handleAddComment = async (taskId, projectId, comment) => {
    if (!comment) return toast.error("Comment cannot be empty");
    try {
      const taskRef = doc(db, "tasks", taskId);
      const taskSnap = await getDoc(taskRef);
      const taskData = taskSnap.data();
      const prevComments = taskData?.comments || [];
      const newComment = {
        userId: user?.uid,
        text: comment,
        timestamp: new Date().toISOString(),
      };
      await updateDoc(taskRef, {
        comments: [...prevComments, newComment],
      });
      toast.success("Comment added");
      getProjectTasks(projectId);
    } catch (err) {
      console.error(err);
      toast.error("Failed to add comment");
    }
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
    <div className="p-4">
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search across all tasks..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value.toLowerCase())}
          className="w-full p-2 border rounded"
        />
      </div>

      <table className="w-full border">
        <thead>
          <tr>
            <th className="border p-2">Linked ID</th>
            <th className="border p-2">Task ID</th>
            <th className="border p-2">Project Name</th>
            <th className="border p-2">Task Title</th>
            <th className="border p-2">Assigned To</th>
            <th className="border p-2">Due Date</th>
            <th className="border p-2">Review</th>
            <th className="border p-2">Progress</th>
            <th className="border p-2">Comments</th>
            <th className="border p-2">Actions</th>
          </tr>
        </thead>
        <tbody>
          {projects.map((project) => {
            const tasks = (projectTasks[project.id] || [])
              .sort((a, b) => {
                const aDate = a.due_date ? new Date(a.due_date) : new Date(0);
                const bDate = b.due_date ? new Date(b.due_date) : new Date(0);
                return aDate - bDate;
              })
              .filter((task) => {
                const values = [
                  task.linked_ticket,
                  task.task_id,
                  task.title,
                  task.description,
                  project.name,
                  getEmployeeName(task.assigned_to),
                  task.status,
                  task.progress_status,
                  task.progress_description,
                  task.progress_link,
                  ...(task.comments || []).map((c) => c.text),
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                return values.includes(searchTerm);
              });

            return tasks.map((task) => {
              const isOverdue = new Date(task.due_date) < new Date();
              const isEditing = editingTaskId === task.id;
              const taskComments = task.comments || [];
              const reassigns = task.reassign_history || [];

              return (
                <tr key={task.id}>
                  <td className="p-2 border">
                    {isEditing ? (
                      <input
                        className="border p-1 w-full"
                        value={editedTask.linked_ticket}
                        onChange={(e) =>
                          setEditedTask((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      task.linked_ticket
                    )}
                  </td>
                  <td className="p-2 border">
                    {isEditing ? (
                      <input
                        className="border p-1 w-full"
                        value={editedTask.task_id}
                        onChange={(e) =>
                          setEditedTask((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      task.task_id
                    )}
                  </td>
                  <td className="p-2 border">{project.name}</td>
                  <td className="p-2 border">
                    {isEditing ? (
                      <input
                        className="border p-1 w-full"
                        value={editedTask.title}
                        onChange={(e) =>
                          setEditedTask((prev) => ({
                            ...prev,
                            title: e.target.value,
                          }))
                        }
                      />
                    ) : (
                      <div>
                        <div className="font-semibold">{task.title}</div>
                        {task.description && (
                          <div className="text-xs text-gray-500 mt-1 truncate max-w-[250px]">
                            {task.description.length > 60
                              ? `${task.description.slice(0, 60)}...`
                              : task.description}
                          </div>
                        )}
                      </div>
                    )}
                  </td>

                  <td className="p-2 border">
                    {getEmployeeName(task.assigned_to)}
                  </td>
                  <td
                    className={`p-2 border ${
                      isOverdue ? "text-red-600 font-semibold" : ""
                    }`}
                  >
                    {isEditing ? (
                      <input
                        type="date"
                        className="border p-1"
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
                      className="text-sm border rounded px-1"
                    >
                      <option value="pending">Pending</option>
                      <option value="in_progress">In Progress</option>
                      <option value="completed">Completed</option>
                    </select>
                  </td>
                  <td className="p-2 border text-xs">
                    <div>
                      Status: <strong>{task.progress_status}</strong>
                    </div>
                    <div>
                      Description:{" "}
                      <span className="italic">
                        {task.progress_description || "—"}
                      </span>
                    </div>
                    <div>
                      Link:{" "}
                      {task.progress_link ? (
                        <a
                          href={task.progress_link}
                          target="_blank"
                          rel="noreferrer"
                          className="text-blue-500 underline text-xs"
                        >
                          Open
                        </a>
                      ) : (
                        <span className="text-gray-400 italic">None</span>
                      )}
                    </div>
                    <div>
                      Updated At:{" "}
                      {task.progress_updated_at &&
                      typeof task.progress_updated_at.toDate === "function" ? (
                        format(
                          task.progress_updated_at.toDate(),
                          "MM-dd-yyyy HH:mm"
                        )
                      ) : (
                        <span className="italic text-gray-400">
                          Not updated
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="p-2 border">
                    <div className="space-y-1 max-h-20 overflow-auto">
                      {taskComments.length > 0 ? (
                        taskComments.map((c, idx) => (
                          <div key={idx} className="text-xs border-b pb-1">
                            <span className="font-semibold">
                              {getEmployeeName(c.userId)}
                            </span>
                            : {c.text}
                            <br />
                            <span className="text-[10px] text-gray-500">
                              {format(
                                new Date(c.timestamp),
                                "yyyy-MM-dd HH:mm"
                              )}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="italic text-gray-400">No comments</div>
                      )}
                    </div>
                    <input
                      type="text"
                      placeholder="Add comment..."
                      value={newComments[task.id] || ""}
                      onChange={(e) =>
                        setNewComments((prev) => ({
                          ...prev,
                          [task.id]: e.target.value,
                        }))
                      }
                      className="border mt-1 p-1 w-full text-xs"
                    />
                    <button
                      onClick={() =>
                        handleAddComment(
                          task.id,
                          project.id,
                          newComments[task.id]
                        )
                      }
                      className="text-blue-500 text-xs hover:underline mt-1"
                    >
                      Post
                    </button>
                  </td>
                  <td className="p-2 border text-center flex gap-2 items-center justify-center">
                    {isEditing ? (
                      <>
                        <button
                          onClick={() => handleEditSave(task.id, project.id)}
                          className="text-green-600 font-medium hover:underline"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => setEditingTaskId(null)}
                          className="text-gray-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <Pencil
                          onClick={() => handleEditClick(task)}
                          className="text-blue-500 cursor-pointer hover:text-blue-700"
                          size={18}
                        />
                        <Trash2
                          onClick={() => handleDelete(task.id, project.id)}
                          className="text-red-500 cursor-pointer hover:text-red-700"
                          size={18}
                        />
                        <button
                          onClick={() => {
                            setReassigningTask({ task, projectId: project.id });
                            setReassignComment("");
                          }}
                          className="text-yellow-600 text-xs hover:underline"
                        >
                          Reassign
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              );
            });
          })}
        </tbody>
      </table>

      {/* 🔁 Reassign Modal */}
      <Dialog
        open={!!reassigningTask}
        onClose={() => setReassigningTask(null)}
        className="fixed inset-0 z-50 flex items-center justify-center"
      >
        <div className="bg-black/50 fixed inset-0" />
        <div className="bg-white rounded-lg shadow-lg p-6 z-50 w-[90%] max-w-md space-y-4">
          <Dialog.Title className="text-lg font-bold">
            Reassign Task
          </Dialog.Title>
          <p className="text-sm">
            Are you sure you want to reassign the task{" "}
            <strong>{reassigningTask?.task?.title}</strong>?<br />
            You may optionally provide a comment.
          </p>

          <textarea
            value={reassignComment}
            onChange={(e) => setReassignComment(e.target.value)}
            placeholder="Optional comment..."
            className="w-full border rounded p-2 text-sm"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setReassigningTask(null)}
              className="px-3 py-1 rounded bg-gray-200 text-sm"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                handleReassign(reassigningTask.task, reassigningTask.projectId)
              }
              className="px-3 py-1 rounded bg-yellow-500 text-white text-sm"
            >
              Reassign
            </button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}

export default Projects;
