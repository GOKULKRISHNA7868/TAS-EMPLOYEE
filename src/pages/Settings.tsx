import React, { useEffect, useState } from "react";
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

export default function EmployeePerformancePage() {
  const { user } = useAuthStore();
  const [groupedEmployees, setGroupedEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [noTeam, setNoTeam] = useState(false);

  useEffect(() => {
    const userId = user?.id || user?.uid;
    console.log("👤 Current user from store:", user);
    if (!userId) {
      console.warn("⚠️ User ID not available yet");
      return;
    }

    const fetchData = async () => {
      try {
        const teamsQuery = query(
          collection(db, "teams"),
          where("members", "array-contains", userId)
        );
        const teamsSnapshot = await getDocs(teamsQuery);

        if (teamsSnapshot.empty) {
          setNoTeam(true);
          setLoading(false);
          return;
        }

        const allTeams = [];

        for (const teamDoc of teamsSnapshot.docs) {
          const teamData = teamDoc.data();
          const teamId = teamDoc.id;

          // Get team leader info
          let leaderName = "Unknown";
          if (teamData.leader) {
            const leaderDoc = await getDoc(
              doc(db, "employees", teamData.leader)
            );
            if (leaderDoc.exists()) {
              const leaderData = leaderDoc.data();
              leaderName = leaderData?.name || "Unnamed Leader";
            }
          }

          const memberIds = teamData.members;
          const employees = [];

          const chunkSize = 10; // Firestore "in" clause limit
          for (let i = 0; i < memberIds.length; i += chunkSize) {
            const chunk = memberIds.slice(i, i + chunkSize);
            const employeesQuery = query(
              collection(db, "employees"),
              where("id", "in", chunk)
            );
            const snapshot = await getDocs(employeesQuery);
            snapshot.forEach((doc) => {
              employees.push({ id: doc.id, ...doc.data() });
            });
          }

          allTeams.push({
            teamName: teamData.teamName || "Unnamed Team",
            leaderName,
            members: employees,
          });
        }

        setGroupedEmployees(allTeams);
      } catch (error) {
        console.error("🔥 Error fetching team performance data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [user]);

  if (loading) return <p className="p-4">Loading...</p>;
  if (noTeam) return <p className="p-4">You are not part of any team.</p>;

  return (
    <div className="p-4">
      <h2 className="text-xl font-bold mb-4">Team Performance Overview</h2>

      {groupedEmployees.map((team, index) => (
        <div key={index} className="mb-8">
          <div className="mb-2">
            <h3 className="text-lg font-semibold text-blue-700">
              {team.teamName}
            </h3>
            <p className="text-sm text-gray-500">
              Team Leader:{" "}
              <span className="font-medium">{team.leaderName}</span>
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {team.members.map((emp) => (
              <SummaryCard key={emp.id} employee={emp} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// SummaryCard Component Inline
function SummaryCard({ employee }) {
  return (
    <div className="bg-white rounded-xl shadow p-4 border hover:shadow-md transition">
      <h4 className="text-md font-semibold text-gray-800">{employee.name}</h4>
      <p className="text-sm text-gray-500">{employee.title}</p>
      <p className="text-xs text-gray-400">{employee.department}</p>
    </div>
  );
}
