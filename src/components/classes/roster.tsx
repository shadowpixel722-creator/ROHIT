"use client";

import { ShieldCheck, UserMinus } from "lucide-react";
import { removeStudent, setCanUpload, setConsentVerified } from "@/app/actions/classes";
import { useEffect, useState } from "react";
import { useRunAction } from "../toast";
import { Badge, Button, EmptyState } from "../ui";

export type RosterRow = { membershipId: string; name: string; email: string; guardianName: string | null; joinedAt: string; consentVerified: boolean; canUpload: boolean };

export function Roster({ rows }: { rows: RosterRow[] }) {
  const runAction = useRunAction();
  if (rows.length === 0) return <EmptyState title="No students yet" description="Share the join code with your class. Students appear here as they join." />;
  const verified = rows.filter((r) => r.consentVerified).length;
  const uploaders = rows.filter((r) => r.canUpload).length;
  return (
    <div>
      <p className="mb-2 text-xs text-muted">{rows.length} students · {verified} with a signed consent form confirmed · {uploaders} can add notes</p>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.membershipId} className="flex flex-wrap items-center gap-3 py-3" data-testid="roster-row">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.name}</p>
              <p className="truncate text-xs text-muted">{r.email}{r.guardianName && ` · Guardian: ${r.guardianName}`}</p>
            </div>
            {r.consentVerified ? <Badge tone="success"><ShieldCheck className="size-3" /> Consent form confirmed</Badge> : <Badge tone="warn">Consent form pending</Badge>}
            <UploadToggle row={r} />
            <div className="flex gap-1">
              <Button size="sm" variant="secondary" onClick={() => runAction(setConsentVerified(r.membershipId, !r.consentVerified), r.consentVerified ? "Marked as pending. Upload permission removed" : "Consent confirmed")}>
                {r.consentVerified ? "Undo" : "Confirm form received"}
              </Button>
              <Button size="sm" variant="ghost" aria-label={`Remove ${r.name}`}
                onClick={() => confirm(`Remove ${r.name} from this class? They can rejoin with the code unless you close joining.`) && runAction(removeStudent(r.membershipId), `${r.name} removed`)}>
                <UserMinus className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** "Can add notes" checkbox. Updates instantly, then rolls back if the server refuses. */
function UploadToggle({ row: r }: { row: RosterRow }) {
  const runAction = useRunAction();
  const [on, setOn] = useState(r.canUpload);
  useEffect(() => setOn(r.canUpload), [r.canUpload]);
  return (
    <label className={`inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium ${r.consentVerified ? "text-text" : "text-faint"}`}
      title={r.consentVerified ? "Allow this student to add notes to any subject" : "Confirm the consent form first"}>
      <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={on} disabled={!r.consentVerified} aria-label={`${r.name} can add notes`}
        onChange={async (e) => {
          const next = e.target.checked;
          setOn(next);
          const res = await runAction(setCanUpload(r.membershipId, next), next ? `${r.name} can now add notes` : `${r.name} can no longer add notes`);
          if (!res.ok) setOn(!next);
        }} />
      Can add notes
    </label>
  );
}
