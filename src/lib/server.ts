import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_TZ, isValidTimeZone, todayKey } from "./dates";

export async function getTimeZone() {
  const tz = decodeURIComponent((await cookies()).get("ep_tz")?.value ?? "");
  return isValidTimeZone(tz) ? tz : DEFAULT_TZ;
}

export async function getToday() {
  return todayKey(await getTimeZone());
}
