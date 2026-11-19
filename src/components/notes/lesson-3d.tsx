"use client";

import { Box, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { makeLessonModel } from "@/app/actions/model3d";
import type { Scene } from "@/lib/model3d-schema";
import { useRunAction } from "../toast";
import { Alert, Badge, Button } from "../ui";
import { HelpMeUnderstand } from "../understand";

// three.js is only downloaded when someone opens a model.
const ModelViewer = dynamic(() => import("./model-viewer").then((m) => m.ModelViewer), {
  ssr: false,
  loading: () => <p className="flex items-center gap-2 text-sm text-muted"><Loader2 className="size-4 animate-spin" /> Loading the 3D viewer…</p>,
});

type Props = {
  noteId: string;
  /** The saved model, if it was made for the lesson's current text */
  model: { scene: Scene; source: "library" | "ai" } | null;
  teacher: boolean;
  /** A hand-built model fits this lesson (so the teacher can switch back to it) */
  libraryFits: boolean;
};

/**
 * A lesson's "See it in 3D" section on the Explain tab. Nothing is made until someone asks: the first click
 * makes the model (a free hand-built one when it fits, otherwise built by AI) and saves it for the class.
 * Only one viewer opens at a time per lesson, and only when asked, so a chapter never starts many 3D views at once.
 */
export function Lesson3D({ noteId, model, teacher, libraryFits }: Props) {
  const router = useRouter();
  const runAction = useRunAction();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<null | "auto" | "ai" | "library">(null);
  const [error, setError] = useState<string | null>(null);

  const make = async (mode: "auto" | "ai" | "library") => {
    setBusy(mode);
    setError(null);
    const res = mode === "auto" ? await makeLessonModel(noteId, mode).catch(() => ({ ok: false as const, error: "Couldn't reach the server. Check your connection." }))
      : await runAction(makeLessonModel(noteId, mode), mode === "ai" ? "New 3D model made" : "Switched to the hand-built model");
    setBusy(null);
    if (res.ok) { setOpen(true); router.refresh(); }
    else if (mode === "auto") setError(res.error);
  };

  return (
    <section className="mt-5 rounded-xl border border-border p-3" data-testid="lesson-3d">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold"><Box className="size-4 text-primary" /> See it in 3D</h3>
        {model && <span className="text-sm text-muted">· {model.scene.title}</span>}
        {model && (model.source === "library"
          ? <Badge tone="success" className="ml-auto">Hand-built model</Badge>
          : <Badge tone="warn" className="ml-auto">Built by AI. May contain mistakes</Badge>)}
      </div>

      {!model && (
        <div className="mt-2 space-y-2">
          <p className="text-sm text-muted">Turn, zoom and tap a 3D model of this lesson, with a short guided tour. It&apos;s made once and saved for the class.</p>
          {error && <Alert tone="warn">{error}</Alert>}
          <Button size="sm" onClick={() => make("auto")} loading={busy === "auto"} data-testid="show-3d">
            {busy !== "auto" && <Box className="size-3.5" />} {busy === "auto" ? "Making the 3D model… (up to 30 seconds)" : "Show in 3D"}
          </Button>
        </div>
      )}

      {model && !open && (
        <div className="mt-2 space-y-2">
          {model.scene.intro && <p className="text-sm text-muted">{model.scene.intro}</p>}
          <Button size="sm" onClick={() => setOpen(true)} data-testid="open-3d"><Box className="size-3.5" /> Open 3D model</Button>
        </div>
      )}

      {model && open && (
        <div className="mt-3 space-y-3">
          {model.scene.intro && <p className="text-sm leading-relaxed">{model.scene.intro}</p>}
          <ModelViewer scene={model.scene} />
          <HelpMeUnderstand target={{ kind: "model", noteId }} label="I don't understand this model" />
          <Button size="sm" variant="ghost" onClick={() => setOpen(false)}><X className="size-3.5" /> Close 3D model</Button>
        </div>
      )}

      {model && teacher && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3 text-xs text-muted">
          <span>Teacher:</span>
          <Button size="sm" variant="ghost" loading={busy === "ai"} onClick={() => make("ai")}>{busy !== "ai" && <Sparkles className="size-3.5" />} {model.source === "ai" ? "Remake with AI" : "Make one with AI instead"}</Button>
          {model.source === "ai" && libraryFits && (
            <Button size="sm" variant="ghost" loading={busy === "library"} onClick={() => make("library")}>{busy !== "library" && <RefreshCw className="size-3.5" />} Use the hand-built model</Button>
          )}
        </div>
      )}
    </section>
  );
}
