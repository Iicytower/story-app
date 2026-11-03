import { headers } from "next/headers";

// The address the visitor used, so production and staging each link to themselves.
export async function requestOrigin(): Promise<string> {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  return `${h.get("x-forwarded-proto") ?? "http"}://${host}`;
}
