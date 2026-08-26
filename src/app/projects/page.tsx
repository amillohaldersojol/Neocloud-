"use client";
import { useState } from "react";
import Link from "next/link";
import ProjectModal from "@/components/ProjectModal";

export default function ProjectsPage() {
 const [open, setOpen] = useState(false);
   const [projects, setProjects] = useState([
  {
    id: 1,
    name: "NeoCloud AI Chat",
    status: "Active",
    updated: "2 min ago",
  },
  {
    id: 2,
    name: "Image Generator",
    status: "Development",
    updated: "15 min ago",
  },
  {
    id: 3,
    name: "Video Translator",
    status: "Planning",
    updated: "1 hour ago",
  },
]);
 return (
    <main className="min-h-screen bg-[#0F172A] text-white p-8">

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold">Projects</h1>
          <p className="text-gray-400 mt-2">
            Manage all your AI projects.
          </p>
        </div>

       <button
  onClick={() => setOpen(true)}
  className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700"
>
  + New Project
</button>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-6">

        {projects.map((project) => (

          <div
            key={project.id}
            className="rounded-2xl border border-white/10 bg-white/5 p-6 hover:border-blue-500 transition"
          >

            <h2 className="text-2xl font-semibold">
              {project.name}
            </h2>

            <p className="text-gray-400 mt-3">
              Status: {project.status}
            </p>

            <p className="text-gray-500 text-sm mt-1">
              Updated {project.updated}
            </p>

            <div className="mt-6 flex gap-3">

             <Link
  href={`/projects/${project.id}`}
  className="rounded-lg bg-green-600 px-4 py-2 hover:bg-green-700"
>
  Open
</Link>

              <button className="rounded-lg bg-yellow-600 px-4 py-2 hover:bg-yellow-700">
                Rename
              </button>

              <button className="rounded-lg bg-red-600 px-4 py-2 hover:bg-red-700">
                Delete
              </button>

            </div>

          </div>

        ))}

      </div>

      <div className="mt-10">
        <Link
          href="/dashboard"
          className="text-blue-400 hover:text-blue-300"
        >
          ← Back to Dashboard
        </Link>
      </div>
<ProjectModal
  open={open}
  onClose={() => setOpen(false)}
  onCreate={(name, description) => {
  setProjects((prev) => [
    ...prev,
    {
      id: Date.now(),
      name,
      status: "New",
      updated: "Just now",
    },
  ]);

  setOpen(false);
}}
/>
    </main>
  );
}