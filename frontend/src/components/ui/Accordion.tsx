import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

// Zero-dependency accessible accordion: a real <button> with aria-expanded/
// aria-controls (full keyboard support for free) and a CSS grid-rows trick
// for a smooth expand/collapse without measuring heights in JS.
export function AccordionItem({
  question,
  answer,
  defaultOpen = false,
}: {
  question: string;
  answer: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = useId();

  return (
    <div className="border-b border-border last:border-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-inset"
      >
        <span className="font-medium text-fg">{question}</span>
        <ChevronDown
          className={cn("h-4 w-4 shrink-0 text-fg-muted transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </button>
      <div
        id={contentId}
        role="region"
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-5 text-sm text-fg-secondary">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function Accordion({
  items,
  className,
}: {
  items: { question: string; answer: string }[];
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-border bg-surface", className)}>
      {items.map((item, i) => (
        <AccordionItem key={item.question} question={item.question} answer={item.answer} defaultOpen={i === 0} />
      ))}
    </div>
  );
}
