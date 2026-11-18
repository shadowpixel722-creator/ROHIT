"use client";

import { AlertTriangle } from "lucide-react";
import { Button, EmptyState } from "@/components/ui";

export default function AppError({ reset }: { error: Error; reset: () => void }) {
  return (
    <EmptyState
      icon={<AlertTriangle className="size-5" />}
      title="Something went wrong loading this page"
      description="Your data is safe. Try again, and if this keeps happening, refresh the page."
      action={<Button onClick={reset}>Try again</Button>}
    />
  );
}
