"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { KeyboardEvent, useEffect, useRef, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { addDoc, collection, getDocs, serverTimestamp, deleteDoc, updateDoc } from "firebase/firestore";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type AttachmentPayload = {
  name: string;
  mimeType: string;
  kind: "image" | "pdf" | "text";
  data?: string;
  text?: string;
};

type FeedbackValue = "up" | "down";

const LEGACY_CHAT_NAMES = new Set([
  "Welcome Chat",
  "Startup Ideas",
  "Investment Research",
]);

function isLegacyChatName(name: string) {
  const trimmed = name.trim();
  if (!trimmed) return true;
  if (LEGACY_CHAT_NAMES.has(trimmed)) return true;
  if (/^New Chat \d+$/i.test(trimmed)) return true;
  return false;
}

function makeBaseTitle(text: string) {
  const oneLine = text.replace(/\s+/g, " ").trim();
  if (oneLine.length <= 42) return oneLine;
  return `${oneLine.slice(0, 42).trim()}...`;
}

function CopyIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <rect x="8" y="8" width="12" height="12" rx="2" />
      <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" />
    </svg>
  );
}

function SpeakerIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M11 5 6 9H3v6h3l5 4V5Z" />
      <path d="M15 9a4 4 0 0 1 0 6" />
      <path d="M18 6a8 8 0 0 1 0 12" />
    </svg>
  );
}

function StopVoiceIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function ThumbUpIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M7 10v10" />
      <path d="M11 10 14 4a2 2 0 0 1 3 2l-1 4h4a2 2 0 0 1 2 2l-2 7a2 2 0 0 1-2 1H7V10h4Z" />
    </svg>
  );
}

function ThumbDownIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M17 14V4" />
      <path d="m13 14-3 6a2 2 0 0 1-3-2l1-4H4a2 2 0 0 1-2-2l2-7a2 2 0 0 1 2-1h11v10h-4Z" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5" />
    </svg>
  );
}

export default function AIChatLayout() {
  const [input, setInput] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [chatHistory, setChatHistory] = useState<Record<string, Message[]>>({});
  const [chats, setChats] = useState<string[]>([]);
  const [activeChat, setActiveChat] = useState("");
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [isThinking, setIsThinking] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageIndex, setSpeakingMessageIndex] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<Record<string, FeedbackValue>>({});
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedFile, setSelectedFile] = useState<AttachmentPayload | null>(null);
  const [openChatMenu, setOpenChatMenu] = useState<string | null>(null);
  const [pinnedChats, setPinnedChats] = useState<string[]>([]);
  const [liveVoiceOpen, setLiveVoiceOpen] = useState(false);
  const [liveVoiceStatus, setLiveVoiceStatus] = useState<
    "idle" | "connecting" | "listening" | "speaking" | "error"
  >("idle");
  const [liveVoiceError, setLiveVoiceError] = useState("");

  const messages = chatHistory[activeChat] || [];

  const abortControllerRef = useRef<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const keepListeningRef = useRef(false);
  const voiceBaseInputRef = useRef("");

  const livePeerRef = useRef<RTCPeerConnection | null>(null);
  const liveStreamRef = useRef<MediaStream | null>(null);
  const liveAudioRef = useRef<HTMLAudioElement | null>(null);
  const liveDataChannelRef = useRef<RTCDataChannel | null>(null);
  const liveDisconnectTimerRef = useRef<number | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => setCurrentUser(user));
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setPinnedChats([]);
      return;
    }

    try {
      const saved = localStorage.getItem(`neocloud:pinned:${currentUser.uid}`);
      setPinnedChats(saved ? JSON.parse(saved) : []);
    } catch {
      setPinnedChats([]);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;

    try {
      localStorage.setItem(
        `neocloud:pinned:${currentUser.uid}`,
        JSON.stringify(pinnedChats)
      );
    } catch {}
  }, [pinnedChats, currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setChats([]);
      setChatHistory({});
      setActiveChat("");
      setIsLoadingChats(false);
      return;
    }

    let cancelled = false;

    const loadMessages = async () => {
      setIsLoadingChats(true);
      try {
        const snapshot = await getDocs(
          collection(db, "users", currentUser.uid, "messages")
        );

        const groupedMessages: Record<string, Message[]> = {};
        const latestTimeByChat: Record<string, number> = {};

        const docs = snapshot.docs
          .map((doc) => doc.data())
          .sort((a, b) => {
            const aTime = a.createdAt?.toMillis?.() ?? 0;
            const bTime = b.createdAt?.toMillis?.() ?? 0;
            return aTime - bTime;
          });

        docs.forEach((data) => {
          const rawChatName =
            typeof data.chatName === "string" ? data.chatName.trim() : "";

          if (isLegacyChatName(rawChatName)) return;

          const message: Message = {
            role: data.role === "assistant" ? "assistant" : "user",
            content: typeof data.content === "string" ? data.content : "",
          };

          if (!groupedMessages[rawChatName]) groupedMessages[rawChatName] = [];
          groupedMessages[rawChatName].push(message);
          latestTimeByChat[rawChatName] = data.createdAt?.toMillis?.() ?? 0;
        });

        const loadedChatNames = Object.keys(groupedMessages).sort(
          (a, b) => (latestTimeByChat[b] ?? 0) - (latestTimeByChat[a] ?? 0)
        );

        if (cancelled) return;

        setChatHistory(groupedMessages);
        setChats(loadedChatNames);
        setActiveChat((previous) => {
          if (previous && groupedMessages[previous]) return previous;
          return loadedChatNames[0] || "";
        });
      } catch (error) {
        console.error("Failed to load chat history:", error);
      } finally {
        if (!cancelled) setIsLoadingChats(false);
      }
    };

    loadMessages();
    return () => {
      cancelled = true;
    };
  }, [currentUser]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, isThinking]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      keepListeningRef.current = false;
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      if (typeof window !== "undefined") window.speechSynthesis.cancel();

      liveDataChannelRef.current?.close();
      livePeerRef.current?.close();
      liveStreamRef.current?.getTracks().forEach((track) => track.stop());

      if (liveDisconnectTimerRef.current !== null) {
        window.clearTimeout(liveDisconnectTimerRef.current);
        liveDisconnectTimerRef.current = null;
      }

      if (liveAudioRef.current) {
        liveAudioRef.current.pause();
        liveAudioRef.current.srcObject = null;
      }
    };
  }, []);

  const createUniqueChatTitle = (text: string) => {
    const baseTitle = makeBaseTitle(text);
    let title = baseTitle;
    let number = 2;
    while (chats.includes(title)) {
      title = `${baseTitle} (${number})`;
      number += 1;
    }
    return title;
  };

  const stopSpeaking = () => {
    if (typeof window === "undefined") return;
    window.speechSynthesis.cancel();
    setSpeakingMessageIndex(null);
  };

  const stopListening = () => {
    keepListeningRef.current = false;
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    setIsListening(false);
  };

  const handleNewChat = () => {
    stopListening();
    stopSpeaking();
    setActiveChat("");
    setInput("");
    setSelectedFile(null);
    setSidebarOpen(false);
  };

  const speakText = (text: string, messageIndex: number) => {
    if (typeof window === "undefined") return;

    if (speakingMessageIndex === messageIndex) {
      stopSpeaking();
      return;
    }

    window.speechSynthesis.cancel();

    const speech = new SpeechSynthesisUtterance(text);
    const hasBangla = /[\u0980-\u09FF]/.test(text);
    speech.lang = hasBangla ? "bn-BD" : "en-US";
    speech.rate = 0.95;
    speech.pitch = 1;
    speech.volume = 1;

    const voices = window.speechSynthesis.getVoices();
    const preferredVoice = voices.find((voice) =>
      hasBangla
        ? voice.lang.toLowerCase().startsWith("bn")
        : voice.lang.toLowerCase().startsWith("en") &&
          (voice.name.toLowerCase().includes("natural") ||
            voice.name.toLowerCase().includes("microsoft") ||
            voice.name.toLowerCase().includes("google"))
    );

    if (preferredVoice) speech.voice = preferredVoice;

    speech.onend = () => setSpeakingMessageIndex(null);
    speech.onerror = () => setSpeakingMessageIndex(null);

    setSpeakingMessageIndex(messageIndex);
    window.speechSynthesis.speak(speech);
  };

  const cancelListening = () => {
    stopListening();
    setInput(voiceBaseInputRef.current.trimEnd());
  };

  const startListening = () => {
    if (typeof window === "undefined") return;

    if (isListening) {
      stopListening();
      return;
    }

    stopSpeaking();

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      alert("Voice input is not supported in this browser.");
      return;
    }

    voiceBaseInputRef.current = input.trim() ? `${input.trim()} ` : "";
    keepListeningRef.current = true;

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: any) => {
      let transcript = "";
      for (let index = 0; index < event.results.length; index += 1) {
        transcript += event.results[index][0].transcript;
      }
      setInput(`${voiceBaseInputRef.current}${transcript}`.trimStart());
    };

    recognition.onerror = (event: any) => {
      if (event?.error !== "no-speech") {
        console.error("Speech recognition error:", event?.error);
      }
    };

    recognition.onend = () => {
      if (keepListeningRef.current) {
        window.setTimeout(() => {
          try { recognition.start(); } catch {}
        }, 250);
      } else {
        setIsListening(false);
      }
    };

    recognition.start();
  };

  const stopGenerating = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    setIsThinking(false);
    setIsGenerating(false);
  };

  const stopLiveVoice = () => {
    if (liveDisconnectTimerRef.current !== null) {
      window.clearTimeout(liveDisconnectTimerRef.current);
      liveDisconnectTimerRef.current = null;
    }

    liveDataChannelRef.current?.close();
    liveDataChannelRef.current = null;

    livePeerRef.current?.close();
    livePeerRef.current = null;

    liveStreamRef.current?.getTracks().forEach((track) => track.stop());
    liveStreamRef.current = null;

    if (liveAudioRef.current) {
      liveAudioRef.current.pause();
      liveAudioRef.current.srcObject = null;
    }

    liveAudioRef.current = null;
    setLiveVoiceStatus("idle");
    setLiveVoiceError("");
    setLiveVoiceOpen(false);
  };

  const interruptLiveVoice = () => {
    const channel = liveDataChannelRef.current;

    if (!channel || channel.readyState !== "open") return;

    channel.send(JSON.stringify({ type: "response.cancel" }));
    channel.send(JSON.stringify({ type: "output_audio_buffer.clear" }));
    setLiveVoiceStatus("listening");
  };

  const startLiveVoice = async () => {
    if (liveVoiceStatus === "connecting") return;

    setLiveVoiceOpen(true);
    setLiveVoiceStatus("connecting");
    setLiveVoiceError("");

    try {
      stopListening();
      stopSpeaking();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });

      liveStreamRef.current = stream;

      const peer = new RTCPeerConnection();
      livePeerRef.current = peer;

      const audio = document.createElement("audio");
      audio.autoplay = true;
      liveAudioRef.current = audio;

      peer.ontrack = (event) => {
        const [remoteStream] = event.streams;

        if (remoteStream) {
          audio.srcObject = remoteStream;
          void audio.play().catch(() => {});
        }
      };

      stream.getTracks().forEach((track) => {
        peer.addTrack(track, stream);
      });

      const channel = peer.createDataChannel("oai-events");
      liveDataChannelRef.current = channel;

      channel.onopen = () => {
        setLiveVoiceStatus("listening");
      };

      channel.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          if (data.type === "output_audio_buffer.cleared") {
            setLiveVoiceStatus("listening");
          }

          if (
            data.type === "response.created" ||
            data.type === "output_audio_buffer.started"
          ) {
            setLiveVoiceStatus("speaking");
          }

          if (data.type === "output_audio_buffer.stopped") {
            setLiveVoiceStatus("listening");
          }

          if (data.type === "error") {
            const realtimeMessage =
              typeof data?.error?.message === "string"
                ? data.error.message.trim()
                : "";

            // Some Realtime events can surface an empty error object in dev.
            // Ignore empty/non-actionable error payloads so Next.js does not
            // show a development overlay while the voice session is working.
            if (!realtimeMessage) {
              console.warn("Realtime returned an empty error event.");
              return;
            }

            console.warn("Realtime voice warning:", realtimeMessage);
            setLiveVoiceError(realtimeMessage);
            setLiveVoiceStatus("error");
          }
        } catch {}
      };

      channel.onerror = () => {
        console.warn("Realtime data channel reported an error.");
      };

      peer.onconnectionstatechange = () => {
        const state = peer.connectionState;

        if (state === "connected") {
          if (liveDisconnectTimerRef.current !== null) {
            window.clearTimeout(liveDisconnectTimerRef.current);
            liveDisconnectTimerRef.current = null;
          }

          if (liveVoiceStatus === "error") {
            setLiveVoiceError("");
            setLiveVoiceStatus("listening");
          }

          return;
        }

        if (state === "disconnected") {
          // WebRTC can briefly enter "disconnected" during a network wobble.
          // Give it a short recovery window before showing Voice unavailable.
          if (liveDisconnectTimerRef.current !== null) {
            window.clearTimeout(liveDisconnectTimerRef.current);
          }

          liveDisconnectTimerRef.current = window.setTimeout(() => {
            if (
              peer.connectionState === "disconnected" ||
              peer.connectionState === "failed"
            ) {
              setLiveVoiceError("Voice connection was interrupted.");
              setLiveVoiceStatus("error");
            }
          }, 5000);

          return;
        }

        if (state === "failed") {
          if (liveDisconnectTimerRef.current !== null) {
            window.clearTimeout(liveDisconnectTimerRef.current);
            liveDisconnectTimerRef.current = null;
          }

          setLiveVoiceError("Voice connection failed.");
          setLiveVoiceStatus("error");
        }
      };

      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);

      const response = await fetch("/api/realtime-call", {
        method: "POST",
        headers: {
          "Content-Type": "application/sdp",
        },
        body: offer.sdp,
      });

      const answerSdp = await response.text();

      if (!response.ok) {
        throw new Error(answerSdp || "Could not start Live Voice.");
      }

      await peer.setRemoteDescription({
        type: "answer",
        sdp: answerSdp,
      });
    } catch (error) {
      console.error("Live Voice start error:", error);

      liveDataChannelRef.current?.close();
      livePeerRef.current?.close();
      liveStreamRef.current?.getTracks().forEach((track) => track.stop());

      liveDataChannelRef.current = null;
      livePeerRef.current = null;
      liveStreamRef.current = null;

      setLiveVoiceError(
        error instanceof Error
          ? error.message
          : "Could not start Live Voice."
      );
      setLiveVoiceStatus("error");
    }
  };

  const readFileForAI = async (file: File): Promise<AttachmentPayload> => {
    const maxSize = 25 * 1024 * 1024;
    if (file.size > maxSize) {
      throw new Error("File is too large. Please choose a file under 25 MB.");
    }

    const mimeType = file.type || "application/octet-stream";
    const lowerName = file.name.toLowerCase();

    if (
      mimeType.startsWith("image/") ||
      /\.(png|jpe?g|webp|gif)$/i.test(lowerName)
    ) {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      return {
        name: file.name,
        mimeType,
        kind: "image",
        data,
      };
    }

    if (mimeType === "application/pdf" || lowerName.endsWith(".pdf")) {
      const data = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(file);
      });

      return {
        name: file.name,
        mimeType: "application/pdf",
        kind: "pdf",
        data,
      };
    }

    if (
      mimeType.startsWith("text/") ||
      /\.(txt|md|csv|json|js|ts|tsx|jsx|css|html|py)$/i.test(lowerName)
    ) {
      const text = await file.text();

      return {
        name: file.name,
        mimeType,
        kind: "text",
        text: text.slice(0, 120000),
      };
    }

    throw new Error(
      "For now, upload an image, PDF, TXT, MD, CSV, JSON, code, or other text file."
    );
  };

  const handleSend = async () => {
    const typedText = input.trim();
    const text =
      typedText ||
      (selectedFile
        ? `Please analyze the attached file: ${selectedFile.name}`
        : "");

    if (!text || isGenerating) return;

    stopListening();

    const currentChatName = activeChat || createUniqueChatTitle(text);

    if (!activeChat) {
      setActiveChat(currentChatName);
      setChats((previous) => [
        currentChatName,
        ...previous.filter((chat) => chat !== currentChatName),
      ]);
      setChatHistory((previous) => ({
        ...previous,
        [currentChatName]: previous[currentChatName] || [],
      }));
    }

    const userMessage: Message = {
      role: "user",
      content: text,
    };

    setChatHistory((previous) => ({
      ...previous,
      [currentChatName]: [
        ...(previous[currentChatName] || []),
        userMessage,
      ],
    }));

    setInput("");
    setIsThinking(true);
    setIsGenerating(true);

    if (currentUser) {
      try {
        await addDoc(
          collection(db, "users", currentUser.uid, "messages"),
          {
            content: text,
            role: "user",
            chatName: currentChatName,
            createdAt: serverTimestamp(),
          }
        );
      } catch (error) {
        console.error("Firestore user save error:", error);
      }
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            ...(chatHistory[currentChatName] || []),
            userMessage,
          ].slice(-20),
          attachment: selectedFile,
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || "AI request failed");
      }

      const reader = response.body?.getReader();

      if (!reader) {
        throw new Error("No response stream");
      }

      const decoder = new TextDecoder();
      let fullText = "";
      let firstChunkReceived = false;

      setChatHistory((previous) => ({
        ...previous,
        [currentChatName]: [
          ...(previous[currentChatName] || []),
          {
            role: "assistant",
            content: "",
          },
        ],
      }));

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        if (!chunk) continue;

        fullText += chunk;

        if (!firstChunkReceived) {
          firstChunkReceived = true;
          setIsThinking(false);
        }

        setChatHistory((previous) => {
          const currentMessages = [
            ...(previous[currentChatName] || []),
          ];

          const lastIndex = currentMessages.length - 1;

          if (lastIndex >= 0) {
            currentMessages[lastIndex] = {
              role: "assistant",
              content: fullText,
            };
          }

          return {
            ...previous,
            [currentChatName]: currentMessages,
          };
        });
      }

      if (currentUser && fullText) {
        try {
          await addDoc(
            collection(db, "users", currentUser.uid, "messages"),
            {
              content: fullText,
              role: "assistant",
              chatName: currentChatName,
              createdAt: serverTimestamp(),
            }
          );
        } catch (error) {
          console.error("Firestore assistant save error:", error);
        }
      }
    } catch (error: any) {
      if (error?.name !== "AbortError") {
        console.error("AI request error:", error);
      }
    } finally {
      abortControllerRef.current = null;
      setIsThinking(false);
      setIsGenerating(false);
      setSelectedFile(null);
    }
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLTextAreaElement>
  ) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSend();
    }
  };

  const handleShare = async (text: string) => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "NeoCloud AI",
          text,
        });
        return;
      }

      await navigator.clipboard.writeText(text);
    } catch {}
  };

  const selectFeedback = (
    messageIndex: number,
    value: FeedbackValue
  ) => {
    const key = `${activeChat}:${messageIndex}`;

    setFeedback((previous) => {
      if (previous[key] === value) {
        const copy = { ...previous };
        delete copy[key];
        return copy;
      }

      return {
        ...previous,
        [key]: value,
      };
    });
  };

  const togglePinChat = (chat: string) => {
    setPinnedChats((previous) =>
      previous.includes(chat)
        ? previous.filter((item) => item !== chat)
        : [chat, ...previous]
    );
    setOpenChatMenu(null);
  };

  const renameChat = async (chat: string) => {
    if (!currentUser) return;

    const nextName = window.prompt("Rename chat", chat)?.trim();

    if (!nextName || nextName === chat) {
      setOpenChatMenu(null);
      return;
    }

    if (chats.includes(nextName)) {
      alert("A chat with this name already exists.");
      return;
    }

    try {
      const snapshot = await getDocs(
        collection(db, "users", currentUser.uid, "messages")
      );

      const matchingDocs = snapshot.docs.filter(
        (doc) => doc.data().chatName === chat
      );

      await Promise.all(
        matchingDocs.map((doc) =>
          updateDoc(doc.ref, {
            chatName: nextName,
          })
        )
      );

      setChatHistory((previous) => {
        const next = { ...previous };
        next[nextName] = next[chat] || [];
        delete next[chat];
        return next;
      });

      setChats((previous) =>
        previous.map((item) => (item === chat ? nextName : item))
      );

      setPinnedChats((previous) =>
        previous.map((item) => (item === chat ? nextName : item))
      );

      if (activeChat === chat) {
        setActiveChat(nextName);
      }
    } catch (error) {
      console.error("Rename chat error:", error);
      alert("Could not rename this chat.");
    } finally {
      setOpenChatMenu(null);
    }
  };

  const deleteChat = async (chat: string) => {
    if (!currentUser) return;

    const confirmed = window.confirm(`Delete "${chat}"?`);

    if (!confirmed) {
      setOpenChatMenu(null);
      return;
    }

    try {
      const snapshot = await getDocs(
        collection(db, "users", currentUser.uid, "messages")
      );

      const matchingDocs = snapshot.docs.filter(
        (doc) => doc.data().chatName === chat
      );

      await Promise.all(
        matchingDocs.map((doc) => deleteDoc(doc.ref))
      );

      setChatHistory((previous) => {
        const next = { ...previous };
        delete next[chat];
        return next;
      });

      setChats((previous) =>
        previous.filter((item) => item !== chat)
      );

      setPinnedChats((previous) =>
        previous.filter((item) => item !== chat)
      );

      if (activeChat === chat) {
        setActiveChat("");
      }
    } catch (error) {
      console.error("Delete chat error:", error);
      alert("Could not delete this chat.");
    } finally {
      setOpenChatMenu(null);
    }
  };

  const pinnedVisibleChats = pinnedChats.filter((chat) =>
    chats.includes(chat)
  );

  const recentChats = chats.filter(
    (chat) => !pinnedVisibleChats.includes(chat)
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#111111] text-[#f2f2f2]">
      {sidebarOpen && (
        <button
          type="button"
          aria-label="Close sidebar overlay"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 md:hidden"
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-[270px] flex-col border-r border-white/5 bg-[#171717] transition-transform duration-200 md:static md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="p-3">
          <button
            type="button"
            onClick={handleNewChat}
            className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition hover:bg-white/10"
          >
            <span className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/15 text-lg">
              +
            </span>
            <span>New chat</span>
          </button>
        </div>

        {pinnedVisibleChats.length > 0 && (
          <>
            <div className="px-4 pb-2 pt-3 text-xs font-medium text-white/40">
              Pinned
            </div>

            <div className="space-y-1 px-2">
              {pinnedVisibleChats.map((chat) => (
                <div
                  key={chat}
                  className={`group relative flex items-center rounded-lg ${
                    activeChat === chat
                      ? "bg-white/10"
                      : "hover:bg-white/[0.07]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChat(chat);
                      setSidebarOpen(false);
                    }}
                    className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-white/75"
                    title={chat}
                  >
                    📌 {chat}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setOpenChatMenu(
                        openChatMenu === chat ? null : chat
                      )
                    }
                    className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/35 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                    title="Chat options"
                  >
                    ⋯
                  </button>

                  {openChatMenu === chat && (
                    <div className="absolute right-1 top-9 z-50 w-40 rounded-xl border border-white/10 bg-[#242424] p-1 shadow-2xl">
                      <button
                        type="button"
                        onClick={() => renameChat(chat)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePinChat(chat)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                      >
                        Unpin
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteChat(chat)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="px-4 pb-2 pt-5 text-xs font-medium text-white/40">
          Recent
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {isLoadingChats ? (
            <div className="px-3 py-3 text-sm text-white/35">
              Loading chats...
            </div>
          ) : recentChats.length === 0 &&
            pinnedVisibleChats.length === 0 ? (
            <div className="px-3 py-3 text-sm leading-6 text-white/35">
              Your conversations will appear here.
            </div>
          ) : (
            <div className="space-y-1">
              {recentChats.map((chat) => (
                <div
                  key={chat}
                  className={`group relative flex items-center rounded-lg ${
                    activeChat === chat
                      ? "bg-white/10"
                      : "hover:bg-white/[0.07]"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setActiveChat(chat);
                      setSidebarOpen(false);
                    }}
                    className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm text-white/75"
                    title={chat}
                  >
                    {chat}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setOpenChatMenu(
                        openChatMenu === chat ? null : chat
                      )
                    }
                    className="mr-1 flex h-8 w-8 items-center justify-center rounded-lg text-white/35 opacity-0 transition hover:bg-white/10 hover:text-white group-hover:opacity-100"
                    title="Chat options"
                  >
                    ⋯
                  </button>

                  {openChatMenu === chat && (
                    <div className="absolute right-1 top-9 z-50 w-40 rounded-xl border border-white/10 bg-[#242424] p-1 shadow-2xl">
                      <button
                        type="button"
                        onClick={() => renameChat(chat)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePinChat(chat)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10"
                      >
                        Pin
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteChat(chat)}
                        className="w-full rounded-lg px-3 py-2 text-left text-sm text-red-300 hover:bg-red-500/10"
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="border-t border-white/5 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2 text-sm text-white/70">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 font-semibold">
              N
            </div>
            <div className="min-w-0">
              <div className="truncate font-medium text-white/85">
                NeoCloud
              </div>
              <div className="text-xs text-white/35">
                AI workspace
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-white/5 px-3 md:px-5">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-lg text-xl text-white/70 hover:bg-white/10 md:hidden"
            aria-label="Open sidebar"
          >
            ☰
          </button>

          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-white/90">
              {activeChat || "NeoCloud AI"}
            </div>
          </div>

          <button
            type="button"
            onClick={startLiveVoice}
            className="flex h-9 items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 text-xs font-medium text-white/80 transition hover:bg-white/10 hover:text-white"
            title="Start Live Voice"
          >
            <span className="relative flex h-2.5 w-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-40" />
              <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-400" />
            </span>
            Voice
          </button>
        </header>

        <section className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-4 pb-40 pt-8 md:px-8">
            {messages.length === 0 && !isThinking ? (
              <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/10 text-xl font-semibold">
                  N
                </div>
                <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
                  How can I help you today?
                </h1>
                <p className="mt-3 max-w-md text-sm leading-6 text-white/45">
                  Ask NeoCloud anything. Your new conversation will
                  automatically appear in the sidebar.
                </p>
              </div>
            ) : (
              <div className="space-y-7">
                {messages.map((message, index) => {
                  const feedbackKey = `${activeChat}:${index}`;
                  const selectedFeedback = feedback[feedbackKey];

                  if (message.role === "user") {
                    return (
                      <div key={index} className="flex justify-end">
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-3xl bg-[#2f2f2f] px-4 py-2.5 text-[15px] leading-6 text-white md:max-w-[75%]">
                          {message.content}
                        </div>
                      </div>
                    );
                  }

                  return (
                    <div key={index} className="group">
                      <div className="text-[15px] leading-7 text-white/90">
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            h1: ({ children }) => (
                              <h1 className="mb-3 mt-6 text-2xl font-bold">
                                {children}
                              </h1>
                            ),
                            h2: ({ children }) => (
                              <h2 className="mb-3 mt-6 text-xl font-semibold">
                                {children}
                              </h2>
                            ),
                            h3: ({ children }) => (
                              <h3 className="mb-2 mt-5 text-lg font-semibold">
                                {children}
                              </h3>
                            ),
                            p: ({ children }) => (
                              <p className="mb-4 leading-7">
                                {children}
                              </p>
                            ),
                            ul: ({ children }) => (
                              <ul className="mb-4 list-disc space-y-2 pl-6">
                                {children}
                              </ul>
                            ),
                            ol: ({ children }) => (
                              <ol className="mb-4 list-decimal space-y-2 pl-6">
                                {children}
                              </ol>
                            ),
                            li: ({ children }) => (
                              <li className="pl-1 leading-7">
                                {children}
                              </li>
                            ),
                            strong: ({ children }) => (
                              <strong className="font-semibold text-white">
                                {children}
                              </strong>
                            ),
                            blockquote: ({ children }) => (
                              <blockquote className="my-4 border-l-2 border-white/25 pl-4 text-white/65">
                                {children}
                              </blockquote>
                            ),
                            pre: ({ children }) => (
                              <pre className="my-4 overflow-x-auto rounded-xl border border-white/10 bg-black/30 p-4 text-sm">
                                {children}
                              </pre>
                            ),
                            code: ({ children }) => (
                              <code className="rounded bg-white/10 px-1 py-0.5 font-mono text-[13px]">
                                {children}
                              </code>
                            ),
                          }}
                        >
                          {message.content}
                        </ReactMarkdown>
                      </div>

                      {message.content && (
                        <div className="mt-1 flex items-center gap-1 text-white/35">
                          <button
                            type="button"
                            onClick={() =>
                              navigator.clipboard.writeText(message.content)
                            }
                            className="rounded-lg p-2 transition hover:bg-white/10 hover:text-white"
                            title="Copy"
                          >
                            <CopyIcon />
                          </button>

                          <button
                            type="button"
                            onClick={() => speakText(message.content, index)}
                            className={`rounded-lg p-2 transition hover:bg-white/10 hover:text-white ${
                              speakingMessageIndex === index ? "text-white" : ""
                            }`}
                            title={
                              speakingMessageIndex === index
                                ? "Stop reading"
                                : "Read aloud"
                            }
                          >
                            {speakingMessageIndex === index ? (
                              <StopVoiceIcon />
                            ) : (
                              <SpeakerIcon />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => selectFeedback(index, "up")}
                            className={`rounded-lg p-2 transition hover:bg-white/10 hover:text-white ${
                              selectedFeedback === "up"
                                ? "bg-white/10 text-white"
                                : ""
                            }`}
                            title="Good response"
                          >
                            <ThumbUpIcon />
                          </button>

                          <button
                            type="button"
                            onClick={() => selectFeedback(index, "down")}
                            className={`rounded-lg p-2 transition hover:bg-white/10 hover:text-white ${
                              selectedFeedback === "down"
                                ? "bg-white/10 text-white"
                                : ""
                            }`}
                            title="Bad response"
                          >
                            <ThumbDownIcon />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleShare(message.content)}
                            className="rounded-lg p-2 transition hover:bg-white/10 hover:text-white"
                            title="Share"
                          >
                            <ShareIcon />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}

                {isThinking && (
                  <div className="flex items-center gap-2 py-2 text-sm text-white/45">
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45 [animation-delay:120ms]" />
                    <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-white/45 [animation-delay:240ms]" />
                    <span className="ml-1 animate-pulse">
                      NeoCloud is thinking
                    </span>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>
            )}
          </div>
        </section>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#111111] via-[#111111] to-transparent px-3 pb-4 pt-12 md:px-6">
          <div className="pointer-events-auto mx-auto w-full max-w-3xl">
            {selectedFile && (
              <div className="mb-2 inline-flex max-w-full items-center gap-2 rounded-xl border border-white/10 bg-[#242424] px-3 py-2 text-xs text-white/65">
                <span className="truncate">{selectedFile.name}</span>
                <button
                  type="button"
                 onClick={() => setSelectedFile(null)}
                  className="text-white/40 hover:text-white"
                  aria-label="Remove selected file"
                >
                  ×
                </button>
              </div>
            )}

            <div className="rounded-[26px] border border-white/10 bg-[#2a2a2a] p-2 shadow-2xl shadow-black/20">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={handleKeyDown}
                rows={1}
                placeholder={isListening ? "Listening..." : "Ask NeoCloud anything"}
                className="max-h-40 min-h-[46px] w-full resize-none bg-transparent px-3 py-3 text-[15px] leading-6 text-white outline-none placeholder:text-white/35"
              />

              <div className="flex items-center justify-between gap-2 px-1 pb-1">
                <div className="flex min-w-0 items-center gap-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept="image/*,.pdf,.txt,.md,.csv,.json,.js,.ts,.tsx,.jsx,.css,.html,.py,text/*"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];

                      if (!file) {
                        setSelectedFile(null);
                        return;
                      }

                      try {
                        const prepared = await readFileForAI(file);
                        setSelectedFile(prepared);
                      } catch (error) {
                        console.error("File preparation error:", error);
                        alert(
                          error instanceof Error
                            ? error.message
                            : "Could not prepare this file."
                        );
                        setSelectedFile(null);
                      } finally {
                        event.target.value = "";
                      }
                    }}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xl text-white/65 transition hover:bg-white/10 hover:text-white"
                    title="Attach file"
                  >
                    +
                  </button>

                  {isListening ? (
                    <div className="flex min-w-0 items-center gap-1">
                      <div className="flex h-9 items-center gap-2 rounded-full bg-red-500/10 px-3 text-xs font-medium text-red-300">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-red-400" />
                        <span>Listening</span>
                      </div>

                      <button
                        type="button"
                        onClick={cancelListening}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-lg text-white/55 hover:bg-white/10 hover:text-white"
                        title="Cancel voice input"
                      >
                        ×
                      </button>

                      <button
                        type="button"
                        onClick={stopListening}
                        className="flex h-9 items-center gap-2 rounded-full bg-white/10 px-3 text-xs font-medium text-white/80 hover:bg-white/15"
                        title="Finish voice input"
                      >
                        <span className="h-2.5 w-2.5 rounded-[2px] bg-current" />
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={startListening}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white"
                        title="Voice input"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <rect x="9" y="3" width="6" height="11" rx="3" />
                          <path d="M5 11a7 7 0 0 0 14 0" />
                          <path d="M12 18v3" />
                        </svg>
                      </button>

                      <button
                        type="button"
                        onClick={startLiveVoice}
                        className="flex h-9 w-9 items-center justify-center rounded-full text-white/65 transition hover:bg-white/10 hover:text-white"
                        title="Live Voice"
                      >
                        <svg
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.8"
                        >
                          <path d="M4 12a8 8 0 0 1 16 0" />
                          <rect x="3.5" y="12" width="4" height="6" rx="2" />
                          <rect x="16.5" y="12" width="4" height="6" rx="2" />
                          <path d="M18 18c0 2-2 3-4 3h-2" />
                        </svg>
                      </button>
                    </>
                  )}
                </div>

                {isGenerating ? (
                  <button
                    type="button"
                    onClick={stopGenerating}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition hover:bg-white/85"
                    title="Stop generating"
                  >
                    <span className="h-3 w-3 rounded-[2px] bg-black" />
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSend}
                    disabled={!input.trim() && !selectedFile}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-lg font-semibold text-black transition hover:bg-white/85 disabled:cursor-not-allowed disabled:bg-white/20 disabled:text-white/35"
                    title="Send"
                  >
                    ↑
                  </button>
                )}
              </div>
            </div>

            <p className="mt-2 text-center text-[11px] text-white/25">
              NeoCloud can make mistakes. Check important information.
            </p>
          </div>
        </div>

        {liveVoiceOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xl">
            <div className="relative flex min-h-[520px] w-full max-w-lg flex-col items-center justify-between overflow-hidden rounded-[32px] border border-white/10 bg-[#171717] p-6 shadow-2xl">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(59,130,246,0.18),transparent_42%)]" />

              <div className="relative z-10 flex w-full items-center justify-between">
                <div>
                  <div className="text-sm font-semibold text-white/90">
                    NeoCloud Live Voice
                  </div>
                  <div className="mt-1 text-xs text-white/40">
                    Speak naturally in your language
                  </div>
                </div>

                <button
                  type="button"
                  onClick={stopLiveVoice}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-xl text-white/70 transition hover:bg-white/15 hover:text-white"
                  title="Close Live Voice"
                >
                  ×
                </button>
              </div>

              <div className="relative z-10 flex flex-1 flex-col items-center justify-center">
                <div
                  className={`relative flex h-40 w-40 items-center justify-center rounded-full border transition-all duration-500 ${
                    liveVoiceStatus === "speaking"
                      ? "scale-110 border-blue-400/40 bg-blue-500/20 shadow-[0_0_90px_rgba(59,130,246,0.28)]"
                      : liveVoiceStatus === "listening"
                      ? "border-emerald-400/30 bg-emerald-500/10 shadow-[0_0_70px_rgba(16,185,129,0.16)]"
                      : "border-white/10 bg-white/[0.04]"
                  }`}
                >
                  {liveVoiceStatus === "speaking" && (
                    <span className="absolute inset-3 animate-ping rounded-full border border-blue-400/25" />
                  )}

                  <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/10 text-4xl font-semibold">
                    N
                  </div>
                </div>

                <div className="mt-8 text-center">
                  <div className="text-xl font-semibold">
                    {liveVoiceStatus === "connecting" && "Connecting..."}
                    {liveVoiceStatus === "listening" && "Listening"}
                    {liveVoiceStatus === "speaking" && "NeoCloud is speaking"}
                    {liveVoiceStatus === "error" && "Voice unavailable"}
                    {liveVoiceStatus === "idle" && "Live Voice"}
                  </div>

                  <div className="mt-2 max-w-sm text-sm leading-6 text-white/45">
                    {liveVoiceStatus === "connecting" &&
                      "Please allow microphone access if your browser asks."}
                    {liveVoiceStatus === "listening" &&
                      "Talk normally. NeoCloud will respond when you finish your thought."}
                    {liveVoiceStatus === "speaking" &&
                      "NeoCloud is speaking. Use Interrupt if you want to stop the answer."}
                    {liveVoiceStatus === "error" &&
                      (liveVoiceError || "Something went wrong with the voice connection.")}
                  </div>
                </div>
              </div>

              <div className="relative z-10 flex w-full items-center justify-center gap-3">
                {liveVoiceStatus === "speaking" && (
                  <button
                    type="button"
                    onClick={interruptLiveVoice}
                    className="rounded-full bg-white/10 px-5 py-3 text-sm font-medium text-white/80 transition hover:bg-white/15"
                  >
                    Interrupt
                  </button>
                )}

                {liveVoiceStatus === "error" && (
                  <button
                    type="button"
                    onClick={startLiveVoice}
                    className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-white/85"
                  >
                    Try again
                  </button>
                )}

                <button
                  type="button"
                  onClick={stopLiveVoice}
                  className="rounded-full bg-red-500/15 px-5 py-3 text-sm font-medium text-red-300 transition hover:bg-red-500/20"
                >
                  End voice
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}