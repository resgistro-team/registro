"use client";

import Image, { type ImageLoader } from "next/image";
import { isUnsplash } from "@/lib/covers";

/** Unsplash's CDN resizes and re-encodes on request, so the browser only downloads the size it shows. */
const unsplashLoader: ImageLoader = ({ src, width, quality }) =>
  `${src}?w=${width}&q=${quality ?? 70}&auto=format&fit=crop`;

/**
 * An event cover, filling its parent. The parent sets the size and shape.
 * Library covers go through Unsplash's resizing; anything else loads as given.
 */
export function Cover({
  url,
  sizes,
  priority = false,
  className = "",
}: {
  url: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <Image
      src={url}
      alt=""
      fill
      sizes={sizes}
      priority={priority}
      loader={isUnsplash(url) ? unsplashLoader : undefined}
      unoptimized={!isUnsplash(url)}
      className={`object-cover ${className}`}
    />
  );
}
