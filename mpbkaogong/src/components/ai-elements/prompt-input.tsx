"use client";

import type { ChatStatus } from "ai";
import { LoaderCircle, Send, Square, X } from "lucide-react";
import type { ComponentProps, FormEvent, KeyboardEvent } from "react";
import { useState } from "react";

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupTextarea,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";

export type PromptInputProps = Omit<ComponentProps<"form">, "onSubmit"> & {
  onSubmit: (message: { text: string }, event: FormEvent<HTMLFormElement>) => void | Promise<void>;
};

export function PromptInput({ className, children, onSubmit, ...props }: PromptInputProps) {
  return (
    <form
      className={cn("w-full", className)}
      onSubmit={(event) => {
        event.preventDefault();
        const formData = new FormData(event.currentTarget);
        const text = String(formData.get("message") ?? "");
        void onSubmit({ text }, event);
      }}
      {...props}
    >
      <InputGroup>{children}</InputGroup>
    </form>
  );
}

export function PromptInputBody(props: ComponentProps<"div">) {
  return <div className="contents" {...props} />;
}

export function PromptInputTextarea({ onKeyDown, ...props }: ComponentProps<typeof InputGroupTextarea>) {
  const [isComposing, setIsComposing] = useState(false);

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || event.key !== "Enter" || event.shiftKey || isComposing || event.nativeEvent.isComposing) {
      return;
    }

    event.preventDefault();
    const submit = event.currentTarget.form?.querySelector<HTMLButtonElement>('button[type="submit"]');
    if (!submit?.disabled) {
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <InputGroupTextarea
      name="message"
      placeholder="继续追问…"
      onCompositionStart={() => setIsComposing(true)}
      onCompositionEnd={() => setIsComposing(false)}
      onKeyDown={handleKeyDown}
      {...props}
    />
  );
}

export function PromptInputFooter({ className, ...props }: ComponentProps<typeof InputGroupAddon>) {
  return <InputGroupAddon align="block-end" className={cn("justify-end", className)} {...props} />;
}

export type PromptInputSubmitProps = ComponentProps<typeof InputGroupButton> & {
  status?: ChatStatus;
  onStop?: () => void;
};

export function PromptInputSubmit({ status, onStop, onClick, ...props }: PromptInputSubmitProps) {
  const isGenerating = status === "submitted" || status === "streaming";

  return (
    <InputGroupButton
      type={isGenerating ? "button" : "submit"}
      size="icon-sm"
      variant="default"
      aria-label={isGenerating ? "停止生成" : "发送"}
      onClick={(event) => {
        if (isGenerating) {
          onStop?.();
          return;
        }
        onClick?.(event);
      }}
      {...props}
    >
      {status === "submitted" ? (
        <LoaderCircle className="animate-spin" data-icon="icon" />
      ) : status === "streaming" ? (
        <Square data-icon="icon" />
      ) : status === "error" ? (
        <X data-icon="icon" />
      ) : (
        <Send data-icon="icon" />
      )}
    </InputGroupButton>
  );
}
