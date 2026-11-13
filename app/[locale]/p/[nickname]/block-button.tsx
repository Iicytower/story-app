"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { useAction, ErrorText } from "@/components/action-form";
import { BlockDialog } from "@/components/block-dialog";
import { Button } from "@/components/ui/button";
import { unblockUser } from "./block-actions";

const BUTTON_CLASS =
  "h-auto min-h-8 max-w-full self-start [overflow-wrap:anywhere] whitespace-normal";

export function BlockButton({
  nickname,
  blocking,
}: {
  nickname: string;
  blocking: boolean;
}) {
  const t = useTranslations("blocking");
  const [confirm, setConfirm] = useState(false);
  const { error, pending, run } = useAction();
  const button = useRef<HTMLButtonElement>(null);
  const unblocked = useRef(false);

  // Unblocking swaps the button after the refresh; the focus follows to the new one.
  useEffect(() => {
    if (!unblocked.current || blocking) return;
    unblocked.current = false;
    button.current?.focus();
  }, [blocking]);

  return (
    <>
      {blocking ? (
        <div className="flex flex-col items-start gap-1">
          <Button
            ref={button}
            variant="outline"
            disabled={pending}
            onClick={() => {
              unblocked.current = true;
              run(() => unblockUser(nickname));
            }}
            className={BUTTON_CLASS}
          >
            {t("unblockUser", { nickname })}
          </Button>
          <ErrorText error={error} />
        </div>
      ) : (
        <Button
          ref={button}
          variant="outline"
          onClick={() => setConfirm(true)}
          className={BUTTON_CLASS}
        >
          {t("blockUser", { nickname })}
        </Button>
      )}
      {/* Outside the switch, so it stays mounted while the new button takes the focus. */}
      <BlockDialog
        open={confirm}
        onOpenChange={setConfirm}
        nickname={nickname}
        returnFocus={() => button.current}
      />
    </>
  );
}
