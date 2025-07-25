import React, { useEffect, useState } from "react";
import { db } from "../lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const ProjectSelector = ({
  onSelect,
}: {
  onSelect: (id: string, name: string) => void;
}) => {
  const [projects, setProjects] = useState<any[]>([]);

  useEffect(() => {
    const fetchProjects = async () => {
      const snapshot = await getDocs(collection(db, "projects"));
      const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setProjects(data);
    };
    fetchProjects();
  }, []);

  return (
    <div className="mb-4">
      <label className="block mb-1 font-semibold">Select a Project:</label>
      <select
        onChange={(e) => {
          const selected = projects.find((p) => p.id === e.target.value);
          if (selected) onSelect(selected.id, selected.name);
        }}
        className="w-full p-2 border rounded"
      >
        <option value="">-- Choose --</option>
        {projects.map((proj) => (
          <option key={proj.id} value={proj.id}>
            {proj.name}
          </option>
        ))}
      </select>
    </div>
  );
};

export default ProjectSelector;
