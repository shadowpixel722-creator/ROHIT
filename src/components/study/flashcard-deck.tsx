"use client";

import { RotateCcw, Shuffle } from "lucide-react";
import { ReadAloud } from "../speech";
import { useState } from "react";
import { shuffle } from "@/lib/quiz";
import { Button, cn, ProgressBar } from "../ui";

export type DeckCard = { id: string; front: string; back: string; from: string | null };

/** Tap the card to flip it. "Got it" removes a card from this round; "Again" puts it at the back. Nothing is saved or sent. */
export function FlashcardDeck({ cards }: { cards: DeckCard[] }) {
  const [queue, setQueue] = useState(() => cards.map((c) => c.id));
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(0);
  const byId = new Map(cards.map((c) => [c.id, c]));
  const card = byId.get(queue[0]);

  function restart(order: string[]) {
    setQueue(order);
    setKnown(0);
    setFlipped(false);
  }

  if (cards.length === 0) return <p className="text-sm text-muted">No flashcards yet. Your teacher hasn&apos;t published any for this chapter.</p>;

  if (!card) {
    return (
      <div className="rounded-xl bg-success-soft px-4 py-6 text-center" data-testid="deck-done">
        <p className="font-medium text-success">You went through all {cards.length} cards. Well done!</p>
        <Button className="mt-3" variant="secondary" onClick={() => restart(shuffle(cards.map((c) => c.id)))}><RotateCcw className="size-4" /> Study them again</Button>
      </div>
    );
  }

  const next = (gotIt: boolean) => {
    setFlipped(false);
    setQueue((q) => (gotIt ? q.slice(1) : [...q.slice(1), q[0]]));
    if (gotIt) setKnown((k) => k + 1);
  };

  return (
    <div className="space-y-3" data-testid="flashcard-deck">
      <div className="flex items-center gap-3 text-xs text-muted">
        <ProgressBar value={known / cards.length} className="flex-1" label="Cards learned" />
        <span className="tabular-nums">{known} of {cards.length} learned</span>
        <button type="button" onClick={() => restart(shuffle(cards.map((c) => c.id)))} className="inline-flex items-center gap-1 hover:text-text" aria-label="Shuffle cards"><Shuffle className="size-3.5" /> Shuffle</button>
        <ReadAloud key={`${card.id}-${flipped}`} text={flipped ? card.back : card.front} label="Read card" />
      </div>
      <button type="button" onClick={() => setFlipped(!flipped)} aria-label={flipped ? "Showing the answer. Tap to see the question" : "Showing the question. Tap to see the answer"}
        className={cn("grid min-h-44 w-full place-items-center rounded-2xl border px-5 py-8 text-center transition-colors", flipped ? "border-primary/40 bg-primary-soft" : "border-border bg-surface-2/50 hover:border-border-strong")}
        data-testid="flashcard">
        <span>
          <span className="mb-2 block text-[11px] font-semibold uppercase tracking-wide text-faint">{flipped ? "Answer" : "Question"}</span>
          <span className="block text-lg leading-snug font-medium" data-testid="flashcard-text">{flipped ? card.back : card.front}</span>
          {card.from && <span className="mt-3 block text-xs text-muted">from “{card.from}”</span>}
        </span>
      </button>
      {flipped ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => next(false)}>Again</Button>
          <Button onClick={() => next(true)}>Got it</Button>
        </div>
      ) : <p className="text-center text-xs text-muted">Tap the card to see the answer</p>}
    </div>
  );
}
