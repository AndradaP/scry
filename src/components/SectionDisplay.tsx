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

const SectionItem = ({ section, index }: { section: Section; index: number }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
      className="border-b rule-amber"
    >
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="font-mono text-xs uppercase tracking-[0.15em] text-amber-accent">
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
            <div className="pb-6 font-body text-base leading-[1.75] text-foreground whitespace-pre-wrap">
              {section.content}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const SectionDisplay = ({ sections }: SectionDisplayProps) => {
  return (
    <div className="space-y-0">
      {sections.map((section, i) => (
        <SectionItem key={section.key} section={section} index={i} />
      ))}
    </div>
  );
};

export default SectionDisplay;
