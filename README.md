# Class Notebooks

A collaborative notebook app for school classes. Teachers create a class and share a join code. Students will share notebook pages, the teacher approves them, and homework and exams are built from the class's notes.

Status, decisions and roadmap: [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Getting started
```bash
cp .env.example .env      # DATABASE_URL="file:./dev.db"
npm run setup             # installs dependencies and creates the SQLite database
npm run dev               # http://localhost:3000
```
No accounts, API keys or paid services are needed.

## Scripts
| Command | What it does |
|---|---|
| `npm run dev` | Development server |
| `npm test` | Unit tests (Vitest) |
| `npm run test:e2e` | Builds, then runs browser tests (Playwright) against a separate `e2e.db`. On first run: `npx playwright install chromium` |
| `npm run typecheck` / `npm run lint` | Static checks |
| `npm run db:migrate` | Create or apply a migration after editing `prisma/schema.prisma` |

## Layout
```
prisma/schema.prisma     User (TEACHER | STUDENT), Session, Classroom, Membership, Subject, Chapter
src/app/(auth)/          login, register
src/app/(app)/classes/   class list (create or join), class page (code, subjects, roster, settings)
src/app/actions/         server actions: auth, classes, syllabus, account
src/lib/access.ts        server-side class access checks (teacher / member)
src/lib/join-code.ts     join-code generation and normalisation
```
