"use client";

import { ChevronLeft, ChevronRight, ExternalLink, X, ZoomIn, ZoomOut } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "../ui";

export type GalleryImage = { id: string; src: string; width: number; height: number };

/** Full-screen page viewer: arrows / ← → to move, Esc to close, click or the button to zoom. */
export function Lightbox({ images, index, title, onClose }: { images: GalleryImage[]; index: number; title: string; onClose: () => void }) {
  const [i, setI] = useState(index);
  const [zoom, setZoom] = useState(false);
  const step = useCallback((d: number) => { setI((x) => (x + d + images.length) % images.length); setZoom(false); }, [images.length]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowRight") step(1);
      if (e.key === "ArrowLeft") step(-1);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, step]);
  const img = images[i];
  // Rendered into <body> so no ancestor (transforms, overflow) can trap or clip the full-screen view.
  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={`Page ${i + 1} of ${images.length}`} className="fixed inset-0 z-[60] flex flex-col bg-black/95" onClick={onClose}>
      <div className="flex items-center justify-between gap-2 px-4 py-3 text-sm text-white" onClick={(e) => e.stopPropagation()}>
        <span>Page {i + 1} of {images.length}</span>
        <div className="flex items-center gap-1">
          <button onClick={() => setZoom((z) => !z)} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label={zoom ? "Fit to screen" : "Zoom in"}>
            {zoom ? <ZoomOut className="size-5" /> : <ZoomIn className="size-5" />}
          </button>
          <a href={img.src} target="_blank" rel="noopener" className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label="Open original image"><ExternalLink className="size-5" /></a>
          <button onClick={onClose} className="grid size-9 place-items-center rounded-full hover:bg-white/10" aria-label="Close"><X className="size-5" /></button>
        </div>
      </div>
      <div className={cn("relative min-h-0 flex-1 px-2 pb-4 sm:px-14", zoom && "overflow-auto")} onClick={(e) => e.stopPropagation()} data-testid="viewer-stage">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={img.src} alt={`${title}, page ${i + 1}`} onClick={() => setZoom((z) => !z)} data-testid="viewer-image"
          className={cn(zoom ? "mx-auto block h-auto max-w-none cursor-zoom-out rounded-lg" : "block size-full cursor-zoom-in object-contain")}
          style={zoom ? { width: `min(${Math.max(img.width, 1400)}px, 250vw)` } : undefined} />
        {images.length > 1 && (
          <>
            <button onClick={() => step(-1)} className="fixed top-1/2 left-3 grid size-10 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70" aria-label="Previous page"><ChevronLeft className="size-5" /></button>
            <button onClick={() => step(1)} className="fixed top-1/2 right-3 grid size-10 place-items-center rounded-full bg-black/50 text-white hover:bg-black/70" aria-label="Next page"><ChevronRight className="size-5" /></button>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** Clickable page thumbnail that opens the viewer at that page. */
export function PageThumb({ images, index, title, className, children }: { images: GalleryImage[]; index: number; title: string; className?: string; children?: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className={cn("group relative block overflow-hidden rounded-lg border border-border bg-surface-2", className)} aria-label={`View page ${index + 1} of ${images.length}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={images[index].src} alt={`${title}, page ${index + 1}`} loading="lazy" className="size-full object-contain transition-transform group-hover:scale-[1.02]" />
        <span className="absolute right-1.5 bottom-1.5 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[11px] text-white opacity-90"><ZoomIn className="size-3" /> View</span>
        {children}
      </button>
      {open && <Lightbox images={images} index={index} title={title} onClose={() => setOpen(false)} />}
    </>
  );
}

export function Gallery({ images, title }: { images: GalleryImage[]; title: string }) {
  const [open, setOpen] = useState<number | null>(null);
  if (images.length === 0) return null;
  return (
    <>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {images.map((img, i) => (
          <li key={img.id}>
            <button onClick={() => setOpen(i)} className="group block w-full overflow-hidden rounded-xl border border-border bg-surface-2" aria-label={`Open page ${i + 1} of ${images.length}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img.src} alt={`${title}, page ${i + 1}`} width={img.width} height={img.height} loading="lazy" className="aspect-[3/4] w-full object-cover transition-transform group-hover:scale-[1.02]" />
            </button>
          </li>
        ))}
      </ul>
      {open !== null && <Lightbox images={images} index={open} title={title} onClose={() => setOpen(null)} />}
    </>
  );
}
