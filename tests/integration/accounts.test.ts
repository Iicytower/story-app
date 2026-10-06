import bcrypt from "bcryptjs";
import { describe, expect, it } from "vitest";
import { createOrUpdateUser, userExists } from "@/lib/accounts";
import { User } from "@/lib/models/user";
import { setupTestDb } from "./test-db";

setupTestDb();

describe("createOrUpdateUser", () => {
  it("creates an account with a verifiable bcrypt hash", async () => {
    await expect(
      createOrUpdateUser("alice@example.com", "secret-1"),
    ).resolves.toBe("created");

    const user = await User.findOne({ email: "alice@example.com" }).lean();
    expect(user?.createdAt).toBeInstanceOf(Date);
    expect(user?.passwordHash).not.toBe("secret-1");
    await expect(bcrypt.compare("secret-1", user!.passwordHash)).resolves.toBe(
      true,
    );
  });

  it("stores the email lowercase and trimmed", async () => {
    await createOrUpdateUser("  Alice@Example.COM ", "secret-1");
    const users = await User.find().lean();
    expect(users.map((u) => u.email)).toEqual(["alice@example.com"]);
    await expect(userExists("ALICE@example.com")).resolves.toBe(true);
  });

  it("adds another account on a subsequent run", async () => {
    await createOrUpdateUser("alice@example.com", "secret-1");
    await expect(
      createOrUpdateUser("bob@example.com", "secret-2"),
    ).resolves.toBe("created");
    await expect(User.countDocuments()).resolves.toBe(2);
  });

  it("changes the password of an existing account", async () => {
    await createOrUpdateUser("alice@example.com", "old-secret");
    const before = await User.findOne({ email: "alice@example.com" }).lean();

    await expect(
      createOrUpdateUser("ALICE@example.com", "new-secret"),
    ).resolves.toBe("updated");

    const after = await User.findOne({ email: "alice@example.com" }).lean();
    expect(after?._id).toEqual(before?._id);
    expect(after?.createdAt).toEqual(before?.createdAt);
    await expect(
      bcrypt.compare("new-secret", after!.passwordHash),
    ).resolves.toBe(true);
    await expect(
      bcrypt.compare("old-secret", after!.passwordHash),
    ).resolves.toBe(false);
    await expect(User.countDocuments()).resolves.toBe(1);
  });

  it("reports a missing account as not existing", async () => {
    await expect(userExists("nobody@example.com")).resolves.toBe(false);
  });
});
