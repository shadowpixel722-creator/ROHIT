import { backfill, kickQueue, recoverStuck } from "./lib/transcribe";

// On startup: resume interrupted pages, and catch up on approved pages that were never converted.
await recoverStuck().catch(() => {});
await backfill().catch(() => {});
kickQueue();
