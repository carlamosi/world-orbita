import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { c as cn } from './router-T2jDQtma.mjs';
import { h as ChevronDown } from '../_libs/lucide-react.mjs';
import { A as AnimatePresence, m as motion } from '../_libs/framer-motion.mjs';

function ModeDropdown({
  options,
  value,
  onChange
}) {
  const [open, setOpen] = reactExports.useState(false);
  const ref = reactExports.useRef(null);
  reactExports.useEffect(() => {
    function handleClickOutside(event) {
      if (ref.current && !ref.current.contains(event.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);
  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;
  return /* @__PURE__ */ jsxRuntimeExports.jsxs("div", { className: "relative z-50", ref, children: [
    /* @__PURE__ */ jsxRuntimeExports.jsxs(
      "button",
      {
        type: "button",
        onClick: () => setOpen(!open),
        className: "glass flex items-center gap-2 px-4 py-1.5 rounded-full hover:bg-white/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--cyan)]/60",
        "aria-haspopup": "listbox",
        "aria-expanded": open,
        children: [
          /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "text-[11px] font-mono uppercase tracking-wider text-white", children: selectedLabel }),
          /* @__PURE__ */ jsxRuntimeExports.jsx(
            ChevronDown,
            {
              className: cn(
                "w-3.5 h-3.5 text-white/50 transition-transform duration-200",
                open && "rotate-180"
              )
            }
          )
        ]
      }
    ),
    /* @__PURE__ */ jsxRuntimeExports.jsx(AnimatePresence, { children: open && /* @__PURE__ */ jsxRuntimeExports.jsx(
      motion.div,
      {
        initial: { opacity: 0, y: -4, scale: 0.95 },
        animate: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -4, scale: 0.95 },
        transition: { duration: 0.15, ease: "easeOut" },
        className: "absolute right-0 top-full mt-2 w-48 p-1.5 glass rounded-[1rem] border border-white/10 shadow-[0_20px_40px_-10px_rgba(0,0,0,0.5)] bg-black/40 backdrop-blur-xl flex flex-col",
        role: "listbox",
        children: options.map((o) => /* @__PURE__ */ jsxRuntimeExports.jsx(
          "button",
          {
            role: "option",
            "aria-selected": value === o.value,
            onClick: () => {
              onChange(o.value);
              setOpen(false);
            },
            className: cn(
              "flex items-center w-full px-3 py-2.5 rounded-xl text-[11px] font-mono uppercase tracking-wider text-left transition-colors outline-none",
              value === o.value ? "bg-white/15 text-white" : "text-white/55 hover:bg-white/10 hover:text-white focus-visible:bg-white/10"
            ),
            children: o.label
          },
          o.value
        ))
      }
    ) })
  ] });
}

export { ModeDropdown as M };
