import { Vault } from "@/components/vault";
import { PageHeader } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = { title: "My files" };

export default async function FilesPage() {
  const user = await requireUser();
  const subjects = await db.subject.findMany({
    where: { classroom: { OR: [{ teacherId: user.id }, { members: { some: { userId: user.id, status: "ACTIVE" } } }] } },
    select: { name: true }, distinct: ["name"], orderBy: { name: "asc" },
  });
  return (
    <div className="space-y-5">
      <PageHeader title="My files" description="Keep slides, readings, photos of handwritten notes and your own notes, sorted by subject. They stay on this device only: nothing is uploaded, and nobody else can see them." />
      <Vault subjects={subjects.map((s) => s.name)} />
    </div>
  );
}
