"use client";

import { useState } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string) => void;
};

export default function ProjectModal({
  open,
  onClose,
  onCreate,
}: Props) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="w-[500px] rounded-2xl bg-[#151A24] p-6 border border-white/10">
        <h2 className="text-2xl font-bold text-white mb-5">
          Create New Project
        </h2>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Project Name"
          className="w-full mb-4 rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white"
        />

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Project Description"
          className="w-full h-32 rounded-xl bg-black/30 border border-white/10 px-4 py-3 text-white"
        />

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="rounded-xl bg-gray-600 px-5 py-2 text-white"
          >
            Cancel
          </button>

          <button
            onClick={() => {
              onCreate(name, description);
              setName("");
              setDescription("");
            }}
            className="rounded-xl bg-blue-600 px-5 py-2 text-white"
          >
            Create Project
          </button>
        </div>
      </div>
    </div>
  );
}