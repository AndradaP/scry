import { useState, useRef, useEffect } from "react";
import { Send } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface ChatPanelProps {
  messages: Message[];
  onSend: (message: string) => void;
  isLoading?: boolean;
}

const ChatPanel = ({ messages, onSend, isLoading }: ChatPanelProps) => {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "/" && document.activeElement !== inputRef.current) {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="mt-12 pt-8 border-t rule-amber">
      <p className="text-xs font-mono mb-4" style={{ color: "#7A7670" }}>
        Ask a follow-up <span className="opacity-50 ml-2">press /</span>
      </p>

      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-[400px] overflow-y-auto space-y-4 mb-6">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[80%] leading-[1.75] font-body"
                style={{
                  fontSize: "15px",
                  color: "#F0EBE0",
                }}
              >
                {msg.role === "assistant" ? (
                  <ReactMarkdown
                    components={{
                      h1: ({children}) => <p className="font-bold text-base mb-2">{children}</p>,
                      h2: ({children}) => <p className="font-bold mb-1 mt-3">{children}</p>,
                      h3: ({children}) => <p className="font-semibold mb-1 mt-2">{children}</p>,
                      p: ({children}) => <p className="mb-2">{children}</p>,
                      ul: ({children}) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({children}) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                      strong: ({children}) => <span className="font-bold">{children}</span>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex justify-start">
              <div className="text-sm font-mono animate-pulse" style={{ color: "#7A7670" }}>
                Thinking...
              </div>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this teardown..."
          className="flex-1 bg-transparent border-b border-border focus:border-primary outline-none py-2 text-sm font-body transition-colors placeholder:text-muted-foreground"
          style={{ color: "#F0EBE0" }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          className="p-2 text-muted-foreground hover:text-amber-accent disabled:opacity-30 transition-colors"
        >
          <Send className="w-4 h-4" />
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
