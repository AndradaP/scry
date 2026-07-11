import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import SectionDisplay from "@/components/SectionDisplay";
import ChatPanel from "@/components/ChatPanel";
import ChatDrawer from "@/components/ChatDrawer";
import LoadingState from "@/components/LoadingState";
import DownloadButton from "@/components/DownloadButton";
import ShareButton from "@/components/ShareButton";
import ErrorBoundary from "@/components/ErrorBoundary";
import { ArrowRight, Upload } from "lucide-react";
import { saveEntry, getEntry } from "@/lib/history";
import { FeedbackBar } from "@/components/FeedbackBar";
import { supabase } from "@/lib/supabase";
import { logClientError } from "@/lib/errorLogger";

const CRITIQUE_SECTIONS = [
  { key: "overall_assessment", label: "Overall Assessment" },
  { key: "strengths", label: "Strengths" },
  { key: "gaps_and_blind_spots", label: "Gaps & Blind Spots" },
  { key: "framework_alignment", label: "Framework Alignment" },
  { key: "suggested_improvements", label: "Suggested Improvements" },
  { key: "lennys_lens", label: "Lenny's Lens" },
];

const LOADING_MESSAGES = [
  "Summoning Lenny's council...",
  "Reading your teardown...",
  "Identifying gaps...",
  "Applying frameworks...",
  "Forging your critique...",
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const validateTeardown = (text: string): string | null => {
  const trimmed = text.trim();

  if (trimmed.length < 150) {
    return "Your teardown is too short. A meaningful critique needs at least a few paragraphs of analysis.";
  }

  const nonPrintable = trimmed.split("").filter(
    c => c.charCodeAt(0) < 32 || c.charCodeAt(0) > 126
  ).length;
  if (nonPrintable / trimmed.length > 0.1) {
    return "We couldn't read this file. Try copying and pasting your teardown as text instead.";
  }

  const words = trimmed.split(/\s+/).filter(w => w.length > 2);
  if (words.length < 30) {
    return "This doesn't look like a product teardown. Please write or paste your analysis and try again.";
  }

  const avgWordLength = words.reduce((sum, w) => sum + w.length, 0) / words.length;
  if (avgWordLength > 12) {
    return "This looks like it might be encoded or corrupted. Try pasting your teardown as plain text.";
  }

  return null;
};

const Critique = () => {
  const { id } = useParams<{ id?: string }>();
  const [activeTab, setActiveTab] = useState<"write" | "upload">("write");
  const [teardownText, setTeardownText] = useState("");
  const [productName, setProductName] = useState("");
  const [fileName, setFileName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [critique, setCritique] = useState<Record<string, string> | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [mobileTab, setMobileTab] = useState<"teardown" | "chat">("teardown");
  const [entryId, setEntryId] = useState<string>("");
  const [entrySaved, setEntrySaved] = useState(false);
  const [usageCount, setUsageCount] = useState<number | null>(null);
  const [entryNotFound, setEntryNotFound] = useState(false);

  useEffect(() => {
    const fetchCount = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) return;
      if (session.user.email === "ioana.andrada.api@gmail.com") return;
      const today = new Date().toLocaleDateString("en-CA");
      const { data } = await supabase
        .from("usage_limits")
        .select("teardown_count")
        .eq("user_id", session.user.id)
        .eq("date", today)
        .maybeSingle();
      setUsageCount(data?.teardown_count ?? 0);
    };
    fetchCount();
    window.addEventListener("scry_usage_updated", fetchCount);
    return () => window.removeEventListener("scry_usage_updated", fetchCount);
  }, []);

  useEffect(() => {
    if (!id) return;
    setEntryNotFound(false);
    const load = async () => {
      await supabase.auth.getSession();
      const entry = await getEntry(id);
      if (entry) {
        setProductName(entry.product_name);
        const sectionMap: Record<string, string> = {};
        entry.sections.forEach((s) => { sectionMap[s.key] = s.content; });
        setCritique(sectionMap);
        setChatMessages(entry.chatMessages);
        setEntryId(entry.id);
        setEntrySaved(true);
      } else {
        setEntryNotFound(true);
      }
    };
    load();
  }, [id]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setValidationError(null);

    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setTeardownText(ev.target?.result as string);
      };
      reader.readAsText(file);
      return;
    }

    if (file.type === "application/pdf" || file.name.endsWith(".pdf")) {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url
        ).toString();
    
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        let fullText = "";
    
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          const pageText = content.items
            .map((item: unknown) => (item as { str?: string }).str ?? "")
            .join(" ");
          fullText += pageText + "\n\n";
        }
    
        const extracted = fullText.trim();
        if (!extracted) {
          setValidationError("We couldn't extract text from this PDF. Try copying and pasting your teardown instead.");
          return;
        }
        setTeardownText(extracted);
      } catch (err) {
        console.error("PDF extraction error:", err);
        setValidationError("Something went wrong reading this PDF. Try pasting your teardown as text.");
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setTeardownText(ev.target?.result as string);
    };
    reader.readAsText(file);
  };

  const handleCritique = async () => {
    const error = validateTeardown(teardownText);
    if (error) {
      setValidationError(error);
      return;
    }

    setValidationError(null);
    setIsLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-teardown`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            productName: productName || "Unknown Product",
            mode: "critique",
            userTeardown: teardownText,
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }
      );

      const result = await response.json();

      if (result.error) {
        setValidationError(result.error);
        setIsLoading(false);
        return;
      }

      setCritique(result);
      setIsLoading(false);
      window.dispatchEvent(new Event("scry_usage_updated"));

      const newId = crypto.randomUUID();
      setEntryId(newId);
      const sections = CRITIQUE_SECTIONS.map((s) => ({
        key: s.key,
        label: s.label,
        content: result[s.key] || "",
      }));
      await saveEntry({
        id: newId,
        product_name: productName || "Untitled Critique",
        mode: "critique",
        created_at: new Date().toISOString(),
        sections,
        chatMessages: [],
      });
      setEntrySaved(true);
    } catch (error) {
      console.error("Error generating critique:", error);
      setValidationError("Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  const handleChatSend = async (message: string) => {
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content: message };
    const newMessages = [...chatMessages, userMsg];
    setChatMessages(newMessages);
    setChatLoading(true);
    setChatStreaming(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const teardownContext = sections
        .map((s) => `${s.label}:\n${s.content}`)
        .join("\n\n");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-teardown`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token}`,
            "apikey": import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({
            mode: "chat",
            teardownId: entryId,
            teardownContext,
            chatMessages: newMessages.map(m => ({ role: m.role, content: m.content })),
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          }),
        }
      );

      const isSSE = response.headers.get("content-type")?.includes("text/event-stream") ?? false;

      let finalMessages: ChatMessage[];

      if (!isSSE) {
        // Edge function not yet streaming — fall back to JSON
        const result = await response.json();
        const assistantMsg: ChatMessage = { id: crypto.randomUUID(), role: "assistant", content: result.reply ?? "" };
        finalMessages = [...newMessages, assistantMsg];
        setChatMessages(finalMessages);
        setChatLoading(false);
      } else {
        if (!response.body) throw new Error("No response body");

        const assistantId = crypto.randomUUID();
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buf = "";
        let fullContent = "";
        let firstChunk = true;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buf += decoder.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6).trim();
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              if (parsed.text) {
                if (firstChunk) {
                  setChatLoading(false);
                  setChatStreaming(true);
                  setChatMessages([...newMessages, { id: assistantId, role: "assistant", content: "" }]);
                  firstChunk = false;
                }
                fullContent += parsed.text;
                setChatMessages(prev => {
                  const updated = [...prev];
                  updated[updated.length - 1] = { id: assistantId, role: "assistant" as const, content: fullContent };
                  return updated;
                });
              }
            } catch { /* skip malformed */ }
          }
        }

        setChatStreaming(false);

        finalMessages = [...newMessages, { id: assistantId, role: "assistant" as const, content: fullContent }];
        setChatMessages(finalMessages);
      }

      if (entryId && critique) {
        await saveEntry({
          id: entryId,
          product_name: productName || "Untitled Critique",
          mode: "critique",
          created_at: new Date().toISOString(),
          sections,
          chatMessages: finalMessages,
        });
      }
    } catch (error) {
      console.error("Error in chat:", error);
      setChatLoading(false);
      setChatStreaming(false);
    }
  };

  const critiqueTitle = productName || "Critique";
  const sections = critique
    ? CRITIQUE_SECTIONS.map((s) => ({
        key: s.key,
        label: s.label,
        content: critique[s.key] || "",
      }))
    : [];

  const chatDrawer = critique && !isLoading ? (
    <ChatDrawer
      messages={chatMessages}
      onSend={handleChatSend}
      isLoading={chatLoading}
      isStreaming={chatStreaming}
    />
  ) : undefined;

  return (
    <AppLayout rightPanel={chatDrawer}>
      <ErrorBoundary onError={(error, info) => logClientError(error.message, error.stack + "\n\nComponent stack:" + info.componentStack)}>
      <div className="w-full max-w-[860px] mx-auto px-6 py-12">
        {entryNotFound && (
          <div className="py-16">
            <p className="font-body text-sm text-muted-foreground">
              This critique wasn't found or you don't have access to it.
            </p>
          </div>
        )}

        {!critique && !isLoading && !entryNotFound && (
          <div className="py-8">
            <div className="flex gap-6 mb-8 border-b border-border">
              <button
                onClick={() => setActiveTab("write")}
                className={`pb-3 text-sm font-body transition-colors border-b-2 -mb-px ${
                  activeTab === "write"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Write
              </button>
              <button
                onClick={() => setActiveTab("upload")}
                className={`pb-3 text-sm font-body transition-colors border-b-2 -mb-px ${
                  activeTab === "upload"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Upload
              </button>
            </div>

            {activeTab === "write" ? (
              <textarea
                value={teardownText}
                onChange={(e) => {
                  setTeardownText(e.target.value);
                  setValidationError(null);
                }}
                placeholder="Write or paste your teardown here..."
                className="w-full h-64 bg-transparent border border-border focus:border-primary outline-none p-4 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 resize-none transition-colors"
              />
            ) : (
              <label className="block border border-dashed border-border hover:border-primary p-12 text-center cursor-pointer transition-colors">
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                {fileName ? (
                  <p className="font-mono text-sm text-foreground">{fileName}</p>
                ) : (
                  <div>
                    <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-3" />
                    <p className="font-body text-sm text-muted-foreground">
                      Drop a file or click to upload
                    </p>
                    <p className="font-mono text-xs text-muted-foreground/50 mt-1">
                      .pdf, .docx, .txt
                    </p>
                  </div>
                )}
              </label>
            )}

            {validationError && (
              <p className="mt-3 text-sm font-body text-red-400">
                {validationError}
              </p>
            )}

            <div className="mt-6">
              <div className="flex items-center justify-between mb-2">
                <label className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
                  What are you analyzing?
                </label>
                {usageCount !== null && (
                  <span style={{ color: "#A09A92", fontSize: "11px" }}>
                    {usageCount} of 5 teardowns today
                  </span>
                )}
              </div>
              <input
                type="text"
                value={productName}
                onChange={(e) => setProductName(e.target.value)}
                placeholder="e.g. Figma, Figma's AI agent, Clay's 2026 product updates, Duolingo for chess"
                className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-sm font-body text-foreground placeholder:text-muted-foreground/50 transition-colors"
              />
              <p className="mt-2 font-mono text-xs text-muted-foreground/40">
                Works best for software products, apps, and SaaS
              </p>
            </div>

            <button
              onClick={handleCritique}
              disabled={!teardownText.trim() || !productName.trim()}
              className="mt-8 inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-sm font-body font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
            >
              Get Critique
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {isLoading && <LoadingState messages={LOADING_MESSAGES} />}

        {critique && !isLoading && (
          <div>
            {/* Mobile tab bar */}
            <div className="lg:hidden flex gap-6 mb-8 border-b border-border">
              <button
                onClick={() => setMobileTab("teardown")}
                className={`pb-3 text-sm font-body transition-colors border-b-2 -mb-px ${
                  mobileTab === "teardown"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Critique
              </button>
              <button
                onClick={() => setMobileTab("chat")}
                className={`pb-3 text-sm font-body transition-colors border-b-2 -mb-px ${
                  mobileTab === "chat"
                    ? "border-primary text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                Chat
              </button>
            </div>

            {/* Critique content — always visible on desktop, hidden on mobile when chat tab is active */}
            <div className={`${mobileTab === "chat" ? "hidden" : "block"} lg:block`}>
              <div className="flex items-start justify-between mb-10">
                <div>
                  <p className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground mb-2">
                    Critique
                  </p>
                  <h1 className="font-heading text-4xl md:text-5xl font-semibold text-foreground">
                    {productName || "Critique"}
                  </h1>
                </div>
                <div className="flex items-center gap-2">
                  <ShareButton teardownId={entryId} />
                  <DownloadButton productName={critiqueTitle} sections={sections} />
                </div>
              </div>
              <SectionDisplay sections={sections} />
              {entrySaved && <FeedbackBar teardownId={entryId} />}
            </div>

            {/* Mobile chat tab — only shown on mobile when chat tab is active */}
            <div
              className={`lg:hidden ${mobileTab === "chat" ? "block" : "hidden"}`}
              style={{ height: "calc(100dvh - 160px)" }}
            >
              <ChatPanel
                variant="panel"
                messages={chatMessages}
                onSend={handleChatSend}
                isLoading={chatLoading}
                isStreaming={chatStreaming}
              />
            </div>
          </div>
        )}
      </div>
      </ErrorBoundary>
    </AppLayout>
  );
};

export default Critique;