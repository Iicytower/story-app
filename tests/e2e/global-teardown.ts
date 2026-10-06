import { withE2EDb } from "./db";

export default async function globalTeardown() {
  await withE2EDb((connection) => connection.dropDatabase());
}
