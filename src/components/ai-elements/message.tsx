"use client";

import { cjk } from "@streamdown/cjk";
import { code } from "@streamdown/code";
import { math } from "@streamdown/math";
import type { UIMessage } from "ai";
import type { ComponentProps, HTMLAttributes } from "react";
import { memo } from "react";
import { Streamdown } from "streamdown";

import { cn } from "@/lib/utils";

export type MessageProps = HTMLAttributes<HTMLDivElement> & {
  from: UIMessage["role"];
};

export function Message({ className, from, ...props }: MessageProps) {
  return (
    <div
      data-role={from}
      className={cn(
        "group flex w-full max-w-[96%] flex-col gap-2",
        from === "user" ? "is-user ml-auto items-end" : "is-assistant",
        className
      )}
      {...props}
    />
  );
}

export function MessageContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex min-w-0 max-w-full flex-col gap-2 text-sm",
        "group-[.is-user]:w-fit group-[.is-user]:rounded-md group-[.is-user]:bg-primary/10 group-[.is-user]:px-3 group-[.is-user]:py-2",
        "group-[.is-assistant]:w-full",
        className
      )}
      {...props}
    />
  );
}

export type MessageResponseProps = ComponentProps<typeof Streamdown>;
const streamdownPlugins = { cjk, code, math };

export const MessageResponse = memo(
  ({ className, ...props }: MessageResponseProps) => (
    <Streamdown
      className={cn(
        "size-full text-sm leading-6 [&>*:first-child]:mt-0 [&>*:last-child]:mb-0",
        className
      )}
      plugins={streamdownPlugins}
      {...props}
    />
  ),
  (previous, next) => previous.children === next.children && previous.isAnimating === next.isAnimating
);

MessageResponse.displayName = "MessageResponse";
