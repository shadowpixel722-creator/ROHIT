"use client";

import { Check, Crown, School, UserMinus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { decideTeacherRequest, removeStudent, removeTeacher, setSupervisorPowers } from "@/app/actions/classes";
import { POWER_LABELS, SUPERVISOR_POWERS, type Power } from "@/lib/powers";
import { useRunAction } from "../toast";
import { Badge, Button, EmptyState } from "../ui";

export type RoomMemberRow = { membershipId: string; name: string; head: boolean; me: boolean };

/** A student room's members. Only names are shown: a student head never sees classmates' emails or guardians. */
export function RoomMembers({ rows, canRemove }: { rows: RoomMemberRow[]; canRemove: boolean }) {
  const runAction = useRunAction();
  if (rows.length <= 1) return <EmptyState title="Nobody else yet" description="Share the room code with classmates. They appear here as they join." />;
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.membershipId} className="flex flex-wrap items-center gap-3 py-2.5" data-testid="member-row">
          <p className="min-w-0 flex-1 truncate text-sm font-medium">{r.name}{r.me && <span className="font-normal text-muted"> (you)</span>}</p>
          {r.head && <Badge tone="primary"><Crown className="size-3" /> Student head</Badge>}
          {canRemove && !r.head && !r.me && (
            <Button size="sm" variant="ghost" aria-label={`Remove ${r.name}`}
              onClick={() => confirm(`Remove ${r.name} from this room? They can rejoin with the code unless you close joining.`) && runAction(removeStudent(r.membershipId), `${r.name} removed`)}>
              <UserMinus className="size-4" />
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

export type SupervisorRow = { membershipId: string; name: string; school: string | null; pending: boolean; powers: Power[]; me: boolean };

/** Teachers looking after a student room. The student head approves them and chooses what each one can do. */
export function Supervisors({ rows, canManage }: { rows: SupervisorRow[]; canManage: boolean }) {
  const runAction = useRunAction();
  if (rows.length === 0) return <p className="text-sm text-muted">No teachers yet. A teacher who enters the room code asks to supervise, and {canManage ? "you decide" : "the student head decides"}.</p>;
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.membershipId} className="space-y-2 py-3" data-testid="supervisor-row">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{r.name}{r.me && <span className="font-normal text-muted"> (you)</span>}</p>
              {r.school && <p className="truncate text-xs text-muted"><School className="mr-1 inline size-3" />{r.school}</p>}
            </div>
            {r.pending ? <Badge tone="warn">Wants to supervise</Badge> : <Badge>{r.powers.length ? `${r.powers.length} power${r.powers.length === 1 ? "" : "s"}` : "Can only look"}</Badge>}
            {canManage && (
              <div className="flex gap-1">
                {r.pending ? (
                  <>
                    <Button size="sm" onClick={() => runAction(decideTeacherRequest(r.membershipId, true), `${r.name} can now look after this room`)}><Check className="size-4" /> Approve</Button>
                    <Button size="sm" variant="secondary" onClick={() => confirm(`Decline ${r.name}'s request?`) && runAction(decideTeacherRequest(r.membershipId, false), "Request declined")}><X className="size-4" /> Decline</Button>
                  </>
                ) : (
                  <Button size="sm" variant="ghost" aria-label={`Remove ${r.name}`} onClick={() => confirm(`Remove ${r.name} as a supervisor?`) && runAction(removeTeacher(r.membershipId), `${r.name} removed`)}>
                    <UserMinus className="size-4" />
                  </Button>
                )}
              </div>
            )}
          </div>
          {!r.pending && (canManage || r.me) && <PowerToggles row={r} editable={canManage} />}
        </li>
      ))}
    </ul>
  );
}

/** One checkbox per power a head can hand out. Updates instantly, then rolls back if the server refuses. */
function PowerToggles({ row: r, editable }: { row: SupervisorRow; editable: boolean }) {
  const runAction = useRunAction();
  const [on, setOn] = useState<Power[]>(r.powers);
  useEffect(() => setOn(r.powers), [r.powers]);
  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label={`What ${r.name} can do`}>
      {SUPERVISOR_POWERS.map((p) => (
        <label key={p} className={`inline-flex items-center gap-2 rounded-lg border border-border px-2.5 py-1.5 text-xs font-medium ${editable ? "" : "text-muted"}`}>
          <input type="checkbox" className="size-4 accent-[var(--primary)]" checked={on.includes(p)} disabled={!editable} aria-label={`${r.name}: ${POWER_LABELS[p]}`}
            onChange={async (e) => {
              const before = on;
              const next = e.target.checked ? [...on, p] : on.filter((x) => x !== p);
              setOn(next);
              const res = await runAction(setSupervisorPowers(r.membershipId, next), e.target.checked ? `${r.name} can now: ${POWER_LABELS[p].toLowerCase()}` : `${r.name} can no longer: ${POWER_LABELS[p].toLowerCase()}`);
              if (!res.ok) setOn(before);
            }} />
          {POWER_LABELS[p]}
        </label>
      ))}
    </div>
  );
}
