import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import SectionDisplay from "@/components/SectionDisplay";
import ChatPanel from "@/components/ChatPanel";
import ChatDrawer from "@/components/ChatDrawer";
import LoadingState from "@/components/LoadingState";
import DownloadButton from "@/components/DownloadButton";
import { ArrowRight } from "lucide-react";
import { saveEntry, getEntry } from "@/lib/history";
import { supabase } from "@/lib/supabase";

const GENERATE_SECTIONS = [
  { key: "product_overview", label: "Product Overview" },
  { key: "strategy_and_positioning", label: "Strategy & Positioning" },
  { key: "feature_breakdown", label: "Feature Breakdown" },
  { key: "growth_model", label: "Growth Model" },
  { key: "design_analysis", label: "Design Analysis" },
  { key: "key_insights", label: "Key Insights" },
  { key: "lennys_lens", label: "Lenny's Lens" },
];

const LOADING_MESSAGES = [
  "Analyzing product strategy...",
  "Summoning Lenny's council...",
  "Reviewing growth model...",
  "Applying frameworks...",
  "Forging your teardown...",
];

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

const Generate = () => {
  const { id } = useParams<{ id?: string }>();
  const [productName, setProductName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [teardown, setTeardown] = useState<Record<string, string> | null>(null);
  const [productUrl, setProductUrl] = useState("");
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatStreaming, setChatStreaming] = useState(false);
  const [mobileTab, setMobileTab] = useState<"teardown" | "chat">("teardown");
  const [entryId, setEntryId] = useState<string>("");
  const [usageCount, setUsageCount] = useState<number | null>(null);

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
    if (id) {
      const load = async () => {
        const entry = await getEntry(id);
        if (entry) {
          setProductName(entry.product_name);
          const sectionMap: Record<string, string> = {};
          entry.sections.forEach((s) => { sectionMap[s.key] = s.content; });
          setTeardown(sectionMap);
          setChatMessages(entry.chatMessages);
          setEntryId(entry.id);
        }
      };
      load();
    }
  }, [id]);

  const handleGenerate = async () => {
    if (!productName.trim()) return;
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
          body: JSON.stringify({ productName, mode: "generate", timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
        }
      );
    
      const result = await response.json();
      setTeardown(result);
      setProductUrl(result.product_url ?? "");
      setIsLoading(false);
      window.dispatchEvent(new Event("scry_usage_updated"));
    
      const newId = crypto.randomUUID();
      setEntryId(newId);
      const sections = GENERATE_SECTIONS.map((s) => ({ key: s.key, label: s.label, content: result[s.key] || "" }));
      await saveEntry({
        id: newId,
        product_name: productName,
        mode: "generate",
        created_at: new Date().toISOString(),
        sections,
        chatMessages: [],
      });
    } catch (error) {
      console.error("Error generating teardown:", error);
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

      if (entryId && teardown) {
        await saveEntry({
          id: entryId,
          product_name: productName,
          mode: "generate",
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

  const sections = teardown
    ? GENERATE_SECTIONS.map((s) => ({ key: s.key, label: s.label, content: teardown[s.key] || "" }))
    : [];

  const chatDrawer = teardown && !isLoading ? (
    <ChatDrawer
      messages={chatMessages}
      onSend={handleChatSend}
      isLoading={chatLoading}
      isStreaming={chatStreaming}
    />
  ) : undefined;

  return (
    <AppLayout rightPanel={chatDrawer}>
      <div className="w-full max-w-[860px] mx-auto px-6 py-12">
        {!teardown && !isLoading && (
          <div className="py-16">
            <div className="flex items-center justify-between mb-6">
              <label className="font-mono text-xs uppercase tracking-[0.15em] text-muted-foreground">
                What product do you want to tear down?
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
              onKeyDown={(e) => e.key === "Enter" && handleGenerate()}
              placeholder="e.g. Plaid, Duolingo, Figma's multiplayer feature..."
              className="w-full bg-transparent border-b border-border focus:border-primary outline-none py-3 text-xl font-body text-foreground placeholder:text-muted-foreground/50 transition-colors"
            />
            <button
              onClick={handleGenerate}
              disabled={!productName.trim()}
              className="mt-8 inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-sm font-body font-medium hover:opacity-90 disabled:opacity-30 transition-opacity"
            >
              Generate Teardown
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}

        {isLoading && <LoadingState messages={LOADING_MESSAGES} />}

        {teardown && !isLoading && (
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
                Teardown
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

            {/* Teardown content — always visible on desktop, hidden on mobile when chat tab is active */}
            <div className={`${mobileTab === "chat" ? "hidden" : "block"} lg:block`}>
              <div className="flex items-start justify-between mb-10">
                <div>
                  <h1 className="font-heading text-4xl md:text-5xl font-semibold text-foreground">
                    {productName}
                  </h1>
                  {productUrl && (
                    <a
                      href={productUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-xs mt-1 inline-block hover:opacity-80 transition-opacity"
                      style={{ color: "hsl(var(--primary))" }}
                    >
                      Visit product →
                    </a>
                  )}
                </div>
                <DownloadButton productName={productName} sections={sections} />
              </div>
              <SectionDisplay sections={sections} />
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
    </AppLayout>
  );
};

export default Generate;