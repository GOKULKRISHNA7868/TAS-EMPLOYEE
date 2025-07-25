import React, { useEffect, useState } from "react";
import { collection, getDocs, updateDoc, doc } from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { format } from "date-fns";

const ViewTicket = () => {
  const [tickets, setTickets] = useState<any[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [projectMap, setProjectMap] = useState<{ [key: string]: string }>({});
  const [loading, setLoading] = useState(true);

  // Auth state
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        setUserId(null);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch project names
  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const projectSnap = await getDocs(collection(db, "projects"));
        const map: { [key: string]: string } = {};
        projectSnap.forEach((docSnap) => {
          const data = docSnap.data();
          map[docSnap.id] = data.name || "Unnamed Project";
        });
        setProjectMap(map);
      } catch (error) {
        console.error("Error fetching projects:", error);
      }
    };

    fetchProjects();
  }, []);

  // Fetch and filter tickets
  useEffect(() => {
    const fetchTickets = async () => {
      try {
        const ticketSnap = await getDocs(collection(db, "raiseTickets"));
        const allTickets: any[] = [];
        ticketSnap.forEach((docSnap) => {
          const ticketData = { id: docSnap.id, ...docSnap.data() };
          allTickets.push(ticketData);
        });

        if (userId) {
          const filtered = allTickets.filter(
            (ticket) => ticket.teamLeadId === userId
          );
          setTickets(filtered);
        }

        setLoading(false);
      } catch (error) {
        console.error("Error fetching tickets:", error);
        setLoading(false);
      }
    };

    if (userId) {
      fetchTickets();
    }
  }, [userId]);

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const ticketRef = doc(db, "raiseTickets", id);
      await updateDoc(ticketRef, {
        status: newStatus,
      });
      setTickets((prev) =>
        prev.map((ticket) =>
          ticket.id === id ? { ...ticket, status: newStatus } : ticket
        )
      );
    } catch (error) {
      console.error("Error updating status:", error);
    }
  };

  if (loading || userId === null) {
    return <div className="p-4 text-gray-600">Authenticating...</div>;
  }

  if (tickets.length === 0) {
    return <div className="p-4 text-gray-600">No tickets assigned to you.</div>;
  }

  return (
    <div className="p-6">
      <h2 className="text-2xl font-semibold mb-4 text-gray-800">
        Assigned Tickets
      </h2>
      <div className="overflow-auto">
        <table className="min-w-full bg-white rounded shadow">
          <thead>
            <tr className="bg-gray-200 text-sm text-left">
              <th className="p-2">Ticket ID</th>
              <th className="p-2">Title</th>
              <th className="p-2">Description</th>
              <th className="p-2">Priority</th>
              <th className="p-2">Due Date</th>
              <th className="p-2">Status</th>
              <th className="p-2">Review</th>
              <th className="p-2">Project Name</th>
              <th className="p-2">Created By</th>
              <th className="p-2">Created At</th>
              <th className="p-2">Update Status</th>
            </tr>
          </thead>
          <tbody>
            {tickets.map((ticket) => (
              <tr key={ticket.id} className="border-t text-sm">
                <td className="p-2">{ticket.projectTicketId}</td>
                <td className="p-2">{ticket.title}</td>
                <td className="p-2">{ticket.description}</td>
                <td className="p-2">{ticket.priority}</td>
                <td className="p-2">{ticket.dueDate}</td>
                <td className="p-2">{ticket.status}</td>
                <td className="p-2">{ticket.review || "—"}</td>
                <td className="p-2">
                  {projectMap[ticket.projectId] || "Loading..."}
                </td>
                <td className="p-2">{ticket.createdByName}</td>
                <td className="p-2">
                  {ticket.createdAt?.seconds
                    ? format(
                        new Date(ticket.createdAt.seconds * 1000),
                        "dd MMM yyyy, hh:mm a"
                      )
                    : "N/A"}
                </td>
                <td className="p-2">
                  <select
                    className="border rounded px-2 py-1"
                    value={ticket.status}
                    onChange={(e) =>
                      handleStatusChange(ticket.id, e.target.value)
                    }
                  >
                    <option value="Pending">Pending</option>
                    <option value="In Progress">In Progress</option>
                    <option value="Done">Done</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ViewTicket;
