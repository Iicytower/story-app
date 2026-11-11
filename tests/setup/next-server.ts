import { afterEach, vi } from "vitest";

// after() needs a request, which tests do not have. Tasks wait in a queue, as after the response:
// a test runs them with flushAfter() before reading their results, and whatever is left runs
// after each test, before the next one starts.
type Task = () => unknown;
// On globalThis: a test file importing flushAfter must see the queue of this setup's mock.
const store = globalThis as { afterTasks?: Task[] };
const queue = (store.afterTasks ??= []);

vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: Task | Promise<unknown>) => {
    queue.push(typeof task === "function" ? task : () => task);
  },
}));

// Tasks scheduled by running tasks run too.
export async function flushAfter(): Promise<void> {
  while (queue.length > 0) {
    await Promise.all(queue.splice(0).map((task) => task()));
  }
}

afterEach(flushAfter);
