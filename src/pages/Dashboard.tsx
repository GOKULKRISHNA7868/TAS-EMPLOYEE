import React, { useEffect, useState } from "react";
import {
  Calendar,
  Card,
  Typography,
  Modal,
  Table,
  Tag,
  Spin,
  Collapse,
  Button,
  Row,
  Col,
} from "antd";
import dayjs, { Dayjs } from "dayjs";
import { useSpring, animated } from "@react-spring/web";
import {
  collection,
  getDocs,
  query,
  where,
  doc,
  getDoc,
} from "firebase/firestore";
import { db } from "../lib/firebase";
import { useAuthStore } from "../store/authStore";

const { Title, Text } = Typography;
const { Panel } = Collapse;

export default function PerformanceDashboard() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [employee, setEmployee] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [dayTasks, setDayTasks] = useState<any[]>([]);

  useEffect(() => {
    if (!user?.uid) return;
    (async function fetchData() {
      setLoading(true);
      try {
        const empSnap = await getDocs(
          query(collection(db, "employees"), where("id", "==", user.uid))
        );
        setEmployee(empSnap.docs[0]?.data());

        const tSnap = await getDocs(
          query(collection(db, "tasks"), where("assigned_to", "==", user.uid))
        );
        const enriched = await Promise.all(
          tSnap.docs.map(async (d) => {
            const t = { id: d.id, ...d.data() } as any;
            if (t.project_id) {
              const ps = await getDoc(doc(db, "projects", t.project_id));
              t.project_name = ps.exists() ? ps.data()?.name : t.project_id;
            }
            if (t.created_by) {
              const es = await getDocs(
                query(
                  collection(db, "employees"),
                  where("id", "==", t.created_by)
                )
              );
              t.assigned_by_name = es.docs[0]?.data()?.name || t.created_by;
            }
            return t;
          })
        );

        const allCommentIds = new Set<string>();
        enriched.forEach((t) =>
          (t.comments || []).forEach((c: any) => allCommentIds.add(c.userId))
        );

        const empAll = await getDocs(collection(db, "employees"));
        const idToName: Record<string, string> = {};
        empAll.forEach((d) => {
          const dt = d.data();
          if (allCommentIds.has(dt.id)) idToName[dt.id] = dt.name;
        });

        const finalTasks = enriched.map((t) => ({
          ...t,
          comments: (t.comments || []).map((c: any) => ({
            ...c,
            userName: idToName[c.userId] || c.userId,
          })),
        }));

        setTasks(finalTasks);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user?.uid]);

  const fade = useSpring({
    opacity: loading ? 0 : 1,
    transform: loading ? "translateY(20px)" : "translateY(0px)",
  });

  if (loading) {
    return (
      <div className="h-screen flex justify-center items-center">
        <Spin size="large" />
      </div>
    );
  }

  const total = tasks.length;
  const completedCount = tasks.filter(
    (t) => t.progress_status === "completed"
  ).length;
  const inProgressCount = tasks.filter(
    (t) => t.progress_status === "in_progress"
  ).length;
  const pendingCount = total - completedCount - inProgressCount;

  const dateCellRender = (value: Dayjs) => {
    const d = value.format("YYYY-MM-DD");
    const list = tasks.filter((t) => t.due_date === d);
    if (!list.length) return null;
    return (
      <div className="space-y-1">
        {list.map((task) => {
          const isOverdue =
            task.progress_status === "pending" &&
            dayjs(task.due_date).isBefore(dayjs(), "day");
          let icon = "⏳";
          if (task.progress_status === "completed") icon = "✅";
          else if (task.progress_status === "in_progress") icon = "🔄";
          else if (isOverdue) icon = "❌";

          return (
            <div
              key={task.id}
              onClick={() => {
                setSelectedDate(d);
                setDayTasks(tasks.filter((t) => t.due_date === d));
                setModalVisible(true);
              }}
              style={{
                cursor: "pointer",
                whiteSpace: "nowrap",
                fontSize: 12,
              }}
            >
              <span style={{ marginRight: 4 }}>{icon}</span>
              <span>{task.task_id}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const onSelect = (value: Dayjs) => {
    const d = value.format("YYYY-MM-DD");
    setSelectedDate(d);
    setDayTasks(tasks.filter((t) => t.due_date === d));
    setModalVisible(true);
  };

  const columns = [
    { title: "Task ID", dataIndex: "task_id", key: "task_id" },
    { title: "Task", dataIndex: "title", key: "title" },
    { title: "Project", dataIndex: "project_name", key: "project_name" },
    {
      title: "Status",
      dataIndex: "progress_status",
      key: "progress_status",
      render: (s: string) => (
        <Tag
          color={
            s === "completed" ? "green" : s === "in_progress" ? "blue" : "red"
          }
        >
          {s}
        </Tag>
      ),
    },
    { title: "Due Date", dataIndex: "due_date", key: "due_date" },
    {
      title: "Assigned By",
      dataIndex: "assigned_by_name",
      key: "assigned_by_name",
    },
  ];

  return (
    <animated.div style={fade} className="p-6 space-y-6">
      <Card>
        <Title level={2}>Performance Dashboard</Title>
        <Row gutter={16}>
          <Col>
            <Card type="inner" title="Total Tasks">
              {total}
            </Card>
          </Col>
          <Col>
            <Card type="inner" title="Completed">
              {completedCount}
            </Card>
          </Col>
          <Col>
            <Card type="inner" title="In Progress">
              {inProgressCount}
            </Card>
          </Col>
          <Col>
            <Card type="inner" title="Pending">
              {pendingCount}
            </Card>
          </Col>
        </Row>
      </Card>

      {/* Upcoming Due Tasks alert card */}
      {(() => {
        const today = dayjs();
        const upcoming = tasks.filter(
          (t) =>
            t.progress_status !== "completed" &&
            dayjs(t.due_date).isAfter(today.subtract(1, "day")) &&
            dayjs(t.due_date).isBefore(today.add(4, "day"))
        );
        if (upcoming.length === 0) return null;
        return (
          <Card
            type="inner"
            title="Upcoming Due Tasks"
            style={{ borderLeft: "5px solid orange" }}
          >
            <ul style={{ paddingLeft: 20 }}>
              {upcoming.map((t) => (
                <li key={t.id}>
                  <strong>{t.task_id}</strong> - {t.title} (Due: {t.due_date})
                </li>
              ))}
            </ul>
          </Card>
        );
      })()}

      <Card>
        <Title level={4}>Task Calendar</Title>
        <Calendar
          fullscreen
          onSelect={onSelect}
          dateCellRender={dateCellRender}
        />
      </Card>

      <Modal
        visible={modalVisible}
        title={`Tasks on ${selectedDate}`}
        onCancel={() => setModalVisible(false)}
        footer={<Button onClick={() => setModalVisible(false)}>Close</Button>}
        width={800}
      >
        <Table
          dataSource={dayTasks}
          columns={columns}
          rowKey="id"
          pagination={false}
        />
        <Collapse style={{ marginTop: 16 }} accordion>
          {dayTasks.map((t) => (
            <Panel header={`ID ${t.task_id} – ${t.title}`} key={t.id}>
              <Text>
                <b>Description:</b> {t.description || "-"}
              </Text>
              <br />
              <Text>
                <b>Comments:</b>
              </Text>
              {(t.comments || []).length > 0 ? (
                t.comments.map((c: any, i: number) => (
                  <div key={i}>
                    • {c.text} (by {c.userName})
                  </div>
                ))
              ) : (
                <Text type="secondary">None</Text>
              )}
              <Text style={{ marginTop: 8 }}>
                <b>Attachments:</b> {(t.attachments || []).join(", ") || "None"}
              </Text>
              <br />
              <Text style={{ marginTop: 8 }}>
                <b>Manager Feedback:</b> {t.manager_review || "None"}
              </Text>
            </Panel>
          ))}
        </Collapse>
      </Modal>
    </animated.div>
  );
}
