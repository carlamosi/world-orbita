import { useState } from "react";
import { cn } from "@/lib/utils";

interface Props {
  iso2?: string;
  src?: string;
  alt: string;
  className?: string;
  size?: 320 | 640 | 1280;
}

export function FlagImage({ iso2, src, alt, className, size = 320 }: Props) {
  const [loaded, setLoaded] = useState(false);
  const code = iso2?.toLowerCase();
  const imageSrc = src ?? (code ? `https://flagcdn.com/w${size}/${code}.png` : "");
  const imageSrcSet = src
    ? undefined
    : code
      ? `https://flagcdn.com/w${size}/${code}.png 1x, https://flagcdn.com/w${size * 2}/${code}.png 2x`
      : undefined;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl glass",
        !loaded && "animate-pulse",
        className,
      )}
    >
      <img
        src={imageSrc}
        srcSet={imageSrcSet}
        alt={alt}
        loading="lazy"
        decoding="async"
        onLoad={() => setLoaded(true)}
        className={cn(
          "block w-full h-full object-cover transition-opacity duration-500",
          loaded ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}
