"use client";

import { useState, useTransition } from "react";
import { changePassword } from "@/app/(protected)/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PASSWORD_REQUIREMENTS } from "@/lib/credentials";

export function ChangePasswordDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <ChangePasswordForm />
      </DialogContent>
    </Dialog>
  );
}

function ChangePasswordForm() {
  const [error, setError] = useState<string | null>(null);
  const [changed, setChanged] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await changePassword(
        data.get("currentPassword"),
        data.get("newPassword"),
        data.get("repeatedPassword"),
      );
      if (result.ok) setChanged(true);
      else setError(result.message);
    });
  }

  if (changed) {
    return (
      <div className="flex flex-col gap-4">
        <DialogHeader>
          <DialogTitle>Change password</DialogTitle>
        </DialogHeader>
        <p role="status" className="text-sm">
          Your password has been changed.
        </p>
        <DialogFooter>
          <DialogClose asChild>
            <Button>Close</Button>
          </DialogClose>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <DialogHeader>
        <DialogTitle>Change password</DialogTitle>
      </DialogHeader>
      <div className="flex flex-col gap-2">
        <Label htmlFor="current-password">Current password</Label>
        <Input
          id="current-password"
          name="currentPassword"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-password">New password</Label>
        <Input
          id="new-password"
          name="newPassword"
          type="password"
          autoComplete="new-password"
          aria-describedby="new-password-requirements"
          required
        />
        <div
          id="new-password-requirements"
          className="text-muted-foreground text-xs break-words"
        >
          <p>The password must contain:</p>
          <ul className="list-disc pl-4">
            {PASSWORD_REQUIREMENTS.map((requirement) => (
              <li key={requirement}>{requirement}</li>
            ))}
          </ul>
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor="repeated-password">Repeat new password</Label>
        <Input
          id="repeated-password"
          name="repeatedPassword"
          type="password"
          autoComplete="new-password"
          required
        />
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </Button>
      </DialogFooter>
    </form>
  );
}
