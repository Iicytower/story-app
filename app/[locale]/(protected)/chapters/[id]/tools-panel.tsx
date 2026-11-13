import { useTranslations } from "next-intl";
import { Suspense } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { type Tool, TOOLS } from "./tools";

export function ToolsPanel({ onOpen }: { onOpen: (tool: Tool) => void }) {
  const t = useTranslations("tools");
  return (
    <ul
      aria-label={t("list")}
      className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2 overflow-y-auto p-4"
    >
      {TOOLS.map((tool) => (
        <li key={tool.id}>
          <button
            type="button"
            onClick={() => onOpen(tool)}
            className="hover:bg-muted flex h-full w-full flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm font-medium"
          >
            <tool.icon className="text-muted-foreground size-5" />
            {t(`items.${tool.id}.label`)}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ToolDialog({
  tool,
  onClose,
  onCloseAutoFocus,
}: {
  tool: Tool | null;
  onClose: () => void;
  onCloseAutoFocus?: (event: Event) => void;
}) {
  const t = useTranslations("tools");
  return (
    <Dialog open={tool !== null} onOpenChange={(open) => !open && onClose()}>
      {tool && (
        <DialogContent
          className={tool.dialogClassName}
          onCloseAutoFocus={onCloseAutoFocus}
        >
          <DialogHeader>
            <DialogTitle>{t(`items.${tool.id}.label`)}</DialogTitle>
            {!tool.ownDescription && (
              <DialogDescription>
                {t(`items.${tool.id}.description`)}
              </DialogDescription>
            )}
          </DialogHeader>
          <Suspense
            fallback={
              <p className="text-muted-foreground text-sm">{t("loading")}</p>
            }
          >
            <tool.View />
          </Suspense>
        </DialogContent>
      )}
    </Dialog>
  );
}
