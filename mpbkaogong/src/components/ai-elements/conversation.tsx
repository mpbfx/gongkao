"use client";

import { ArrowDown } from "lucide-react";
import type { ComponentProps } from "react";
import { useCallback } from "react";
import { StickToBottom, useStickToBottomContext } from "use-stick-to-bottom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ConversationProps = ComponentProps<typeof StickToBottom>;

export function Conversation({ className, ...props }: ConversationProps) {
  return (
    <StickToBottom
      className={cn("relative flex-1 overflow-y-hidden", className)}
      initial="smooth"
      resize="smooth"
      role="log"
      aria-live="polite"
      {...props}
    />
  );
}

export type ConversationContentProps = ComponentProps<typeof StickToBottom.Content>;

export function ConversationContent({ className, ...props }: ConversationContentProps) {
  return <StickToBottom.Content className={cn("flex flex-col gap-3 p-3", className)} {...props} />;
}

export type ConversationEmptyStateProps = ComponentProps<"div"> & {
  title: string;
  description?: string;
};

export function ConversationEmptyState({
  className,
  title,
  description,
  ...props
}: ConversationEmptyStateProps) {
  return (
    <div
      className={cn("flex size-full min-h-40 flex-col items-center justify-center gap-1.5 p-4 text-center", className)}
      {...props}
    >
      <p className="text-sm font-medium">{title}</p>
      {description ? <p className="text-xs leading-5 text-muted-foreground">{description}</p> : null}
    </div>
  );
}

export function ConversationScrollButton({ className, ...props }: ComponentProps<typeof Button>) {
  const { isAtBottom, scrollToBottom } = useStickToBottomContext();
  const handleClick = useCallback(() => scrollToBottom(), [scrollToBottom]);

  if (isAtBottom) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-sm"
      aria-label="回到底部"
      className={cn("absolute bottom-3 left-1/2 -translate-x-1/2 rounded-full bg-card", className)}
      onClick={handleClick}
      {...props}
    >
      <ArrowDown data-icon="icon" />
    </Button>
  );
}
