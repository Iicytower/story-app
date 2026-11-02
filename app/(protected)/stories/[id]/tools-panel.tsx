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
  return (
    <ul
      aria-label="Tools"
      className="grid min-h-0 flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(8rem,1fr))] gap-2 overflow-y-auto p-3"
    >
      {TOOLS.map((tool) => (
        <li key={tool.id}>
          <button
            type="button"
            onClick={() => onOpen(tool)}
            className="hover:bg-muted flex h-full w-full flex-col items-start gap-2 rounded-lg border p-3 text-left text-sm font-medium"
          >
            <tool.icon className="text-muted-foreground size-5" />
            {tool.label}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function ToolDialog({
  tool,
  onClose,
}: {
  tool: Tool | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={tool !== null} onOpenChange={(open) => !open && onClose()}>
      {tool && (
        <DialogContent className={tool.dialogClassName}>
          <DialogHeader>
            <DialogTitle>{tool.label}</DialogTitle>
            <DialogDescription>{tool.description}</DialogDescription>
          </DialogHeader>
          <Suspense
            fallback={<p className="text-muted-foreground text-sm">Loading…</p>}
          >
            <tool.View />
          </Suspense>
        </DialogContent>
      )}
    </Dialog>
  );
}
