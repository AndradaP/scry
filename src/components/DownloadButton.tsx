import { useState, useRef, useEffect } from "react";
import { Download } from "lucide-react";

interface Section {
  label: string;
  content: string;
}

interface DownloadButtonProps {
  productName: string;
  sections: Section[];
}

const DownloadButton = ({ productName, sections }: DownloadButtonProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toMarkdown = () => {
    let md = `# ${productName}\n\n`;
    sections.forEach((s) => {
      md += `## ${s.label}\n\n${s.content}\n\n`;
    });
    return md;
  };

  const copyMarkdown = async () => {
    await navigator.clipboard.writeText(toMarkdown());
    setIsOpen(false);
  };

  const downloadPdf = () => {
    // Create a printable HTML document and trigger print-to-PDF
    const html = `<!DOCTYPE html><html><head><title>${productName}</title><style>
      body{font-family:Inter,sans-serif;max-width:700px;margin:40px auto;color:#222;line-height:1.75;font-size:14px}
      h1{font-family:Georgia,serif;font-size:28px;margin-bottom:24px}
      h2{font-family:Georgia,serif;font-size:18px;margin-top:32px;margin-bottom:8px;text-transform:uppercase;letter-spacing:0.05em;color:#7A7670;border-bottom:1px solid #ddd;padding-bottom:6px}
      p{margin:8px 0}
    </style></head><body><h1>${productName}</h1>${sections.map((s) => `<h2>${s.label}</h2><p>${s.content}</p>`).join("")}</body></html>`;
    const win = window.open("", "_blank");
    if (win) {
      win.document.write(html);
      win.document.close();
      setTimeout(() => win.print(), 300);
    }
    setIsOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-body text-muted-foreground border border-border hover:border-primary hover:text-foreground transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Download
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full mt-1 bg-card border border-border z-50 min-w-[180px]">
          <button
            onClick={downloadPdf}
            className="w-full text-left px-4 py-2.5 text-xs font-body text-foreground hover:bg-secondary/50 transition-colors"
          >
            Download as PDF
          </button>
          <button
            onClick={copyMarkdown}
            className="w-full text-left px-4 py-2.5 text-xs font-body text-foreground hover:bg-secondary/50 transition-colors border-t border-border"
          >
            Copy as Markdown
          </button>
        </div>
      )}
    </div>
  );
};

export default DownloadButton;
