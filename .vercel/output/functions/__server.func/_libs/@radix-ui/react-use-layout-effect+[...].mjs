import { r as reactExports } from '../react.mjs';

// src/use-layout-effect.tsx
var useLayoutEffect2 = globalThis?.document ? reactExports.useLayoutEffect : () => {
};

export { useLayoutEffect2 as u };
