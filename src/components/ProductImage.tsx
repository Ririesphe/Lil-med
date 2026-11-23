import { useEffect, useState } from "react";

interface Props {
  src?: string | null;
  alt: string;
  /** Extra classes for the <img>, e.g. a hover zoom. */
  className?: string;
  loading?: "lazy" | "eager";
  /** Size of the "No image" text in the fallback. */
  fallbackText?: string;
}

/**
 * Product photo that fits any shape of image into its container the same way
 * everywhere on the site:
 * - fills the available box without cropping or stretching (object-contain),
 *   centred by the parent;
 * - small source images are enlarged, but never beyond 2x their real size so
 *   they do not turn blurry;
 * - "multiply" blending lets white and very light photo backgrounds melt into
 *   the white (or cream) panel behind them instead of showing a pasted-on box;
 * - a missing or broken image falls back to the site's "No image" placeholder.
 * The parent decides the box size (height/width and padding).
 */
export default function ProductImage({ src, alt, className = "", loading = "lazy", fallbackText = "text-xs" }: Props) {
  const [failed, setFailed] = useState(false);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);

  // A different product (or image) gets a fresh attempt.
  useEffect(() => {
    setFailed(false);
    setNatural(null);
  }, [src]);

  if (!src || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center rounded-xl bg-brand-cream/60 text-brand-navy/40">
        <span className={`${fallbackText} uppercase tracking-widest`}>No image</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading={loading}
      decoding="async"
      onLoad={(e) => {
        const i = e.currentTarget;
        if (i.naturalWidth > 0) setNatural({ w: i.naturalWidth, h: i.naturalHeight });
      }}
      onError={() => setFailed(true)}
      style={natural ? { maxWidth: natural.w * 2, maxHeight: natural.h * 2 } : undefined}
      className={`h-full w-full object-contain mix-blend-multiply ${className}`}
    />
  );
}
