"use client";

import { useEffect, useRef, useState } from "react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const WELCOME =
  "Hi! I can help you find your way around ShowRing IQ — ask me things like \"how do I assign a back number\" or \"where do I mark a class official\".";

export function HelpChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string>();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    setError(undefined);
    setInput("");
    const nextMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages([...nextMessages, { role: "assistant", content: "" }]);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/help-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: nextMessages }),
      });

      if (!res.ok || !res.body) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Something went wrong.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: "assistant", content: acc };
          return copy;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setMessages((prev) => prev.slice(0, -1));
    } finally {
      setIsStreaming(false);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      {open && (
        <div className="mb-3 flex h-[28rem] w-80 flex-col overflow-hidden rounded-lg border border-stone-200 bg-white shadow-xl dark:border-stone-700 dark:bg-stone-900">
          <div className="flex items-center justify-between border-b border-stone-200 px-4 py-3 dark:border-stone-800">
            <p className="text-sm font-semibold">ShowRing IQ Help</p>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            >
              ✕
            </button>
          </div>
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-3">
            <p className="text-sm text-stone-500 dark:text-stone-400">{WELCOME}</p>
            {messages.map((m, i) => (
              <div
                key={i}
                className={`rounded-lg px-3 py-2 text-sm ${
                  m.role === "user"
                    ? "ml-6 bg-brand-700 text-white"
                    : "mr-6 bg-stone-100 text-stone-900 dark:bg-stone-800 dark:text-stone-100"
                }`}
              >
                {m.content || (isStreaming && i === messages.length - 1 ? "…" : "")}
              </div>
            ))}
            {error && (
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send();
            }}
            className="flex gap-2 border-t border-stone-200 p-3 dark:border-stone-800"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question…"
              disabled={isStreaming}
              className="flex-1 rounded-md border border-stone-300 bg-white px-3 py-1.5 text-sm text-stone-900 focus:border-brand-600 focus:outline-none focus:ring-1 focus:ring-brand-600 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100"
            />
            <button
              type="submit"
              disabled={isStreaming || !input.trim()}
              className="rounded-md bg-brand-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-brand-800 disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-700 text-white shadow-lg hover:bg-brand-800"
        aria-label="Open help chat"
      >
        {open ? "✕" : "?"}
      </button>
    </div>
  );
}
