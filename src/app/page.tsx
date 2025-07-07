"use client";

import React, { useState, useRef } from "react";

export default function Home() {
  const [code, setCode] = useState("");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const codeInputRef = useRef<HTMLTextAreaElement>(null);

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

  // Placeholder for LLM call
  const handleAsk = async () => {
    setLoading(true);
    setAnswer("");
    // TODO: Integrate with WebLLM here
    setTimeout(() => {
      setAnswer("[LLM answer will appear here]");
      setLoading(false);
    }, 1200);
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
          disabled={!code || !question || loading}
        >
          {loading ? "Thinking..." : "Ask"}
        </button>
        <div className="mt-4 min-h-[48px]">
          {answer && (
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded p-3 text-sm border border-zinc-200 dark:border-zinc-700">
              <strong>Answer:</strong>
              <div className="mt-1 whitespace-pre-wrap">{answer}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
