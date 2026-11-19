import { BookOpen, KeyRound, Settings2, Users } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinCodePanel } from "@/components/classes/class-settings";
import { Roster } from "@/components/classes/roster";
import { RoomMembers, Supervisors } from "@/components/classes/room-people";
import { Teachers } from "@/components/classes/teachers";
import { SubjectsEditor } from "@/components/classes/subjects-editor";
import { Chevron, Collapsible, EmptyState, SubjectDot } from "@/components/ui";
import { can, getClassAccess } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { subjectColor } from "@/lib/constants";
import { db } from "@/lib/db";
import { NCERT_INDEX, ncertChapters } from "@/data/ncert-index";
import { formatJoinCode } from "@/lib/join-code";
import { parsePowers } from "@/lib/powers";
import { getToday } from "@/lib/server";
import { upcomingFor } from "@/lib/study";
import { UpcomingCard, UrgentBanner } from "@/components/study/upcoming";

export const metadata = { title: "Class" };

export default async function ClassPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser();
  const access = await getClassAccess(user.id, id);
  if (!access) notFound();
  const { classroom, role, membership, isOwner, kind } = access;
  const teacher = role === "TEACHER";
  const room = kind === "ROOM";
  const editSyllabus = can(access, "syllabus");
  const manageMembers = can(access, "members");

  const [subjects, roster, people, counts] = await Promise.all([
    db.subject.findMany({ where: { classroomId: id }, orderBy: [{ position: "asc" }, { createdAt: "asc" }], include: { chapters: { orderBy: { position: "asc" }, select: { id: true, name: true, _count: { select: { notes: true, flashcards: true, questions: true } } } } } }),
    teacher
      ? db.membership.findMany({ where: { classroomId: id }, orderBy: { joinedAt: "asc" }, include: { user: { select: { name: true, email: true, guardianName: true, school: true } } } })
      : Promise.resolve([]),
    // A student room shows everyone's names only (no emails or guardians), to every member.
    room
      ? db.membership.findMany({ where: { classroomId: id }, orderBy: { joinedAt: "asc" }, select: { id: true, userId: true, role: true, status: true, powers: true, user: { select: { name: true, school: true } } } })
      : Promise.resolve([]),
    db.note.groupBy({ by: ["subjectId"], where: { classroomId: id, status: "APPROVED" }, _count: true }),
  ]);
  const notesBy = new Map(counts.map((c) => [c.subjectId, c._count]));
  const students = roster.filter((m) => m.role === "STUDENT");
  const owner = teacher ? await db.user.findUniqueOrThrow({ where: { id: classroom.teacherId }, select: { name: true, email: true, school: true } }) : null;
  const sameSchool = (s: string | null) => !!(s && owner?.school && s.trim().toLowerCase() === owner.school.trim().toLowerCase());
  const teacherRows = owner ? [
    { membershipId: null, name: owner.name, email: owner.email, school: owner.school, owner: true, pending: false, sameSchool: false, me: isOwner },
    ...roster.filter((m) => m.role === "TEACHER").map((m) => ({
      membershipId: m.id, name: m.user.name, email: m.user.email, school: m.user.school, owner: false,
      pending: m.status === "PENDING", sameSchool: sameSchool(m.user.school), me: m.userId === user.id,
    })),
  ] : [];


  const members = people.filter((m) => m.role === "STUDENT").map((m) => ({ membershipId: m.id, name: m.user.name, head: m.userId === classroom.teacherId, me: m.userId === user.id }));
  // Pending supervisor requests are only the head's business.
  const supervisors = people.filter((m) => m.role === "TEACHER" && (isOwner || m.status === "ACTIVE"))
    .map((m) => ({ membershipId: m.id, name: m.user.name, school: m.user.school, pending: m.status === "PENDING", powers: parsePowers(m.powers), me: m.userId === user.id }));
  const supervisorRequests = supervisors.filter((s) => s.pending).length;

  const pendingConsent = students.filter((m) => !m.consentVerifiedAt).length;
  const teacherRequests = teacherRows.filter((t) => t.pending).length;
  const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

  return (
    <div className="space-y-3">
      {/* Test and exam reminders live only on the Overview tab (product owner). */}
      {role === "STUDENT" && await (async () => {
        const rows = await upcomingFor(user.id, id, await getToday());
        return <><UrgentBanner classroomId={id} rows={rows} /><UpcomingCard classroomId={id} rows={rows} /></>;
      })()}

      {kind === "CLASS" && !teacher && !membership?.consentVerifiedAt && (
        <div className="rounded-xl bg-warn-soft px-4 py-3 text-sm text-warn">Your teacher hasn&apos;t confirmed your parent/guardian consent form yet.</div>
      )}

      {kind === "CLASS" && !teacher && (
        <p className="px-1 text-sm text-muted" data-testid="upload-status">
          {membership?.canUpload ? <><span className="font-medium text-primary">You can add notes.</span> Your teacher approves each one.</> : "Your teacher and the students they choose add the class notes."}
        </p>
      )}

      {room && role === "STUDENT" && (
        <p className="px-1 text-sm text-muted" data-testid="upload-status">
          {isOwner ? "You're the student head. Notes members add appear straight away; you can hide any that shouldn't be here." : "Notes you add appear straight away for everyone in the room."}
        </p>
      )}

      {manageMembers && (
        <Collapsible icon={<KeyRound className="size-5" />} title={room ? "Invite classmates" : "Invite students"} meta={<>Code <span className="font-mono">{formatJoinCode(classroom.joinCode)}</span>{!classroom.joinOpen && " · joining closed"}</>} defaultOpen={teacher ? students.length === 0 : members.length <= 1}>
          <p className="mb-3 text-sm text-muted">{room ? "Classmates sign up as students, then enter this code on their Classes page. A teacher who enters it asks to supervise the room." : "Students sign up, then enter this code on their Classes page."}</p>
          <JoinCodePanel classroomId={id} code={classroom.joinCode} open={classroom.joinOpen} />
        </Collapsible>
      )}

      <Collapsible icon={<BookOpen className="size-5" />} title="Subjects and chapters" defaultOpen={editSyllabus ? subjects.length === 0 : true}
        meta={subjects.length ? `${plural(subjects.length, "subject")} · ${plural(subjects.reduce((n, x) => n + x.chapters.length, 0), "chapter")}` : "None yet"} bodyClassName="px-4 sm:px-5">
        {editSyllabus ? (
          <SubjectsEditor classroomId={id}
            grade={classroom.grade} indexSubjects={classroom.grade ? Object.keys(NCERT_INDEX[classroom.grade] ?? {}) : []}
            subjects={subjects.map((s) => {
              const index = new Set((ncertChapters(classroom.grade, s.name)?.chapters ?? []).map((c) => c.toLowerCase()));
              return { id: s.id, name: s.name, color: s.color, indexSource: s.indexSource, ncertAvailable: index.size > 0, chapters: s.chapters.map((c) => ({ id: c.id, name: c.name, ncert: index.has(c.name.toLowerCase()), notes: c._count.notes, items: c._count.flashcards + c._count.questions })) };
            })} />
        ) : subjects.length === 0 ? (
          <EmptyState title="No subjects yet" description={room ? "The student head hasn't added any yet." : "Your teacher hasn't added any yet."} />
        ) : (
          <ul className="divide-y divide-border rounded-xl border border-border">
            {subjects.map((s) => (
              <li key={s.id}>
                <details>
                  <summary className="flex cursor-pointer items-center gap-2 px-3 py-2.5 text-sm">
                    <SubjectDot color={subjectColor(s.color)} /> <span className="font-medium">{s.name}</span>
                    <span className="ml-auto text-xs text-muted">{plural(notesBy.get(s.id) ?? 0, "note")} · {plural(s.chapters.length, "chapter")}</span>
                    <Chevron className="size-4" />
                  </summary>
                  <div className="px-3 pb-3">
                    {s.chapters.length === 0 ? <p className="text-xs text-muted">No chapters yet</p> : (
                      <ol className="list-decimal space-y-1 pl-5 text-sm text-muted">{s.chapters.map((c) => <li key={c.id}>{c.name}</li>)}</ol>
                    )}
                    <Link href={`/classes/${id}/notebook?subject=${s.id}`} className="mt-2 inline-block text-sm font-medium text-primary hover:underline">Open {s.name} notes →</Link>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </Collapsible>

      {teacher && (
        <Collapsible icon={<Users className="size-5" />} title="Students" defaultOpen={pendingConsent > 0}
          meta={students.length ? `${plural(students.length, "student")}${pendingConsent ? ` · ${pendingConsent} consent form${pendingConsent === 1 ? "" : "s"} to confirm` : ""}` : "No students yet"}>
          <p className="mb-2 text-sm text-muted">Confirm signed consent forms and choose who can add notes.</p>
          <Roster rows={students.map((m) => ({ membershipId: m.id, name: m.user.name, email: m.user.email, guardianName: m.user.guardianName, joinedAt: m.joinedAt.toISOString(), consentVerified: !!m.consentVerifiedAt, canUpload: m.canUpload }))} />
        </Collapsible>
      )}

      {teacher && (
        <Collapsible icon={<Users className="size-5" />} title="Teachers" defaultOpen={isOwner && teacherRequests > 0}
          meta={`${plural(teacherRows.length - teacherRequests, "teacher")}${teacherRequests ? ` · ${teacherRequests} request${teacherRequests === 1 ? "" : "s"} to join` : ""}`}>
          <p className="mb-2 text-sm text-muted">{isOwner ? "Other teachers can request to join with the class code. Approve only teachers you know." : "The teacher who created the class manages this list."}</p>
          <Teachers rows={teacherRows} canManage={isOwner} />
        </Collapsible>
      )}

      {room && (
        <Collapsible icon={<Users className="size-5" />} title="Members" meta={plural(members.length, "member")} data-testid="room-members">
          <RoomMembers rows={members} canRemove={manageMembers} />
        </Collapsible>
      )}

      {room && (
        <Collapsible icon={<Users className="size-5" />} title="Supervising teachers" defaultOpen={isOwner && supervisorRequests > 0} data-testid="room-supervisors"
          meta={`${plural(supervisors.length - supervisorRequests, "teacher")}${supervisorRequests ? ` · ${supervisorRequests} request${supervisorRequests === 1 ? "" : "s"}` : ""}`}>
          <p className="mb-2 text-sm text-muted">{isOwner ? "Approve only teachers you know. They can look at everything in the room, and do only what you tick." : "The student head chooses what each teacher can do here."}</p>
          <Supervisors rows={supervisors} canManage={isOwner} />
        </Collapsible>
      )}

      <Link href={`/settings#class-${id}`} className="flex items-center gap-2 px-1 text-sm font-medium text-primary hover:underline" data-testid="class-settings-link">
        <Settings2 className="size-4" /> {can(access, "settings")
          ? (kind === "CLASS" ? "Class settings (name, class, AI, delete) are in Settings →" : kind === "ROOM" ? "Room settings (name, class, AI, delete) are in Settings →" : "Your space's settings (name, class, AI) are in Settings →")
          : kind === "CLASS" ? "Leave this class in Settings →" : "Leave this room in Settings →"}
      </Link>
    </div>
  );
}
