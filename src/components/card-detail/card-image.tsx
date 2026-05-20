"use client";

import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

export function CardImage({
  src,
  alt,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
}) {
  const [errored, setErrored] = useState(false);
  const broken = !src || errored;

  return (
    <div
      className={cn(
        "aspect-[488/680] w-full overflow-hidden rounded-xl border bg-muted",
        className,
      )}
    >
      {broken ? (
        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
          <ImageOff className="h-12 w-12" />
        </div>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          className="h-full w-full object-cover"
          onError={() => setErrored(true)}
        />
      )}
    </div>
  );
}
