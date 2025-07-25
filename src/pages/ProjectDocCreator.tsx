import React, { useState, useEffect } from "react";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { v4 as uuidv4 } from "uuid";
import {
  collection,
  doc,
  getDocs,
  query,
  setDoc,
  where,
  updateDoc,
} from "firebase/firestore";
import { db, auth } from "../lib/firebase";
import ProjectSelector from "../components/ProjectSelector";

const ProjectDocManager = () => {
  const [projectId, setProjectId] = useState("");
  const [projectName, setProjectName] = useState("");
  const [documents, setDocuments] = useState<any[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null);
  const [content, setContent] = useState("");
  const [previewMode, setPreviewMode] = useState(false);
  const [userEmail, setUserEmail] = useState("");

  // Get user email
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user?.email) setUserEmail(user.email);
    });
    return () => unsub();
  }, []);

  // Prevent Print Shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "p") {
        e.preventDefault();
        alert("Printing is disabled.");
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch documents for selected project
  const fetchDocs = async (projId: string) => {
    const snapshot = await getDocs(collection(db, "projectDocs"));
    const filtered = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((d) => d.projectId === projId);
    setDocuments(filtered);
  };

  const handleProjectSelect = (id: string, name: string) => {
    setProjectId(id);
    setProjectName(name);
    setSelectedDoc(null);
    setContent("");
    fetchDocs(id);
  };

  const handleNewDoc = () => {
    setSelectedDoc(null);
    setContent("");
    setPreviewMode(false);
  };

  const handleDocClick = (docData: any) => {
    setSelectedDoc(docData);
    setContent(docData.htmlContent);
    setPreviewMode(true);
  };

  const saveDocument = async () => {
    if (!projectId || !content) return alert("Missing project or content");

    let docId = selectedDoc?.id || `${projectId}_${uuidv4()}`;
    const docRef = doc(db, "projectDocs", docId);
    const docData = {
      projectId,
      projectName,
      htmlContent: content,
      createdBy: userEmail,
      updatedAt: new Date().toISOString(),
    };

    await setDoc(docRef, docData, { merge: true });
    alert("Document saved successfully");
    setSelectedDoc({ id: docId, ...docData });
    fetchDocs(projectId);
  };

  return (
    <div className="max-w-6xl mx-auto p-4">
      <h2 className="text-2xl font-bold mb-4">
        📑 Secure Project Document Manager
      </h2>

      <ProjectSelector onSelect={handleProjectSelect} />

      {projectId && (
        <>
          {/* Document List */}
          <div className="bg-white p-3 border rounded shadow mb-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-semibold">
                Documents for {projectName}
              </h3>
              <button
                className="bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700"
                onClick={handleNewDoc}
              >
                ➕ New Document
              </button>
            </div>
            {documents.length === 0 ? (
              <p className="text-gray-500">No documents found.</p>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-auto">
                {documents.map((doc) => (
                  <li
                    key={doc.id}
                    onClick={() => handleDocClick(doc)}
                    className={`cursor-pointer border px-3 py-2 rounded hover:bg-gray-100 ${
                      selectedDoc?.id === doc.id
                        ? "bg-gray-100 font-semibold"
                        : ""
                    }`}
                  >
                    {doc.id.split("_")[1] || doc.id}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Editor or Preview */}
          <div className="mb-4 flex justify-between items-center">
            <span className="text-lg font-semibold">
              {selectedDoc ? "Edit Document" : "Create New Document"}
            </span>
            <button
              className="bg-gray-200 px-3 py-1 rounded hover:bg-gray-300"
              onClick={() => setPreviewMode((prev) => !prev)}
            >
              {previewMode ? "📝 Edit Mode" : "👁️ Preview"}
            </button>
          </div>

          {/* Preview Mode with Protection */}
          {previewMode ? (
            <div
              className="relative border p-4 bg-white rounded shadow min-h-[300px]"
              onContextMenu={(e) => e.preventDefault()}
              onCopy={(e) => e.preventDefault()}
              onCut={(e) => e.preventDefault()}
              onPaste={(e) => e.preventDefault()}
              onMouseDown={(e) => e.preventDefault()}
              style={{ userSelect: "none" }}
            >
              <div
                className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none text-center text-4xl font-bold rotate-45 z-50"
                style={{ whiteSpace: "nowrap" }}
              >
                Confidential — {userEmail}
              </div>

              <div
                className="relative z-10"
                dangerouslySetInnerHTML={{ __html: content }}
              />
            </div>
          ) : (
            <ReactQuill
              value={content}
              onChange={setContent}
              className="bg-white rounded shadow min-h-[300px]"
              placeholder="Write your document here..."
              modules={{
                toolbar: [
                  [{ header: [1, 2, 3, false] }],
                  ["bold", "italic", "underline"],
                  [{ list: "ordered" }, { list: "bullet" }],
                  ["link", "image"],
                  ["clean"],
                ],
              }}
              formats={[
                "header",
                "bold",
                "italic",
                "underline",
                "list",
                "bullet",
                "link",
                "image",
              ]}
            />
          )}

          {/* Save Button */}
          <button
            onClick={saveDocument}
            className="mt-4 px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700"
          >
            💾 Save Document
          </button>
        </>
      )}
    </div>
  );
};

export default ProjectDocManager;
