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
const { Option } = Select;

export default function MyTasks() {
  const [tasks, setTasks] = useState([]);
  const [filteredTasks, setFilteredTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [progressData, setProgressData] = useState({});
  const [searchText, setSearchText] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [reviewFilter, setReviewFilter] = useState("");
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

  const handleSearchFilter = () => {
    let filtered = [...tasks];

    if (searchText.trim()) {
      const lowerSearch = searchText.toLowerCase();
      filtered = filtered.filter(
        (task) =>
          task.title?.toLowerCase().includes(lowerSearch) ||
          task.description?.toLowerCase().includes(lowerSearch) ||
          task.created_by?.toLowerCase().includes(lowerSearch) ||
          task.task_id?.toLowerCase().includes(lowerSearch) ||
          task.linked_ticket?.toLowerCase().includes(lowerSearch)
      );
    }

    if (statusFilter) {
      filtered = filtered.filter(
        (task) => task.progress_status === statusFilter
      );
    }

    if (reviewFilter) {
      filtered = filtered.filter((task) => task.status === reviewFilter);
    }

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
      key: "task_id",
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
      title: "linked ticket",
      render: (_, record) => (
        <TextArea
          placeholder="Optional description"
          rows={2}
          defaultValue={record.progress_description}
          onChange={(e) =>
            handleInputChange(record.id, "linked_ticket", e.target.value)
          }
        />
      ),
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
          <Option value="pending">Pending</Option>
          <Option value="in_progress">In Progress</Option>
          <Option value="completed">Completed</Option>
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

      {/* Filters Section */}
      <Space style={{ marginBottom: 16, flexWrap: "wrap" }}>
        <Input
          placeholder="Search tasks..."
          allowClear
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 200 }}
        />
        <Select
          placeholder="Filter by progress"
          allowClear
          style={{ width: 160 }}
          value={statusFilter}
          onChange={(value) => setStatusFilter(value)}
        >
          <Option value="pending">Pending</Option>
          <Option value="in_progress">In Progress</Option>
          <Option value="completed">Completed</Option>
        </Select>
        <Select
          placeholder="Filter by review"
          allowClear
          style={{ width: 160 }}
          value={reviewFilter}
          onChange={(value) => setReviewFilter(value)}
        >
          <Option value="Pending">Pending</Option>
          <Option value="Reviewed">Reviewed</Option>
          <Option value="Rejected">Rejected</Option>
        </Select>
        <Button type="primary" onClick={handleSearchFilter}>
          Search
        </Button>
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
