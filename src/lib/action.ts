import "server-only";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AuthError } from "./auth";
import type { ActionResult } from "./types";
import { firstError } from "./validation";

export class UserError extends Error {}

/** Wraps a server action body so the client always receives a typed result instead of a thrown error. */
export async function run<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return { ok: true, data };
  } catch (e) {
    if (e instanceof ZodError) return { ok: false, error: firstError(e) };
    if (e instanceof AuthError || e instanceof UserError) return { ok: false, error: e.message };
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025")
      return { ok: false, error: "That item no longer exists. Refresh the page and try again." };
    console.error(e);
    return { ok: false, error: "Something went wrong while saving. Please try again." };
  }
}
