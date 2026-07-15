"use client";

import type { ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

export function Suggestions({ className, children, ...props }: ComponentProps<typeof ScrollArea>) {
  return (
    <ScrollArea className="w-full overflow-x-auto whitespace-nowrap" {...props}>
      <div className={cn("flex w-max flex-nowrap items-center gap-1.5", className)}>{children}</div>
      <ScrollBar className="hidden" orientation="horizontal" />
    </ScrollArea>
  );
}

export type SuggestionProps = Omit<ComponentProps<typeof Button>, "onClick"> & {
  suggestion: string;
  onClick?: (suggestion: string) => void;
};

export function Suggestion({ suggestion, onClick, className, children, ...props }: SuggestionProps) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className={cn("h-7 shrink-0 rounded-md px-2 text-xs", className)}
      onClick={() => onClick?.(suggestion)}
      {...props}
    >
      {children ?? suggestion}
    </Button>
  );
}
