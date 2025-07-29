import React, { useEffect, useState } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import { Table, Input, Select, Button, message, Typography, Space } from "antd";

const { TextArea } = Input;
const { Title } = Typography;
const { Search } = Input;

function formatGoogleCalendarDate(date) {
  return (
    date
      .toISOString()
      .replace(/[-:]|\.\d{3}/g, "")
      .slice(0, 15) + "Z"
  );
}

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progressData, setProgressData] = useState({});
  const [searchTerm, setSearchTerm] = useState("");
  const { user } = useAuthStore();
  const [userMap, setUserMap] = useState({});

  const fetchTasks = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, "tasks"),
        where("assigned_to", "==", user.uid)
      );
      const snapshot = await getDocs(q);
      const tasksList = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));

      const createdByIds = [
        ...new Set(tasksList.map((task) => task.created_by)),
      ];

      const usersSnap = await Promise.all(
        createdByIds.map((id) => getDoc(doc(db, "employees", id)))
      );

      const userMapping = {};
      usersSnap.forEach((docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          userMapping[docSnap.id] = data.name || docSnap.id;
        }
      });

      const enrichedTasks = tasksList.map((task) => ({
        ...task,
        created_by: userMapping[task.created_by] || task.created_by,
      }));

      setUserMap(userMapping);
      setTasks(enrichedTasks);
      setFilteredTasks(enrichedTasks);
    } catch (error) {
      console.error("Error fetching tasks:", error);
      message.error("Failed to fetch tasks.");
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (taskId, field, value) => {
    setProgressData((prev) => ({
      ...prev,
      [taskId]: {
        ...prev[taskId],
        [field]: value,
      },
    }));
  };

  const handleUpdateProgress = async (taskId) => {
    const data = progressData[taskId] || {};
    if (!data.progress_status) {
      message.warning("Please select a progress status.");
      return;
    }

    try {
      const taskRef = doc(db, "tasks", taskId);
      await updateDoc(taskRef, {
        progress_status: data.progress_status,
        progress_description: data.progress_description || "",
        progress_link: data.progress_link || "",
        progress_updated_at: serverTimestamp(),
      });
      message.success("Progress updated.");
      fetchTasks();
    } catch (error) {
      console.error("Error updating progress:", error);
      message.error("Update failed.");
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [user]);

  const handleSearch = (value) => {
    setSearchTerm(value);
    if (value.length < 2) {
      setFilteredTasks(tasks);
      return;
    }

    const lower = value.toLowerCase();
    const filtered = tasks.filter((task) =>
      Object.values(task).some(
        (val) => typeof val === "string" && val.toLowerCase().includes(lower)
      )
    );
    setFilteredTasks(filtered);
  };

  const columns = [
    {
      title: "Linked ticket",
      dataIndex: "linked_ticket",
    },
    {
      title: "Task ID",
      dataIndex: "task_id",
    },
    {
      title: "Title",
      dataIndex: "title",
    },
    {
      title: "Description",
      dataIndex: "description",
    },
    {
      title: "Due Date",
      dataIndex: "due_date",
      render: (due_date, record) => {
        const isExpired =
          due_date &&
          new Date(due_date) < new Date() &&
          (!record.progress_status || record.progress_status === "pending");

        return (
          <span style={{ color: isExpired ? "red" : "inherit" }}>
            {due_date || "—"}
          </span>
        );
      },
    },
    {
      title: "Assigned By",
      dataIndex: "created_by",
    },
    {
      title: "Review",
      dataIndex: "status",
    },
    {
      title: "Progress Status",
      render: (_, record) => (
        <Select
          style={{ width: 120 }}
          defaultValue={record.progress_status || ""}
          onChange={(value) =>
            handleInputChange(record.id, "progress_status", value)
          }
        >
          <Select.Option value="pending">Pending</Select.Option>
          <Select.Option value="in_progress">In Progress</Select.Option>
          <Select.Option value="completed">Completed</Select.Option>
        </Select>
      ),
    },
    {
      title: "Progress Description",
      render: (_, record) => (
        <TextArea
          placeholder="Optional description"
          rows={2}
          defaultValue={record.progress_description}
          onChange={(e) =>
            handleInputChange(record.id, "progress_description", e.target.value)
          }
        />
      ),
    },
    {
      title: "Progress Link",
      render: (_, record) => (
        <Input
          placeholder="Optional link"
          defaultValue={record.progress_link}
          onChange={(e) =>
            handleInputChange(record.id, "progress_link", e.target.value)
          }
        />
      ),
    },
    {
      title: "Action",
      render: (_, record) => (
        <Button type="primary" onClick={() => handleUpdateProgress(record.id)}>
          Update
        </Button>
      ),
    },
    {
      title: "Add to Calendar",
      render: (_, record) => {
        const dateTime = record.due_date ? new Date(record.due_date) : null;

        const calendarUrl = dateTime
          ? `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(
              record.title || "Task Reminder"
            )}&dates=${formatGoogleCalendarDate(
              dateTime
            )}/${formatGoogleCalendarDate(
              new Date(dateTime.getTime() + 30 * 60 * 1000)
            )}&details=${encodeURIComponent(
              record.description || ""
            )}&location=&sf=true&output=xml`
          : null;

        return calendarUrl ? (
          <Button
            type="default"
            onClick={() => window.open(calendarUrl, "_blank")}
          >
            Add Reminder
          </Button>
        ) : (
          <span className="text-gray-400 italic">No due date</span>
        );
      },
    },
    {
      title: "Feedback",
      render: (_, record) => (
        <div>
          <div>
            <strong>Reassigned:</strong> {record.reassign_count || 0}
          </div>
          <div>
            <strong>Comments:</strong>
            {Array.isArray(record.comments) && record.comments.length > 0 ? (
              <ul style={{ paddingLeft: 16, marginBottom: 0 }}>
                {record.comments.map((c, idx) => (
                  <li key={idx}>{c.text}</li>
                ))}
              </ul>
            ) : (
              <span className="italic text-gray-400">No comments</span>
            )}
          </div>
        </div>
      ),
    },
  ];

  return (
    <div className="p-4">
      <Title level={3}>My Assigned Tasks</Title>
      <Space style={{ marginBottom: 16 }}>
        <Search
          placeholder="Search tasks (min 2 letters)"
          allowClear
          onChange={(e) => handleSearch(e.target.value)}
          style={{ width: 300 }}
        />
      </Space>
      <Table
        dataSource={filteredTasks}
        columns={columns}
        rowKey="id"
        loading={loading}
        scroll={{ x: true }}
      />
    </div>
  );
}
