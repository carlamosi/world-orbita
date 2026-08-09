import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { c as cn } from './router-T2jDQtma.mjs';
import { s as spring } from './motion-B8-Vl7RP.mjs';
import { m as motion } from '../_libs/framer-motion.mjs';

const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-6 text-[15px]",
  lg: "h-14 px-8 text-base"
};
const variants = {
  primary: "text-white border border-white/15 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--violet)_92%,white_8%),color-mix(in_oklab,var(--violet)_75%,black_25%))] shadow-[0_8px_30px_-10px_color-mix(in_oklab,var(--violet)_70%,transparent)] hover:shadow-[0_14px_44px_-10px_color-mix(in_oklab,var(--violet)_85%,transparent)]",
  secondary: "glass text-white/90 hover:text-white",
  ghost: "text-white/70 hover:text-white hover:bg-white/5"
};
const Button = reactExports.forwardRef(
  function Button2({ className, variant = "primary", size = "md", children, ...props }, ref) {
    return /* @__PURE__ */ jsxRuntimeExports.jsx(
      motion.button,
      {
        ref,
        whileHover: { y: -1 },
        whileTap: { scale: 0.97 },
        transition: spring.micro,
        className: cn(
          "inline-flex items-center justify-center gap-2 rounded-full font-medium tracking-tight",
          "relative overflow-hidden select-none outline-none focus-visible:ring-2 focus-visible:ring-cyan/60",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          sizes[size],
          variants[variant],
          className
        ),
        ...props,
        children: /* @__PURE__ */ jsxRuntimeExports.jsx("span", { className: "relative z-10 inline-flex items-center gap-2", children })
      }
    );
  }
);

export { Button as B };
