import React, { useEffect, useState } from "react";
import { collection, getDocs, query, where } from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, differenceInCalendarDays, parseISO } from "date-fns";
import { motion } from "framer-motion";

const getScoreColor = (score: number) => {
  if (score >= 3) return "bg-green-100 text-green-700";
  if (score === 2) return "bg-yellow-100 text-yellow-800";
  return "bg-red-100 text-red-700";
};

const PerformanceMatrix = () => {
  const { user } = useAuthStore();
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchPerformanceTasks = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, "tasks"),
        where("assigned_to", "==", user.uid)
      );
      const snapshot = await getDocs(q);

      const taskData = snapshot.docs.map((doc) => {
        const task = doc.data();
        const due = new Date(task.due_date);
        const created =
          task.created_at?.toDate?.() ?? new Date(task.created_at);
        const updated =
          task.progress_updated_at?.toDate?.() ??
          new Date(task.progress_updated_at);

        const reassignedCount = Array.isArray(task.reassign_history)
          ? task.reassign_history.length
          : 0;

        let score = 0;
        const diffDue = differenceInCalendarDays(due, updated);
        const diffAssigned = differenceInCalendarDays(updated, created);

        if (diffDue >= 2) score += 2;
        else if (diffDue === 1) score += 1;
        else if (diffAssigned === 0) score += 1;

        score -= reassignedCount;

        return {
          id: doc.id,
          title: task.title,
          due_date: format(due, "yyyy-MM-dd"),
          score,
          reassignedCount,
        };
      });

      setTasks(taskData);
    } catch (err) {
      console.error("Error loading tasks", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPerformanceTasks();
  }, []);

  const pieData = [
    { name: "High", value: tasks.filter((t) => t.score >= 3).length },
    { name: "Medium", value: tasks.filter((t) => t.score === 2).length },
    { name: "Low", value: tasks.filter((t) => t.score < 2).length },
  ];

  const pieColors = ["#34d399", "#facc15", "#f87171"];

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <h1 className="text-3xl font-bold mb-4 text-gray-800">
          🎯 Performance Matrix
        </h1>

        {loading ? (
          <p className="text-gray-500">Loading performance data...</p>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
              <motion.div
                className="bg-white shadow-lg rounded-lg p-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-xl font-semibold mb-3">
                  📊 Task Scores (Bar Chart)
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={tasks}>
                    <XAxis dataKey="title" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="score" fill="#60a5fa" />
                  </BarChart>
                </ResponsiveContainer>
              </motion.div>

              <motion.div
                className="bg-white shadow-lg rounded-lg p-4"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
              >
                <h2 className="text-xl font-semibold mb-3">
                  🧠 Score Distribution (Pie)
                </h2>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={80}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name}: ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {pieData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={pieColors[index % pieColors.length]}
                        />
                      ))}
                    </Pie>
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </motion.div>
            </div>

            <div className="bg-white shadow rounded-lg p-4">
              <h2 className="text-xl font-semibold mb-4">📋 Task Details</h2>
              <div className="space-y-3">
                {tasks.map((task) => (
                  <div
                    key={task.id}
                    className={`p-3 rounded-lg border ${getScoreColor(
                      task.score
                    )} flex justify-between items-center`}
                  >
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm">
                        Due: {task.due_date} | Reassigns: {task.reassignedCount}
                      </p>
                    </div>
                    <div className="text-lg font-bold">Score: {task.score}</div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default PerformanceMatrix;
