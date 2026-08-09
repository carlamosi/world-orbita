import { r as reactExports, j as jsxRuntimeExports } from '../_libs/react.mjs';
import { c as cn } from './router-T2jDQtma.mjs';

function FlagImage({ iso2, alt, className, size = 320 }) {
  const [loaded, setLoaded] = reactExports.useState(false);
  const code = iso2.toLowerCase();
  return /* @__PURE__ */ jsxRuntimeExports.jsx(
    "div",
    {
      className: cn(
        "relative overflow-hidden rounded-xl glass",
        !loaded && "animate-pulse",
        className
      ),
      children: /* @__PURE__ */ jsxRuntimeExports.jsx(
        "img",
        {
          src: `https://flagcdn.com/w${size}/${code}.png`,
          srcSet: `https://flagcdn.com/w${size}/${code}.png 1x, https://flagcdn.com/w${size * 2}/${code}.png 2x`,
          alt,
          loading: "lazy",
          decoding: "async",
          onLoad: () => setLoaded(true),
          className: cn(
            "block w-full h-full object-cover transition-opacity duration-500",
            loaded ? "opacity-100" : "opacity-0"
          )
        }
      )
    }
  );
}

export { FlagImage as F };
