import { ButtonLink, EmptyState } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <EmptyState title="Page not found" description="The page you're looking for doesn't exist or was moved." action={<ButtonLink href="/classes">Go to my classes</ButtonLink>} />
    </div>
  );
}
