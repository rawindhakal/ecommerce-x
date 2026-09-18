"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

export function Accordion({ sections }: { sections: { title: string; content: React.ReactNode }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="divide-y divide-ink/10 border-y border-ink/10">
      {sections.map((section, idx) => {
        const open = openIndex === idx;
        return (
          <div key={section.title}>
            <button
              onClick={() => setOpenIndex(open ? null : idx)}
              className="flex w-full items-center justify-between py-4 text-left font-display text-lg"
              aria-expanded={open}
            >
              {section.title}
              <ChevronDown size={18} className={`text-ink/40 transition-transform ${open ? "rotate-180" : ""}`} />
            </button>
            {open && <div className="pb-4 text-sm leading-relaxed text-ink/70">{section.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
