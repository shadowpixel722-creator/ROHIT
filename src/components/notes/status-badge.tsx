import { Badge } from "../ui";

const META: Record<string, { label: string; tone: "success" | "warn" | "danger" }> = {
  APPROVED: { label: "Approved", tone: "success" },
  PENDING: { label: "Waiting for approval", tone: "warn" },
  REJECTED: { label: "Changes requested", tone: "danger" },
};
export function StatusBadge({ status }: { status: string }) {
  const m = META[status] ?? META.PENDING;
  return <Badge tone={m.tone}>{m.label}</Badge>;
}
