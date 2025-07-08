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
    <div className="min-h-screen flex flex-row bg-gray-50 dark:bg-black">
      <div className="flex flex-col flex-1 items-center justify-center p-4">
        <h1 className="text-2xl font-bold mb-2">Dev Helper Agent</h1>
        {/* Mode selector */}
        <div className="mb-4 flex gap-4 items-center">
          <label className="font-semibold">Mode:</label>
          <select
            className="border rounded px-2 py-1 bg-zinc-100 dark:bg-zinc-800"
            value={mode}
            onChange={(e) => setMode(e.target.value as "answer" | "chatbot")}
          >
            <option value="answer">Answer</option>
            <option value="chatbot">Chatbot</option>
          </select>
        </div>
        {/* Answer mode UI */}
        {mode === "answer" && (
          <div className="w-full max-w-2xl flex flex-col gap-4 bg-white dark:bg-zinc-900 rounded-lg shadow p-6">
            <label className="font-semibold">
              Paste your code or drag a file (optional):
            </label>
            <textarea
              className="w-full min-h-[120px] rounded border p-2 font-mono text-sm bg-zinc-100 dark:bg-zinc-800 focus:outline-none focus:ring"
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
            <label className="font-semibold mt-2">Your question:</label>
            <textarea
              className="w-full min-h-[48px] rounded border p-2 text-sm bg-zinc-100 dark:bg-zinc-800 focus:outline-none focus:ring"
              value={answerQuestion}
              onChange={(e) => setAnswerQuestion(e.target.value)}
              placeholder="What do you want to ask about this code?"
              disabled={answerLoading || !llmReady}
            />
            <button
              className="mt-2 px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
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
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded p-3 text-sm border border-zinc-200 dark:border-zinc-700">
                  <strong>Answer:</strong>
                  <div className="mt-1 whitespace-pre-wrap">{answerResult}</div>
                </div>
              )}
            </div>
          </div>
        )}
        {/* Chatbot mode UI (current chat UI) */}
        {mode === "chatbot" && (
          <div className="w-full max-w-2xl flex flex-col bg-white dark:bg-zinc-900 rounded-lg shadow h-[70vh]">
            {/* Chat messages */}
            <div
              className="flex-1 overflow-y-auto p-4"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              style={{ minHeight: 0 }}
            >
              {messages.length === 0 && (
                <div className="text-gray-400 text-center mt-8">
                  Start by pasting code or asking a question!
                </div>
              )}
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={`flex mb-3 ${
                    msg.role === "user" ? "justify-end" : "justify-start"
                  }`}
                >
                  <div
                    className={`rounded-lg px-4 py-2 max-w-[80%] whitespace-pre-wrap text-sm shadow
                    ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white"
                        : msg.role === "bot"
                        ? "bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700"
                        : "bg-green-100 text-green-900 font-mono border border-green-300"
                    }
                  `}
                  >
                    {msg.role === "code" ? (
                      <>
                        <strong>Code:</strong> <br />
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
            <div className="p-4 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900">
              <textarea
                className="w-full min-h-[48px] rounded border p-2 text-sm bg-zinc-100 dark:bg-zinc-800 focus:outline-none focus:ring resize-none"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your question or message... (Shift+Enter for newline)"
                disabled={loading || !llmReady}
              />
              <div className="flex justify-between items-center mt-2">
                <div className="text-xs text-gray-500">
                  Drag code files into chat to add code context.
                </div>
                <button
                  className="px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
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
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-gray-600 dark:text-gray-400">
            Debug Information
          </summary>
          <div className="mt-2 text-xs bg-gray-100 dark:bg-gray-800 p-2 rounded max-h-40 overflow-y-auto">
            {debugInfo.map((info, index) => (
              <div key={index} className="mb-1">
                {info}
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}
