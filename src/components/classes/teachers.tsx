"use client";

import { Check, School, UserMinus, X } from "lucide-react";
import { decideTeacherRequest, removeTeacher } from "@/app/actions/classes";
import { useRunAction } from "../toast";
import { Badge, Button } from "../ui";

export type TeacherRow = { membershipId: string | null; name: string; email: string; school: string | null; owner: boolean; pending: boolean; sameSchool: boolean; me: boolean };

export function Teachers({ rows, canManage }: { rows: TeacherRow[]; canManage: boolean }) {
  const runAction = useRunAction();
  return (
    <ul className="divide-y divide-border">
      {rows.map((r) => (
        <li key={r.membershipId ?? "owner"} className="flex flex-wrap items-center gap-3 py-3" data-testid="teacher-row">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{r.name}{r.me && <span className="font-normal text-muted"> (you)</span>}</p>
            <p className="truncate text-xs text-muted">{r.email}{r.school && ` · ${r.school}`}</p>
          </div>
          {r.owner && <Badge tone="primary">Created the class</Badge>}
          {!r.owner && !r.pending && <Badge>Co-teacher</Badge>}
          {r.pending && <Badge tone="warn">Wants to join</Badge>}
          {r.pending && r.sameSchool && <Badge tone="success"><School className="size-3" /> Same school</Badge>}
          {canManage && r.membershipId && (
            <div className="flex gap-1">
              {r.pending ? (
                <>
                  <Button size="sm" onClick={() => runAction(decideTeacherRequest(r.membershipId!, true), `${r.name} can now co-teach this class`)}><Check className="size-4" /> Approve</Button>
                  <Button size="sm" variant="secondary" onClick={() => confirm(`Decline ${r.name}'s request?`) && runAction(decideTeacherRequest(r.membershipId!, false), "Request declined")}><X className="size-4" /> Decline</Button>
                </>
              ) : (
                <Button size="sm" variant="ghost" aria-label={`Remove ${r.name}`} onClick={() => confirm(`Remove ${r.name} as a co-teacher?`) && runAction(removeTeacher(r.membershipId!), `${r.name} removed`)}>
                  <UserMinus className="size-4" />
                </Button>
              )}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
