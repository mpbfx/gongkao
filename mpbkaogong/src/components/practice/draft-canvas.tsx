"use client";

import { PenLine, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type DraftCanvasValue = {
  dataUrl: string;
  mimeType: string;
  width: number;
  height: number;
  updatedAt: string;
};

type DraftCanvasProps = {
  open: boolean;
  value?: DraftCanvasValue | null;
  readOnly?: boolean;
  questionLabel?: string;
  variant?: "overlay";
  onChange?: (value: DraftCanvasValue | null) => void;
  onClear?: () => void;
  onClose: () => void;
};

const MAX_DATA_URL_LENGTH = 1_000_000;

function getPoint(event: React.PointerEvent<HTMLCanvasElement>, canvas: HTMLCanvasElement) {
  const rect = canvas.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function configureContext(context: CanvasRenderingContext2D) {
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 3;
  context.strokeStyle = "hsl(0 0% 12%)";
  context.globalCompositeOperation = "source-over";
}

function exportCanvas(canvas: HTMLCanvasElement): DraftCanvasValue | null {
  const context = canvas.getContext("2d");

  if (!context) {
    return null;
  }

  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  let hasInk = false;

  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] > 0) {
      hasInk = true;
      break;
    }
  }

  if (!hasInk) {
    return null;
  }

  const attempts = [
    { scale: 1, quality: 0.82 },
    { scale: 0.85, quality: 0.72 },
    { scale: 0.7, quality: 0.62 },
  ];

  for (const attempt of attempts) {
    const targetCanvas =
      attempt.scale === 1 ? canvas : document.createElement("canvas");

    if (attempt.scale !== 1) {
      targetCanvas.width = Math.max(1, Math.floor(canvas.width * attempt.scale));
      targetCanvas.height = Math.max(1, Math.floor(canvas.height * attempt.scale));
      targetCanvas.getContext("2d")?.drawImage(canvas, 0, 0, targetCanvas.width, targetCanvas.height);
    }

    let dataUrl = targetCanvas.toDataURL("image/webp", attempt.quality);
    let mimeType = dataUrl.startsWith("data:image/webp") ? "image/webp" : "image/png";

    if (dataUrl.length > MAX_DATA_URL_LENGTH && attempt.scale < 1) {
      dataUrl = targetCanvas.toDataURL("image/png");
      mimeType = "image/png";
    }

    if (dataUrl.length <= MAX_DATA_URL_LENGTH || attempt === attempts[attempts.length - 1]) {
      return {
        dataUrl,
        mimeType,
        width: targetCanvas.width,
        height: targetCanvas.height,
        updatedAt: new Date().toISOString(),
      };
    }
  }

  return null;
}

export function DraftCanvas({
  open,
  value,
  readOnly = false,
  questionLabel,
  variant = "overlay",
  onChange,
  onClear,
  onClose,
}: DraftCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const restoreKeyRef = useRef<string | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);

  const emitChange = useCallback(() => {
    const canvas = canvasRef.current;

    if (!canvas || !onChange) {
      return;
    }

    onChange(exportCanvas(canvas));
  }, [onChange]);

  const scheduleChange = useCallback(() => {
    if (!onChange) {
      return;
    }

    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null;
      emitChange();
    }, 500);
  }, [emitChange, onChange]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const ratio = window.devicePixelRatio || 1;
      const previous = document.createElement("canvas");
      previous.width = canvas.width;
      previous.height = canvas.height;
      previous.getContext("2d")?.drawImage(canvas, 0, 0);

      canvas.width = Math.max(1, Math.floor(rect.width * ratio));
      canvas.height = Math.max(1, Math.floor(rect.height * ratio));

      const context = canvas.getContext("2d");

      if (!context) {
        return;
      }

      if (previous.width > 0 && previous.height > 0) {
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.drawImage(previous, 0, 0, canvas.width, canvas.height);
      }

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      configureContext(context);
    };

    resize();
    window.addEventListener("resize", resize);

    return () => window.removeEventListener("resize", resize);
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const restoreKey = value?.dataUrl ?? "empty";

    if (restoreKeyRef.current === restoreKey) {
      return;
    }

    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    restoreKeyRef.current = restoreKey;
    undoStackRef.current = [];
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!value?.dataUrl) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
      configureContext(context);
    };
    image.src = value.dataUrl;
  }, [open, value?.dataUrl]);

  if (!open) {
    return null;
  }

  function pushUndoSnapshot(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    undoStackRef.current = [...undoStackRef.current.slice(-9), context.getImageData(0, 0, canvas.width, canvas.height)];
  }

  function clearCanvas() {
    if (readOnly) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (!canvas || !context) {
      return;
    }

    pushUndoSnapshot(canvas);
    context.clearRect(0, 0, canvas.width, canvas.height);
    onClear?.();
    onChange?.(null);
  }

  function startDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (readOnly) {
      return;
    }

    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    const point = getPoint(event, canvas);

    if (!context) {
      return;
    }

    pushUndoSnapshot(canvas);
    canvas.setPointerCapture(event.pointerId);
    configureContext(context);
    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsDrawing(true);
  }

  function draw(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawing || readOnly) {
      return;
    }

    const canvas = event.currentTarget;
    const context = canvas.getContext("2d");
    const point = getPoint(event, canvas);

    if (!context) {
      return;
    }

    context.lineTo(point.x, point.y);
    context.stroke();
  }

  function stopDrawing(event: React.PointerEvent<HTMLCanvasElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (isDrawing) {
      scheduleChange();
    }

    setIsDrawing(false);
  }

  function closeCanvas() {
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }

    if (!readOnly) {
      emitChange();
    }
    onClose();
  }

  const isReadonly = readOnly || variant !== "overlay";

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 top-16 z-40 md:bottom-24 lg:left-[var(--app-sidebar-width)] lg:right-[320px] lg:top-20">
      <div className="relative mx-auto h-full max-w-5xl">
        <div className="pointer-events-auto absolute right-3 top-3 z-10 flex items-center gap-1 rounded-md border bg-background/90 p-1 shadow-sm lg:right-0">
          <div className="hidden max-w-28 truncate px-2 text-xs text-muted-foreground sm:block">
            {questionLabel ?? "草稿"}
          </div>
          {!isReadonly ? (
            <>
              <Button type="button" variant="secondary" size="icon-sm" aria-label="画笔">
                <PenLine data-icon="icon" />
              </Button>
              <Button type="button" variant="ghost" size="icon-sm" aria-label="清空草稿" onClick={clearCanvas}>
                <Trash2 data-icon="icon" />
              </Button>
            </>
          ) : null}
          <Button type="button" variant="ghost" size="icon-sm" aria-label="关闭草稿纸" onClick={closeCanvas}>
            <X data-icon="icon" />
          </Button>
        </div>
        <canvas
          ref={canvasRef}
          className={cn(
            "pointer-events-auto h-full w-full touch-none bg-transparent",
            isReadonly && "pointer-events-none"
          )}
          aria-label="草稿纸画布"
          onPointerDown={startDrawing}
          onPointerMove={draw}
          onPointerCancel={stopDrawing}
          onPointerLeave={stopDrawing}
          onPointerUp={stopDrawing}
        />
      </div>
    </div>
  );
}
