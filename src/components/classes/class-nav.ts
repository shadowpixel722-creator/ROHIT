import { BookOpen, CalendarDays, ClipboardList, MessageCircleQuestion, ClipboardCheck, FileText, GraduationCap, Home, Layers, LayoutDashboard, Lightbulb, NotebookPen, ScrollText, SquareStack, Swords, Target, type LucideIcon } from "lucide-react";

export type ClassNavItem = { slug: string; label: string; Icon: LucideIcon; hint?: string };
export type ClassNavSection = { id: string; label: string; Icon: LucideIcon; items: ClassNavItem[] };

/**
 * How someone sees a class, room or space:
 *  teacher: a classroom's teacher · student: a classroom's student · member: a student in a student room or their own space
 *  (no homework there) · supervisor: a teacher looking after a student room.
 */
export type ClassView = "teacher" | "student" | "member" | "supervisor";

export function classView(kind: string, role: string): ClassView {
  if (role === "SUPERVISOR") return "supervisor";
  if (kind !== "CLASS") return "member";
  return role === "TEACHER" ? "teacher" : "student";
}

/** "Teacher", "Student head", "Supervisor"…, for badges and the class switcher. */
export function viewLabel(kind: string, view: ClassView, owner: boolean) {
  if (kind === "PERSONAL") return "My space";
  if (kind === "ROOM") return view === "supervisor" ? "Supervisor" : owner ? "Student head" : "Room member";
  return view === "teacher" ? "Teacher" : "Student";
}

/**
 * A class's pages, grouped into a few sections instead of one long row of tabs. The sidebar lists
 * the sections with their pages; inside a page, the section's pages appear as sub-tabs. On phones
 * the bottom bar shows the sections. `slug` is the path after /classes/[id] ("" is the Overview).
 */
export function classSections(view: ClassView): ClassNavSection[] {
  const last: ClassNavSection[] =
    view === "teacher" ? [{ id: "teach", label: "Teach", Icon: GraduationCap, items: [
      { slug: "review", label: "Review", Icon: ClipboardCheck, hint: "Notes waiting for you" },
      { slug: "homework", label: "Homework", Icon: ClipboardList, hint: "Make, publish and mark homework" },
      { slug: "dashboard", label: "Class dashboard", Icon: LayoutDashboard, hint: "How the class is doing" },
    ] }]
    : view === "supervisor" ? []
    : [{ id: "mine", label: "Me", Icon: NotebookPen, items: [
      ...(view === "student" ? [{ slug: "homework", label: "Homework", Icon: ClipboardList, hint: "Your homework and marks" }] : []),
      { slug: "mine", label: "My notes", Icon: FileText, hint: "Notes you've shared" },
      { slug: "dashboard", label: "My progress", Icon: LayoutDashboard, hint: "How you're doing" },
    ] }];
  return [
    { id: "learn", label: "Learn", Icon: Lightbulb, items: [
      { slug: "", label: "Overview", Icon: Home, hint: "What's new in this class" },
      { slug: "notebook", label: "Notebook", Icon: BookOpen, hint: "The shared class notes" },
      { slug: "explain", label: "Explain", Icon: Lightbulb, hint: "Lessons explained, in 3D" },
      { slug: "ask", label: "Ask", Icon: MessageCircleQuestion, hint: "Ask the AI tutor a doubt" },
    ] },
    { id: "practise", label: "Practise", Icon: Layers, items: [
      { slug: "study", label: "Study", Icon: Layers, hint: "Quizzes and questions" },
      { slug: "flashcards", label: "Flashcards", Icon: SquareStack, hint: "Quick revision cards" },
      { slug: "mistakes", label: "Mistake Map", Icon: Target, hint: "What to fix next" },
      { slug: "boss", label: "Boss Battles", Icon: Swords, hint: "Revise by fighting a boss" },
    ] },
    { id: "plan", label: "Plan", Icon: CalendarDays, items: [
      { slug: "calendar", label: "Calendar", Icon: CalendarDays, hint: "Tests, exams and your plan" },
      { slug: "exam-patterns", label: "Exam patterns", Icon: ScrollText, hint: "What each exam covers" },
    ] },
    ...last,
  ];
}

/** Which item (and section) a path inside /classes/[id] belongs to. The add-note page belongs to the Notebook. */
export function activeItem(sections: ClassNavSection[], rest: string) {
  const first = rest.split("/")[0] === "new" ? "notebook" : rest.split("/")[0];
  for (const s of sections) for (const i of s.items) if (i.slug === first) return { section: s, item: i };
  return { section: sections[0], item: sections[0].items[0] };
}

/** "/classes/abc/study/x" → { id: "abc", rest: "study/x" }; null outside a class. */
export function parseClassPath(path: string) {
  const m = /^\/classes\/([^/]+)(?:\/(.*))?$/.exec(path);
  return m ? { id: m[1], rest: m[2] ?? "" } : null;
}
