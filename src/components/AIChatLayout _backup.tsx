"use client";

import { useState } from "react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function AIChatLayout() {
  const [input, setInput] = useState("");

  const [messages, setMessages] = useState<Message[]>([

    {
      role: "assistant",
      content: "👋 Hello! I'm NeoCloud AI. How can I help you today?",
    },
  ]);
const [chats, setChats] = useState([
  "Welcome Chat",
  "Startup Ideas",
  "Investment Research",
]);

const [activeChat, setActiveChat] = useState("Welcome Chat");
  const [chatHistory, setChatHistory] = useState<Record<string, Message[]>>({
  "Welcome Chat": [
    {
      role: "assistant",
      content: "👋 Hello! I'm NeoCloud AI. How can I help you today?",
    },
  ],
});
const handleSend = () => {
    const text = input.trim();

    if (!text) return;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: text,
      },
      {
        role: "assistant",
        content: `Demo AI: You wrote "${text}"`,
      },
    ]);

    setInput("");
  };

  const handleKeyDown = (
    event: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (event.key === "Enter") {
      event.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-screen bg-[#0F172A] text-white">
      <aside className="w-72 border-r border-white/10 bg-black/20 p-5">
        <button
          type="button"
         onClick={() => {
  const newChat = `New Chat ${chats.length + 1}`;
  setChats([...chats, newChat]);
  setActiveChat(newChat);
}}
          className="w-full rounded-xl bg-blue-600 py-3 font-semibold hover:bg-blue-700"
        >
          + New Chat
        </button>

     <div className="mt-8 space-y-3">
  {chats.map((chat) => (
    <div
      key={chat}
      onClick={() => setActiveChat(chat)}
      className={`rounded-xl p-3 cursor-pointer ${
        activeChat === chat
          ? "bg-white/10"
          : "bg-white/5 hover:bg-white/10"
      }`}
    >
      💬 {chat}
    </div>
  ))}
</div>
      </aside>

      <main className="flex flex-1 flex-col">
        <header className="border-b border-white/10 p-6">
          <h1 className="text-3xl font-bold">
            NeoCloud AI
          </h1>

          <p className="mt-2 text-gray-400">
            Your intelligent AI workspace
          </p>
        </header>

        <section className="flex-1 space-y-4 overflow-y-auto p-6">
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`max-w-xl rounded-2xl p-4 ${
                message.role === "user"
                  ? "ml-auto bg-blue-600"
                  : "bg-white/10"
              }`}
            >
              {message.content}
            </div>
          ))}
        </section>

        <footer className="border-t border-white/10 p-6">
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask NeoCloud AI anything..."
              className="flex-1 rounded-xl border border-white/10 bg-white/10 px-4 py-3 outline-none"
            />

            <button
              type="button"
              onClick={handleSend}
              className="rounded-xl bg-blue-600 px-6 py-3 font-semibold hover:bg-blue-700"
            >
              Send
            </button>
          </div>
        </footer>
      </main>
    </div>
  );
}