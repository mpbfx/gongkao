"use client"

import * as React from "react"
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog"
import { X } from "lucide-react"

import { cn } from "@/lib/utils"

function Dialog(props: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root {...props} />
}

function DialogPortal(props: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal {...props} />
}

function DialogBackdrop({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-backdrop"
      className={cn("fixed inset-0 z-50 bg-background/75 backdrop-blur-sm", className)}
      {...props}
    />
  )
}

function DialogContent({
  className,
  variant = "modal",
  children,
  initialFocus,
  finalFocus,
  ...props
}: DialogPrimitive.Popup.Props & { variant?: "modal" | "sheet" }) {
  return (
    <DialogPortal>
      <DialogBackdrop />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        initialFocus={initialFocus ?? true}
        finalFocus={finalFocus ?? true}
        className={cn(
          "fixed z-50 border bg-card text-card-foreground shadow-lg outline-none",
          "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
          variant === "modal" &&
            "left-1/2 top-1/2 w-[calc(100vw-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg",
          variant === "sheet" &&
            "inset-x-0 bottom-0 max-h-[82dvh] rounded-t-xl lg:left-1/2 lg:right-auto lg:top-1/2 lg:bottom-auto lg:w-[calc(100vw-2rem)] lg:max-w-md lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rounded-lg",
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Popup>
    </DialogPortal>
  )
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex flex-col gap-1 p-4 pb-3", className)}
      {...props}
    />
  )
}

function DialogTitle({
  className,
  ...props
}: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn("text-base font-semibold leading-snug", className)}
      {...props}
    />
  )
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn("text-sm leading-6 text-muted-foreground", className)}
      {...props}
    />
  )
}

function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn("px-4 pb-4", className)}
      {...props}
    />
  )
}

function DialogFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn("flex items-center justify-end gap-2 border-t bg-muted/50 p-4", className)}
      {...props}
    />
  )
}

function DialogClose({
  className,
  children,
  "aria-label": ariaLabel,
  ...props
}: DialogPrimitive.Close.Props) {
  const hasChildren = React.Children.count(children) > 0

  return (
    <DialogPrimitive.Close
      data-slot="dialog-close"
      aria-label={ariaLabel ?? (hasChildren ? undefined : "关闭")}
      className={cn(
        "inline-flex items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
        hasChildren ? "min-h-11 min-w-11 px-3 lg:min-h-8 lg:min-w-8 lg:px-2" : "size-11 p-0 lg:size-8",
        className
      )}
      {...props}
    >
      {children ?? <X aria-hidden="true" />}
    </DialogPrimitive.Close>
  )
}

export {
  Dialog,
  DialogPortal,
  DialogBackdrop,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogFooter,
  DialogClose,
}
