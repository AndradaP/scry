import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface Section {
  key: string;
  label: string;
  content: string;
}

interface SectionDisplayProps {
  sections: Section[];
}

const CITATION_REGEX = /\(([^)]+?,\s*[^)]+?)\)/g;

const renderContentWithCitations = (content: string, isLennysLens: boolean) => {
  if (isLennysLens) {
    return <span>{content}</span>;
  }

  const parts = content.split(CITATION_REGEX);
  const result: React.ReactNode[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 0) {
      result.push(<span key={i}>{parts[i]}</span>);
    } else {
      result.push(
        <span key={i} className="italic text-[14px]" style={{ color: "#A09A92" }}>
          ({parts[i]})
        </span>
      );
    }
  }

  return <>{result}</>;
};

const SectionItem = ({ section, index }: { section: Section; index: number }) => {
  const [isOpen, setIsOpen] = useState(true);
  const isLennysLens = section.key === "lennys_lens";

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className={index > 0 ? "mt-[40px]" : ""}
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left group border-b rule-amber"
      >
        <span className="font-mono uppercase tracking-[0.15em] text-amber-accent" style={{ fontSize: "11px" }}>
          {section.label}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-muted-foreground transition-transform duration-200 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-[8px] pb-2 font-body text-[15px] leading-[1.75] text-foreground whitespace-pre-wrap">
              {renderContentWithCitations(section.content, isLennysLens)}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const SectionDisplay = ({ sections }: SectionDisplayProps) => {
  return (
    <div>
      {sections.map((section, i) => (
        <SectionItem key={section.key} section={section} index={i} />
      ))}
    </div>
  );
};

export default SectionDisplay;
