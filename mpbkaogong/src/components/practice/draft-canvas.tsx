"use client";

import { Eraser, Eye, EyeOff, PenLine, RotateCcw, Trash2, X } from "lucide-react";
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

type DraftTool = "pen" | "eraser";
type DraftBackground = "transparent" | "paper";

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

function configureContext(context: CanvasRenderingContext2D, tool: DraftTool) {
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = tool === "eraser" ? 18 : 3;
  context.strokeStyle = "hsl(0 0% 12%)";
  context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
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
  const [tool, setTool] = useState<DraftTool>("pen");
  const [background, setBackground] = useState<DraftBackground>("transparent");
  const [isDimmed, setIsDimmed] = useState(false);
  const [undoCount, setUndoCount] = useState(0);

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

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      configureContext(context, tool);

      if (previous.width > 0 && previous.height > 0) {
        context.drawImage(previous, 0, 0, rect.width, rect.height);
      }
    };

    resize();
    window.addEventListener("resize", resize);

    return () => window.removeEventListener("resize", resize);
  }, [open, tool]);

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
    setUndoCount(0);
    context.clearRect(0, 0, canvas.width, canvas.height);

    if (!value?.dataUrl) {
      return;
    }

    const image = new Image();
    image.onload = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
      configureContext(context, tool);
    };
    image.src = value.dataUrl;
  }, [open, tool, value?.dataUrl]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  if (!open) {
    return null;
  }

  function pushUndoSnapshot(canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    undoStackRef.current = [...undoStackRef.current.slice(-9), context.getImageData(0, 0, canvas.width, canvas.height)];
    setUndoCount(undoStackRef.current.length);
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

  function undo() {
    if (readOnly) {
      return;
    }

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const previous = undoStackRef.current.pop();

    if (!canvas || !context || !previous) {
      return;
    }

    context.putImageData(previous, 0, 0);
    configureContext(context, tool);
    setUndoCount(undoStackRef.current.length);
    scheduleChange();
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
    configureContext(context, tool);
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

  const hasUndo = undoCount > 0;
  const isPaper = background === "paper";
  const isReadonly = readOnly || variant !== "overlay";

  return (
    <div className="fixed inset-x-0 bottom-28 top-16 z-40 px-3 md:bottom-24 lg:left-[var(--app-sidebar-width)] lg:right-[calc(320px_+_1.5rem)] lg:top-20 lg:px-6">
      <div
        className={cn(
          "mx-auto flex h-full max-w-5xl flex-col overflow-hidden rounded-lg border shadow-lg",
          isPaper ? "bg-card" : isDimmed ? "bg-background/55 backdrop-blur-[2px]" : "bg-background/20 backdrop-blur-[1px]"
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-card/95 px-3 py-2 backdrop-blur">
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">草稿纸{questionLabel ? ` · ${questionLabel}` : ""}</div>
            <div className="text-xs text-muted-foreground">{isReadonly ? "只读回看" : "笔迹会按题自动保存"}</div>
          </div>
          <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
            {!isReadonly ? (
              <>
                <Button
                  type="button"
                  variant={tool === "pen" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="画笔"
                  onClick={() => setTool("pen")}
                >
                  <PenLine data-icon="icon" />
                </Button>
                <Button
                  type="button"
                  variant={tool === "eraser" ? "secondary" : "ghost"}
                  size="icon-sm"
                  aria-label="橡皮"
                  onClick={() => setTool("eraser")}
                >
                  <Eraser data-icon="icon" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label="撤销"
                  disabled={!hasUndo}
                  onClick={undo}
                >
                  <RotateCcw data-icon="icon" />
                </Button>
                <Button type="button" variant="ghost" size="icon-sm" aria-label="清空草稿" onClick={clearCanvas}>
                  <Trash2 data-icon="icon" />
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant={isDimmed ? "secondary" : "ghost"}
              size="icon-sm"
              aria-label={isDimmed ? "降低遮罩" : "增强遮罩"}
              onClick={() => setIsDimmed((current) => !current)}
            >
              {isDimmed ? <Eye data-icon="icon" /> : <EyeOff data-icon="icon" />}
            </Button>
            <Button
              type="button"
              variant={isPaper ? "secondary" : "ghost"}
              size="sm"
              onClick={() => setBackground((current) => (current === "paper" ? "transparent" : "paper"))}
            >
              {isPaper ? "白底" : "透明"}
            </Button>
            <Button type="button" variant="ghost" size="icon-sm" aria-label="关闭草稿纸" onClick={closeCanvas}>
              <X data-icon="icon" />
            </Button>
          </div>
        </div>
        <canvas
          ref={canvasRef}
          className={cn(
            "min-h-0 flex-1 touch-none",
            isPaper ? "bg-background" : "bg-[radial-gradient(circle_at_1px_1px,rgba(120,120,120,0.22)_1px,transparent_0)] [background-size:18px_18px]",
            isReadonly && "cursor-default"
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
