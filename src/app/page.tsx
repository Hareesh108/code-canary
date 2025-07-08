"use client";

import React, { useState, useRef, useEffect } from "react";
import * as webllm from "@mlc-ai/web-llm";

export default function Home() {
  const [code, setCode] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [llmReady, setLlmReady] = useState(false);
  const [llmError, setLlmError] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string[]>([]);
  const codeInputRef = useRef<HTMLTextAreaElement>(null);
  const engineRef = useRef<webllm.MLCEngineInterface | null>(null);

  const addDebugInfo = (info: string) => {
    console.log(info);
    setDebugInfo((prev) => [
      ...prev,
      `${new Date().toLocaleTimeString()}: ${info}`,
    ]);
  };

  // Initialize WebLLM on mount
  useEffect(() => {
    let isMounted = true;
    async function initLLM() {
      try {
        addDebugInfo("Starting LLM initialization...");

        // Try a smaller, more compatible model first
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

  // Drag and drop handler
  const handleDrop = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setCode(event.target?.result as string);
      };
      reader.readAsText(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLTextAreaElement>) => {
    e.preventDefault();
  };

  // Call WebLLM
  const handleAsk = async () => {
    setLoading(true);
    setAnswer("");
    setLlmError(null);
    addDebugInfo("Starting chat request...");

    try {
      if (!engineRef.current) {
        throw new Error("LLM not ready");
      }

      const prompt = `Given the following code:\n\n${code}\n\nAnd the question: ${question}\n\nAnswer:`;
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

      addDebugInfo(`Received reply: ${JSON.stringify(reply)}`);

      const content = reply.choices?.[0]?.message?.content;
      if (content) {
        setAnswer(content);
        addDebugInfo(`Answer set: ${content.substring(0, 100)}...`);
      } else {
        setAnswer("No answer returned from model.");
        addDebugInfo("No content in reply choices");
      }
    } catch (err: unknown) {
      addDebugInfo(`Error during chat: ${err}`);
      if (err instanceof Error) {
        setLlmError("Error: " + err.message);
      } else {
        setLlmError("Error: Unknown error");
      }
    } finally {
      setLoading(false);
      addDebugInfo("Chat request completed");
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 gap-8 bg-gray-50 dark:bg-black">
      <h1 className="text-2xl font-bold mb-2">Dev Helper Agent</h1>
      <div className="w-full max-w-2xl flex flex-col gap-4 bg-white dark:bg-zinc-900 rounded-lg shadow p-6">
        <label className="font-semibold">Paste your code or drag a file:</label>
        <textarea
          ref={codeInputRef}
          className="w-full min-h-[120px] rounded border p-2 font-mono text-sm bg-zinc-100 dark:bg-zinc-800 focus:outline-none focus:ring"
          value={code}
          onChange={(e) => setCode(e.target.value)}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          placeholder="Paste code here or drag a file..."
        />
        <label className="font-semibold mt-2">Your question:</label>
        <textarea
          className="w-full min-h-[48px] rounded border p-2 text-sm bg-zinc-100 dark:bg-zinc-800 focus:outline-none focus:ring"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          placeholder="What do you want to ask about this code?"
        />
        <button
          className="mt-2 px-4 py-2 rounded bg-blue-600 text-white font-semibold hover:bg-blue-700 disabled:opacity-50"
          onClick={handleAsk}
          disabled={!code || !question || loading || !llmReady}
        >
          {loading ? "Thinking..." : llmReady ? "Ask" : "Loading model..."}
        </button>
        {llmError && (
          <div className="text-red-600 text-sm mt-2">{llmError}</div>
        )}
        <div className="mt-4 min-h-[48px]">
          {answer && (
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded p-3 text-sm border border-zinc-200 dark:border-zinc-700">
              <strong>Answer:</strong>
              <div className="mt-1 whitespace-pre-wrap">{answer}</div>
            </div>
          )}
        </div>

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
