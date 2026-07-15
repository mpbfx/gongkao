"use client";

import { ChevronDown, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export function FilterPopover({
  label = "筛选",
  activeCount = 0,
  children,
  className,
}: {
  label?: string;
  activeCount?: number;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      <Button
        type="button"
        variant="outline"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((value) => !value)}
      >
        {label}{activeCount > 0 ? ` ${activeCount}` : ""}
        <ChevronDown className={cn("transition-transform", open && "rotate-180")} data-icon="inline-end" />
      </Button>
      {open ? (
        <div
          id={panelId}
          data-slot="student-filter-popover"
          role="dialog"
          aria-label={label}
          className="absolute right-0 top-[calc(100%+0.5rem)] z-40 w-[min(24rem,calc(100vw-2rem))] border bg-popover p-4 text-popover-foreground shadow-xl"
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

export function ResponsiveDrawer({
  open,
  onOpenChange,
  title,
  description,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="assistant" className={cn("flex min-h-0 flex-col p-0", className)}>
        <DialogHeader className="relative border-b pr-14">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
          <DialogClose className="absolute right-3 top-3"><X aria-hidden="true" /></DialogClose>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 overflow-y-auto p-0">{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function BottomSheet(props: React.ComponentProps<typeof ResponsiveDrawer>) {
  const { open, onOpenChange, title, description, children, className } = props;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent variant="sheet" className={cn("flex max-h-[88dvh] flex-col p-0", className)}>
        <DialogHeader className="relative border-b pr-14">
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
          <DialogClose className="absolute right-3 top-3"><X aria-hidden="true" /></DialogClose>
        </DialogHeader>
        <DialogBody className="min-h-0 flex-1 overflow-y-auto p-0">{children}</DialogBody>
      </DialogContent>
    </Dialog>
  );
}

export function StickyActionBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("sticky bottom-0 z-20 flex min-h-16 items-center justify-end gap-2 border-t bg-background/95 px-4 py-3 shadow-[0_-8px_24px_rgb(15_23_42/0.08)] backdrop-blur", className)}>
      {children}
    </div>
  );
}

export function Tooltip({ label, children }: { label: string; children: React.ReactNode }) {
  return <span className="inline-flex" title={label} aria-label={label}>{children}</span>;
}
