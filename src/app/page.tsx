"use client";

import React, { useState, useRef, useEffect } from "react";
import * as webllm from "@mlc-ai/web-llm";

// Message type for chat
interface Message {
  role: "user" | "bot" | "code";
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const engineRef = useRef<webllm.MLCEngineInterface | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Add mode state
  const [mode, setMode] = useState<"answer" | "chatbot">("answer");

  // State for Answer mode
  const [answerCode, setAnswerCode] = useState("");
  const [answerQuestion, setAnswerQuestion] = useState("");
  const [answerResult, setAnswerResult] = useState("");
  const [answerLoading, setAnswerLoading] = useState(false);
  const [answerError, setAnswerError] = useState<string | null>(null);

  const [showGpuTip, setShowGpuTip] = useState(false);

  const addDebugInfo = (info: string) => {
    setDebugInfo((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${info}`,
    ]);
  };

  // Scroll to bottom on new message
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Initialize WebLLM on mount
  useEffect(() => {
    let isMounted = true;
    async function initLLM() {
      try {
        addDebugInfo("Starting LLM initialization...");
        const modelId = "TinyLlama-1.1B-Chat-v1.0-q4f32_1-MLC";
        addDebugInfo(`Loading model: ${modelId}`);
        const engine = await webllm.CreateMLCEngine(modelId);
        if (isMounted) {
          engineRef.current = engine;
          setLlmReady(true);
          addDebugInfo("LLM initialized successfully!");
        }
      } catch (err: unknown) {
        addDebugInfo(`LLM initialization failed: ${err}`);
        if (err instanceof Error) {
          setLlmError("Failed to load LLM: " + err.message);
        } else {
          setLlmError("Failed to load LLM: Unknown error");
        }
      }
    }
    initLLM();
    return () => {
      isMounted = false;
      engineRef.current = null;
    };
  }, []);

  // Drag and drop handler for code
  const handleDrop = (
    e: React.DragEvent<HTMLTextAreaElement | HTMLDivElement>
  ) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const code = event.target?.result as string;
        setMessages((prev) => [...prev, { role: "code", content: code }]);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (
    e: React.DragEvent<HTMLTextAreaElement | HTMLDivElement>
  ) => {
    e.preventDefault();
  };

  // Send user message
  const handleSend = async () => {
    if (!input.trim()) return;
    setMessages((prev) => [...prev, { role: "user", content: input }]);
    setInput("");
    setLoading(true);
    setLlmError(null);
    addDebugInfo("Starting chat request...");
    try {
      if (!engineRef.current) {
        throw new Error("LLM not ready");
      }
      // Gather all code blocks and user messages for context
      const codeBlocks = messages
        .filter((m) => m.role === "code")
        .map((m) => m.content)
        .join("\n\n");
      const userMessages = messages
        .filter((m) => m.role === "user")
        .map((m) => m.content)
        .join("\n\n");
      const prompt = `Given the following code:\n\n${codeBlocks}\n\nAnd the conversation:\n${userMessages}\nUser: ${input}\n\nAnswer:`;
      addDebugInfo(`Sending prompt (${prompt.length} chars)`);
      // Add a placeholder bot message for streaming
      setMessages((prev) => [...prev, { role: "bot", content: "" }]);
      let reply = "";
      const chunks = await engineRef.current.chat.completions.create({
        messages: [
          { role: "system", content: "You are a helpful code assistant." },
          { role: "user", content: prompt },
        ],
        stream: true,
        temperature: 0.7,
        max_tokens: 1000,
      });
      let firstChunk = true;
      for await (const chunk of chunks) {
        reply += chunk.choices?.[0]?.delta?.content || "";
        // Update the last bot message with the current reply
        setMessages((prev) => {
          const updated = [...prev];
          // Only update the last bot message
          for (let i = updated.length - 1; i >= 0; i--) {
            if (updated[i].role === "bot") {
              updated[i] = { ...updated[i], content: reply };
              break;
            }
          }
          return updated;
        });
        if (firstChunk) {
          addDebugInfo("Streaming response started...");
          firstChunk = false;
        }
      }
      addDebugInfo("Streaming response completed.");
    } catch (err: unknown) {
      addDebugInfo(`Error during chat: ${err}`);
      if (err instanceof Error) {
        setLlmError("Error: " + err.message);
      } else {
        setLlmError("Error: Unknown error");
      }
      // Update the last bot message to show error
      setMessages((prev) => {
        const updated = [...prev];
        for (let i = updated.length - 1; i >= 0; i--) {
          if (updated[i].role === "bot") {
            updated[i] = {
              ...updated[i],
              content: "[Error: failed to stream response]",
            };
            break;
          }
        }
        return updated;
      });
    } finally {
      setLoading(false);
      addDebugInfo("Chat request completed");
    }
  };

  // Answer mode handler (no streaming, no chat history)
  const handleAnswer = async () => {
    if (!answerQuestion.trim()) return;
    setAnswerResult("");
    setAnswerLoading(true);
    setAnswerError(null);
    addDebugInfo("Starting single answer request...");
    try {
      if (!engineRef.current) {
        throw new Error("LLM not ready");
      }
      const prompt = `Given the following code:\n\n${answerCode}\n\nAnd the question: ${answerQuestion}\n\nAnswer:`;
      addDebugInfo(`Sending prompt (${prompt.length} chars)`);
      const reply = await engineRef.current.chat.completions.create({
        messages: [
          { role: "system", content: "You are a helpful code assistant." },
          { role: "user", content: prompt },
        ],
        stream: false,
        temperature: 0.7,
        max_tokens: 1000,
      });
      const content = reply.choices?.[0]?.message?.content;
      if (content) {
        setAnswerResult(content);
        addDebugInfo(`Answer set: ${content.substring(0, 100)}...`);
      } else {
        setAnswerResult("No answer returned from model.");
        addDebugInfo("No content in reply choices");
      }
    } catch (err: unknown) {
      addDebugInfo(`Error during answer: ${err}`);
      if (err instanceof Error) {
        setAnswerError("Error: " + err.message);
      } else {
        setAnswerError("Error: Unknown error");
      }
    } finally {
      setAnswerLoading(false);
      addDebugInfo("Single answer request completed");
    }
  };

  // Handle Enter to send
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="min-h-screen flex flex-row bg-gradient-to-br from-white via-yellow-50 to-yellow-100 dark:from-zinc-900 dark:via-yellow-950 dark:to-zinc-900">
      <div className="flex flex-col flex-1 items-center justify-center p-4">
        <div className="flex flex-col items-center w-full max-w-3xl">
          <div className="flex items-center gap-2 mb-6 w-full justify-center relative">
            <h1 className="text-4xl font-extrabold text-yellow-700 dark:text-yellow-300 drop-shadow-sm tracking-tight pb-1 border-b-4 border-yellow-300 dark:border-yellow-700 w-fit flex items-center gap-2">
              <span>Code Canary</span>
              <span role="img" aria-label="canary" className="text-3xl">
                🐤
              </span>
            </h1>
            <div className="relative">
              <button
                aria-label="WebGPU Info"
                className="ml-3 p-1 rounded-full bg-yellow-100 dark:bg-yellow-800 hover:bg-yellow-200 dark:hover:bg-yellow-700 border border-yellow-300 dark:border-yellow-700 text-yellow-700 dark:text-yellow-200 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                onClick={() => setShowGpuTip((v) => !v)}
                onMouseEnter={() => setShowGpuTip(true)}
                onMouseLeave={() => setShowGpuTip(false)}
                tabIndex={0}
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 20 20"
                  fill="currentColor"
                  className="w-6 h-6"
                >
                  <path
                    fillRule="evenodd"
                    d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-8-3a1 1 0 100-2 1 1 0 000 2zm-1 2a1 1 0 012 0v4a1 1 0 11-2 0v-4z"
                    clipRule="evenodd"
                  />
                </svg>
              </button>
              {showGpuTip && (
                <div className="absolute left-1/2 -translate-x-1/2 mt-2 w-80 z-50 bg-white dark:bg-zinc-900 text-yellow-900 dark:text-yellow-100 border border-yellow-200 dark:border-yellow-700 rounded-xl shadow-xl p-4 text-sm font-medium">
                  <div className="font-bold mb-1 text-yellow-700 dark:text-yellow-300">
                    WebGPU Setup Reminder
                  </div>
                  <ul className="list-disc pl-5 mb-1">
                    <li>
                      Enable{" "}
                      <span className="font-semibold">
                        Unsafe WebGPU Support
                      </span>{" "}
                      (<code>chrome://flags/#enable-unsafe-webgpu</code>)
                    </li>
                    <li>
                      Enable{" "}
                      <span className="font-semibold">
                        WebGPU Developer Features
                      </span>{" "}
                      (
                      <code>
                        chrome://flags/#enable-webgpu-developer-features
                      </code>
                      )
                    </li>
                  </ul>
                  <div className="text-xs text-yellow-700 dark:text-yellow-300">
                    For development only. May expose security issues. Applies to
                    Chrome, Edge, and compatible browsers.
                  </div>
                </div>
              )}
            </div>
          </div>
          {/* Mode selector */}
          <div className="mb-6 flex gap-4 items-center w-full justify-center">
            <label className="font-semibold text-yellow-800 dark:text-yellow-200">
              Mode:
            </label>
            <select
              className="border border-yellow-200 dark:border-yellow-700 rounded-lg px-3 py-2 bg-white dark:bg-zinc-900 text-yellow-900 dark:text-yellow-100 font-semibold shadow focus:outline-yellow-400"
              value={mode}
              onChange={(e) => setMode(e.target.value as "answer" | "chatbot")}
            >
              <option value="answer">Answer</option>
              <option value="chatbot">Chatbot</option>
            </select>
          </div>
          {/* Answer mode UI */}
          {mode === "answer" && (
            <div className="w-full max-w-2xl flex flex-col gap-4 bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 border border-yellow-100 dark:border-yellow-800">
              <label className="font-semibold text-yellow-800 dark:text-yellow-200">
                Paste your code or drag a file (optional):
              </label>
              <textarea
                className="w-full min-h-[120px] rounded-xl border border-yellow-100 dark:border-yellow-800 p-3 font-mono text-sm bg-yellow-50 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                value={answerCode}
                onChange={(e) => setAnswerCode(e.target.value)}
                onDrop={(e) => {
                  e.preventDefault();
                  const file = e.dataTransfer.files[0];
                  if (file) {
                    const reader = new FileReader();
                    reader.onload = (event) => {
                      setAnswerCode(event.target?.result as string);
                    };
                    reader.readAsText(file);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                placeholder="Paste code here or drag a file..."
                disabled={answerLoading || !llmReady}
              />
              <label className="font-semibold mt-2 text-yellow-800 dark:text-yellow-200">
                Your question:
              </label>
              <textarea
                className="w-full min-h-[48px] rounded-xl border border-yellow-100 dark:border-yellow-800 p-3 text-sm bg-yellow-50 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-300"
                value={answerQuestion}
                onChange={(e) => setAnswerQuestion(e.target.value)}
                placeholder="What do you want to ask about this code?"
                disabled={answerLoading || !llmReady}
              />
              <button
                className="mt-2 px-6 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold shadow-lg hover:from-yellow-500 hover:to-yellow-400 transition disabled:opacity-50 border border-yellow-200 dark:border-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                onClick={handleAnswer}
                disabled={!answerQuestion.trim() || answerLoading || !llmReady}
              >
                {answerLoading
                  ? "Thinking..."
                  : llmReady
                  ? "Ask"
                  : "Loading model..."}
              </button>
              {answerError && (
                <div className="text-red-600 text-sm mt-2">{answerError}</div>
              )}
              <div className="mt-4 min-h-[48px]">
                {answerResult && (
                  <div className="bg-yellow-50 dark:bg-yellow-900 rounded-xl p-4 text-sm border border-yellow-100 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100 shadow">
                    <strong className="text-yellow-700 dark:text-yellow-300">
                      Answer:
                    </strong>
                    <div className="mt-1 whitespace-pre-wrap">
                      {answerResult}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
          {/* Chatbot mode UI (current chat UI) */}
          {mode === "chatbot" && (
            <div className="w-full max-w-2xl flex flex-col bg-white dark:bg-zinc-900 rounded-2xl shadow-xl h-[70vh] border border-yellow-100 dark:border-yellow-800">
              {/* Chat messages */}
              <div
                className="flex-1 overflow-y-auto p-6"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                style={{ minHeight: 0 }}
              >
                {messages.length === 0 && (
                  <div className="text-yellow-400 text-center mt-8">
                    Start by pasting code or asking a question!
                  </div>
                )}
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex mb-4 ${
                      msg.role === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    <div
                      className={`rounded-2xl px-5 py-3 max-w-[80%] whitespace-pre-wrap text-base shadow-lg font-medium
                    ${
                      msg.role === "user"
                        ? "bg-gradient-to-br from-yellow-400 to-yellow-500 text-white border border-yellow-300"
                        : msg.role === "bot"
                        ? "bg-yellow-50 dark:bg-yellow-950 border border-yellow-100 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100"
                        : "bg-yellow-100 dark:bg-yellow-800 text-yellow-900 font-mono border border-yellow-200 dark:border-yellow-700"
                    }
                  `}
                    >
                      {msg.role === "code" ? (
                        <>
                          <strong className="text-yellow-700 dark:text-yellow-300">
                            Code:
                          </strong>{" "}
                          <br />
                          {msg.content}
                        </>
                      ) : (
                        msg.content
                      )}
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </div>
              {/* Input area */}
              <div className="p-6 border-t border-yellow-100 dark:border-yellow-800 bg-white dark:bg-zinc-900 rounded-b-2xl">
                <textarea
                  className="w-full min-h-[48px] rounded-xl border border-yellow-100 dark:border-yellow-800 p-3 text-base bg-yellow-50 dark:bg-yellow-950 text-yellow-900 dark:text-yellow-100 focus:outline-none focus:ring-2 focus:ring-yellow-300 resize-none"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Type your question or message... (Shift+Enter for newline)"
                  disabled={loading || !llmReady}
                />
                <div className="flex justify-between items-center mt-3">
                  <div className="text-xs text-yellow-700 dark:text-yellow-300">
                    Drag code files into chat to add code context.
                  </div>
                  <button
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-yellow-400 to-yellow-500 text-white font-bold shadow-lg hover:from-yellow-500 hover:to-yellow-400 transition disabled:opacity-50 border border-yellow-200 dark:border-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-400"
                    onClick={handleSend}
                    disabled={!input.trim() || loading || !llmReady}
                  >
                    {loading
                      ? "Thinking..."
                      : llmReady
                      ? "Send"
                      : "Loading model..."}
                  </button>
                </div>
                {llmError && (
                  <div className="text-red-600 text-sm mt-2">{llmError}</div>
                )}
              </div>
            </div>
          )}
          {/* Debug Information */}
          <details className="mt-6 w-full max-w-2xl">
            <summary className="cursor-pointer text-sm text-yellow-700 dark:text-yellow-300">
              Debug Information
            </summary>
            <div className="mt-2 text-xs bg-yellow-50 dark:bg-yellow-950 p-3 rounded-xl max-h-40 overflow-y-auto border border-yellow-100 dark:border-yellow-800 text-yellow-900 dark:text-yellow-100">
              {debugInfo.map((info, index) => (
                <div key={index} className="mb-1">
                  {info}
                </div>
              ))}
            </div>
          </details>
        </div>
      </div>
    </div>
  );
}
