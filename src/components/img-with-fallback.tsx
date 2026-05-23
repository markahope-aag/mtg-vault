"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

// Drop-in <img> replacement that swaps in an ImageOff placeholder when the
// browser fires onError (404, network drop, blocked CDN). The Scryfall image
// CDN occasionally drops a stale URL when a printing is updated; without
// this fallback the browser renders its broken-image glyph and the layout
// breaks.
export function ImgWithFallback({
  src,
  alt,
  className,
  fallbackClassName,
  fallbackIconClassName,
  loading,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  fallbackClassName?: string;
  fallbackIconClassName?: string;
  loading?: "lazy" | "eager";
}) {
  const [errored, setErrored] = useState(false);
  if (!src || errored) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-surface-inset text-text-muted",
          fallbackClassName ?? className,
        )}
        aria-label={alt}
      >
        <ImageOff className={fallbackIconClassName ?? "size-4"} />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      onError={() => setErrored(true)}
    />
  );
}
