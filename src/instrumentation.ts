/** Runs once when the server starts: resume any handwriting reading interrupted by a restart. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("./instrumentation-node");
  }
}
