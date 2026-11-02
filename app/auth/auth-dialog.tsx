"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { LoginForm } from "./login-form";
import { RegisterForm } from "./register-form";

export function AuthDialog({
  defaultOpen,
  callbackUrl,
}: {
  defaultOpen: boolean;
  callbackUrl: string;
}) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const registering = mode === "register";

  return (
    <Dialog defaultOpen={defaultOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Log in / Create account</Button>
      </DialogTrigger>
      <DialogContent
        aria-describedby={undefined}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto"
      >
        <DialogHeader>
          <DialogTitle>
            {registering ? "Create account" : "Sign in"}
          </DialogTitle>
        </DialogHeader>
        {registering ? (
          <RegisterForm />
        ) : (
          <LoginForm callbackUrl={callbackUrl} />
        )}
        <p className="text-muted-foreground text-sm">
          {registering ? "Already have an account? " : "No account? "}
          <button
            type="button"
            className="underline"
            onClick={() => setMode(registering ? "login" : "register")}
          >
            {registering ? "Sign in" : "Create one"}
          </button>
        </p>
      </DialogContent>
    </Dialog>
  );
}
