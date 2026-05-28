import { useState, useRef, useEffect } from "react";
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
  isStreaming?: boolean;
}

// Render inline (Name, Domain) citations with muted italic style
const renderWithCitations = (text: string): React.ReactNode[] => {
  const regex = /(\([^)]+?,\s*[^)]+?\))/g;
  const parts = text.split(regex);
  return parts.map((part, i) =>
    regex.test(part)
      ? <span key={i} style={{ fontStyle: "italic", fontSize: "13px", color: "#A09A92" }}>{part}</span>
      : <span key={i}>{part}</span>
  );
};

const ChatPanel = ({ messages, onSend, isLoading, isStreaming }: ChatPanelProps) => {
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
  }, [messages, isLoading, isStreaming]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    onSend(input.trim());
    setInput("");
  };

  return (
    <div className="mt-12 pt-8 border-t rule-amber">
      <p className="text-xs font-mono mb-6" style={{ color: "#7A7670" }}>
        Ask a follow-up <span className="opacity-50 ml-2">press /</span>
      </p>

      {messages.length > 0 && (
        <div ref={scrollRef} className="max-h-[480px] overflow-y-auto mb-8 space-y-6" style={{ padding: "0 1.5rem" }}>
          {messages.map((msg, index) => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.role === "user" ? "items-end" : "items-start"}`}
            >
              {/* Role label */}
              {msg.role === "user" ? (
                <span
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: "12px",
                    color: "#7A7670",
                    marginBottom: "6px",
                  }}
                >
                  You
                </span>
              ) : (
                <span
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: "10px",
                    color: "#D4A843",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    marginBottom: "6px",
                  }}
                >
                  Scry
                </span>
              )}

              {/* Message bubble / response */}
              {msg.role === "user" ? (
                <div
                  style={{
                    background: "#2E2C28",
                    border: "1px solid #3E3C38",
                    padding: "10px 14px",
                    maxWidth: "75%",
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: "14px",
                    lineHeight: 1.6,
                    color: "#F0EBE0",
                    borderRadius: 0,
                  }}
                >
                  {msg.content}
                </div>
              ) : (
                <div
                  style={{
                    fontFamily: "'Inter', system-ui, sans-serif",
                    fontSize: "15px",
                    lineHeight: 1.75,
                    color: "#F0EBE0",
                    width: "100%",
                  }}
                >
                  <ReactMarkdown
                    components={{
                      h1: ({ children }) => <p className="font-bold text-base mb-2">{children}</p>,
                      h2: ({ children }) => <p className="font-bold mb-1 mt-3">{children}</p>,
                      h3: ({ children }) => <p className="font-semibold mb-1 mt-2">{children}</p>,
                      p: ({ children }) => (
                        <p className="mb-2">
                          {Array.isArray(children)
                            ? children.flatMap((child, i) =>
                                typeof child === "string" ? renderWithCitations(child) : [child]
                              )
                            : typeof children === "string"
                            ? renderWithCitations(children)
                            : children}
                        </p>
                      ),
                      ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1">{children}</ol>,
                      strong: ({ children }) => <span className="font-semibold">{children}</span>,
                    }}
                  >
                    {msg.content}
                  </ReactMarkdown>
                  {isStreaming && index === messages.length - 1 && (
                    <span
                      className="animate-pulse"
                      style={{
                        display: "inline-block",
                        width: "2px",
                        height: "15px",
                        background: "#D4A843",
                        marginLeft: "2px",
                        verticalAlign: "text-bottom",
                      }}
                    />
                  )}
                </div>
              )}
            </div>
          ))}

          {isLoading && (
            <div className="flex flex-col items-start">
              <span
                style={{
                  fontFamily: "'Inter', system-ui, sans-serif",
                  fontSize: "10px",
                  color: "#D4A843",
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  marginBottom: "6px",
                }}
              >
                Scry
              </span>
              <span
                className="animate-pulse"
                style={{ fontFamily: "'Inter', system-ui, sans-serif", fontSize: "15px", color: "#7A7670" }}
              >
                Thinking…
              </span>
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-4">
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about this teardown..."
          className="chat-input flex-1 bg-transparent border-b border-border focus:border-primary outline-none py-2 font-body transition-colors"
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "14px",
            color: "#F0EBE0",
            borderRadius: 0,
          }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          style={{
            fontFamily: "'Inter', system-ui, sans-serif",
            fontSize: "13px",
            fontWeight: 500,
            color: "#D4A843",
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "8px 0",
            opacity: !input.trim() || isLoading ? 0.3 : 1,
            transition: "opacity 0.15s",
            borderRadius: 0,
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatPanel;
