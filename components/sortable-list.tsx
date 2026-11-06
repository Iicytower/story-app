"use client";

import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  type UniqueIdentifier,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVerticalIcon } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useOptimistic, useState, useTransition } from "react";
import type { ActionResult } from "@/lib/action-result";

type Item = { id: string; name: string; content: React.ReactNode };

// A list whose rows can be dragged by a handle on the left when `sortable` is set. The new
// order shows at once and goes back if the action fails.
export function SortableList({
  label,
  items,
  sortable,
  action,
  className,
  itemClassName,
}: {
  label: string;
  items: Item[];
  sortable: boolean;
  action: (id: string, index: number) => Promise<ActionResult>;
  className?: string;
  itemClassName?: string;
}) {
  const [order, setOrder] = useOptimistic(items.map((item) => item.id));
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const contextId = useId();
  const t = useTranslations("menu");
  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    // Held for a moment first, so a tap or a quick swipe does not move the row.
    useSensor(TouchSensor, {
      activationConstraint: { delay: 250, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const byId = new Map(items.map((item) => [item.id, item]));
  const shown = order.flatMap((id) => byId.get(id) ?? []);
  const name = (id: UniqueIdentifier) => byId.get(String(id))?.name ?? "";
  const position = (id: UniqueIdentifier) => ({
    position: order.indexOf(String(id)) + 1,
    total: order.length,
  });

  function handleDragEnd({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const id = String(active.id);
    const index = order.indexOf(String(over.id));
    setError(null);
    startTransition(async () => {
      setOrder(arrayMove(order, order.indexOf(id), index));
      const result = await action(id, index);
      if (!result.ok) setError(result.message);
    });
  }

  const list = (
    <ul aria-label={label} className={className}>
      {shown.map((item) => (
        <SortableRow
          key={item.id}
          id={item.id}
          name={item.name}
          sortable={sortable}
          className={itemClassName}
        >
          {item.content}
        </SortableRow>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {sortable ? (
        <DndContext
          id={contextId}
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          accessibility={{
            screenReaderInstructions: { draggable: t("dragInstructions") },
            announcements: {
              onDragStart: ({ active }) =>
                t("pickedUp", { name: name(active.id) }),
              onDragOver: ({ active, over }) =>
                over
                  ? t("movedOver", {
                      name: name(active.id),
                      ...position(over.id),
                    })
                  : undefined,
              onDragEnd: ({ active, over }) =>
                over
                  ? t("dropped", {
                      name: name(active.id),
                      ...position(over.id),
                    })
                  : undefined,
              onDragCancel: ({ active }) =>
                t("cancelled", { name: name(active.id) }),
            },
          }}
        >
          <SortableContext items={order} strategy={verticalListSortingStrategy}>
            {list}
          </SortableContext>
        </DndContext>
      ) : (
        list
      )}
    </div>
  );
}

function SortableRow({
  id,
  name,
  sortable,
  className,
  children,
}: {
  id: string;
  name: string;
  sortable: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  if (!sortable) return <li className={className}>{children}</li>;
  return (
    <DraggableRow id={id} name={name} className={className}>
      {children}
    </DraggableRow>
  );
}

function DraggableRow({
  id,
  name,
  className,
  children,
}: {
  id: string;
  name: string;
  className?: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("menu");
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${className ?? ""} ${isDragging ? "bg-background relative z-10 shadow-md" : ""}`}
    >
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={t("dragHandle", { name })}
        // The handle owns touch gestures; the rest of the row still scrolls the page.
        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 flex w-8 shrink-0 cursor-grab touch-none items-center justify-center self-stretch rounded-md outline-none focus-visible:ring-3 active:cursor-grabbing"
      >
        <GripVerticalIcon className="size-4" />
      </button>
      {children}
    </li>
  );
}
