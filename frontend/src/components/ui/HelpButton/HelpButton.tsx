import { useId, useState } from "react";

interface HelpButtonProps {
  title: string;
  description: string;
  placement?: "left" | "right" | "center";
  className?: string;
}

export function HelpButton({
  title,
  description,
  placement = "left",
  className = "",
}: HelpButtonProps) {
  const tooltipId = useId();
  const [open, setOpen] = useState(false);

  const placementClasses =
    placement === "right"
      ? "right-0"
      : placement === "center"
        ? "left-1/2 -translate-x-1/2"
        : "left-0";

  return (
    <span className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={`Ayuda: ${title}`}
        aria-expanded={open}
        aria-describedby={open ? tooltipId : undefined}
        onClick={() => setOpen((current) => !current)}
        onBlur={() => setOpen(false)}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[#cbdde3] bg-white text-[#075eaa] shadow-sm transition hover:border-[#0878cf] hover:bg-[#e8f4fa] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#005aaf]"
      >
        <span className="font-heading text-sm font-bold leading-none">?</span>
      </button>

      {open && (
        <span
          id={tooltipId}
          role="tooltip"
          className={`absolute top-10 z-[120] w-72 rounded-2xl border border-[#cbdde3] bg-white p-4 text-left shadow-xl ${placementClasses}`}
        >
          <span className="block font-heading text-sm font-bold text-[#073b52]">
            {title}
          </span>
          <span className="mt-1 block font-body text-xs leading-relaxed text-[#526c79]">
            {description}
          </span>
        </span>
      )}
    </span>
  );
}

export default HelpButton;
