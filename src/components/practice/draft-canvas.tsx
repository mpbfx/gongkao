"use client";

import { Eraser, GripVertical, PenLine, RotateCcw, Trash2, X } from "lucide-react";
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

type DraftTool = "pen" | "eraser";

type ToolbarPosition = {
  x: number;
  y: number;
};

type DragState = {
  offsetX: number;
  offsetY: number;
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
  context.lineWidth = tool === "eraser" ? 22 : 3;
  context.strokeStyle = "hsl(0 0% 12%)";
  context.globalCompositeOperation = tool === "eraser" ? "destination-out" : "source-over";
}

function drawWithInkMode(context: CanvasRenderingContext2D, draw: () => void) {
  const previousCompositeOperation = context.globalCompositeOperation;
  context.globalCompositeOperation = "source-over";
  draw();
  context.globalCompositeOperation = previousCompositeOperation;
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
  variant = "overlay",
  onChange,
  onClear,
  onClose,
}: DraftCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const layerRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const restoreKeyRef = useRef<string | null>(null);
  const undoStackRef = useRef<ImageData[]>([]);
  const toolRef = useRef<DraftTool>("pen");
  const dragStateRef = useRef<DragState | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState<DraftTool>("pen");
  const [undoCount, setUndoCount] = useState(0);
  const [toolbarPosition, setToolbarPosition] = useState<ToolbarPosition | null>(null);

  useEffect(() => {
    toolRef.current = tool;
  }, [tool]);

  const clampToolbarPosition = useCallback((x: number, y: number) => {
    const layer = layerRef.current;
    const toolbar = toolbarRef.current;

    if (!layer || !toolbar) {
      return { x, y };
    }

    const layerRect = layer.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();
    const maxX = Math.max(0, layerRect.width - toolbarRect.width);
    const maxY = Math.max(0, layerRect.height - toolbarRect.height);

    return {
      x: Math.min(Math.max(0, x), maxX),
      y: Math.min(Math.max(0, y), maxY),
    };
  }, []);

  const resetToolbarPosition = useCallback(() => {
    const layer = layerRef.current;
    const toolbar = toolbarRef.current;

    if (!layer || !toolbar) {
      return;
    }

    const layerRect = layer.getBoundingClientRect();
    const toolbarRect = toolbar.getBoundingClientRect();

    setToolbarPosition(
      clampToolbarPosition(layerRect.width - toolbarRect.width - 12, layerRect.height - toolbarRect.height - 16)
    );
  }, [clampToolbarPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (!toolbarPosition) {
      window.requestAnimationFrame(resetToolbarPosition);
    }
  }, [open, resetToolbarPosition, toolbarPosition]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const handleResize = () => {
      setToolbarPosition((position) => {
        if (!position) {
          return position;
        }

        return clampToolbarPosition(position.x, position.y);
      });
    };

    window.addEventListener("resize", handleResize);

    return () => window.removeEventListener("resize", handleResize);
  }, [clampToolbarPosition, open]);

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

      drawWithInkMode(context, () => {
        if (previous.width > 0 && previous.height > 0) {
          context.setTransform(1, 0, 0, 1, 0, 0);
          context.drawImage(previous, 0, 0, canvas.width, canvas.height);
        }
      });

      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      configureContext(context, tool);
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
      drawWithInkMode(context, () => {
        context.drawImage(image, 0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
      });
      configureContext(context, toolRef.current);
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

    context.setTransform(1, 0, 0, 1, 0, 0);
    context.putImageData(previous, 0, 0);
    context.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
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

  function startDraggingToolbar(event: React.PointerEvent<HTMLButtonElement>) {
    const layer = layerRef.current;
    const toolbar = toolbarRef.current;

    if (!layer || !toolbar) {
      return;
    }

    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);

    const toolbarRect = toolbar.getBoundingClientRect();
    dragStateRef.current = {
      offsetX: event.clientX - toolbarRect.left,
      offsetY: event.clientY - toolbarRect.top,
    };
  }

  function dragToolbar(event: React.PointerEvent<HTMLButtonElement>) {
    const layer = layerRef.current;
    const dragState = dragStateRef.current;

    if (!layer || !dragState) {
      return;
    }

    const layerRect = layer.getBoundingClientRect();
    const nextX = event.clientX - layerRect.left - dragState.offsetX;
    const nextY = event.clientY - layerRect.top - dragState.offsetY;

    setToolbarPosition(clampToolbarPosition(nextX, nextY));
  }

  function stopDraggingToolbar(event: React.PointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    dragStateRef.current = null;
  }

  const isReadonly = readOnly || variant !== "overlay";
  const hasUndo = undoCount > 0;

  return (
    <div ref={layerRef} className="pointer-events-none absolute inset-0 z-20">
      <div className="relative h-full min-h-full">
        <div
          ref={toolbarRef}
          className="pointer-events-auto absolute z-10 flex items-center gap-1 rounded-md border bg-background/90 p-1 shadow-sm"
          style={toolbarPosition ? { left: toolbarPosition.x, top: toolbarPosition.y } : { bottom: 16, right: 12 }}
        >
          <button
            type="button"
            className="grid size-7 cursor-grab place-items-center rounded-md text-muted-foreground outline-none hover:bg-muted active:cursor-grabbing focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            aria-label="拖动草稿工具栏"
            onPointerDown={startDraggingToolbar}
            onPointerMove={dragToolbar}
            onPointerCancel={stopDraggingToolbar}
            onPointerUp={stopDraggingToolbar}
          >
            <GripVertical className="size-3.5" aria-hidden="true" />
          </button>
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
