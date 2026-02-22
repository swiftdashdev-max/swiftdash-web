'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Crop, ZoomIn, ZoomOut, RotateCcw, Check, X } from 'lucide-react';

interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface LogoCropModalProps {
  file: File;
  onConfirm: (croppedFile: File) => void;
  onCancel: () => void;
}

export function LogoCropModal({ file, onConfirm, onCancel }: LogoCropModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [offsetStart, setOffsetStart] = useState({ x: 0, y: 0 });

  // Fixed canvas display size
  const CANVAS_W = 480;
  const CANVAS_H = 200;
  // Crop box is centered, fixed aspect ratio (wide logo)
  const CROP_W = 320;
  const CROP_H = 120;
  const CROP_X = (CANVAS_W - CROP_W) / 2;
  const CROP_Y = (CANVAS_H - CROP_H) / 2;

  // Load image
  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      // Fit image to canvas initially
      const fitScale = Math.max(CANVAS_W / image.width, CANVAS_H / image.height);
      setScale(fitScale);
      setOffset({
        x: (CANVAS_W - image.width * fitScale) / 2,
        y: (CANVAS_H - image.height * fitScale) / 2,
      });
    };
    image.src = url;
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // Draw canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

    // Draw image
    ctx.drawImage(img, offset.x, offset.y, img.width * scale, img.height * scale);

    // Darken outside crop area
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0, 0, CANVAS_W, CROP_Y); // top
    ctx.fillRect(0, CROP_Y + CROP_H, CANVAS_W, CANVAS_H - CROP_Y - CROP_H); // bottom
    ctx.fillRect(0, CROP_Y, CROP_X, CROP_H); // left
    ctx.fillRect(CROP_X + CROP_W, CROP_Y, CANVAS_W - CROP_X - CROP_W, CROP_H); // right

    // Crop border
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.strokeRect(CROP_X, CROP_Y, CROP_W, CROP_H);

    // Corner handles
    const hs = 10;
    ctx.fillStyle = 'white';
    [[CROP_X, CROP_Y], [CROP_X + CROP_W - hs, CROP_Y], [CROP_X, CROP_Y + CROP_H - hs], [CROP_X + CROP_W - hs, CROP_Y + CROP_H - hs]].forEach(([x, y]) => {
      ctx.fillRect(x, y, hs, hs);
    });

    // Update preview
    const preview = previewCanvasRef.current;
    if (preview) {
      const pctx = preview.getContext('2d')!;
      pctx.clearRect(0, 0, preview.width, preview.height);
      // Source region in image coordinates
      const srcX = (CROP_X - offset.x) / scale;
      const srcY = (CROP_Y - offset.y) / scale;
      const srcW = CROP_W / scale;
      const srcH = CROP_H / scale;
      pctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, preview.width, preview.height);
    }
  }, [img, scale, offset]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Mouse / touch drag
  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setDragStart({ x: e.clientX, y: e.clientY });
    setOffsetStart({ ...offset });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!dragging) return;
    setOffset({
      x: offsetStart.x + (e.clientX - dragStart.x),
      y: offsetStart.y + (e.clientY - dragStart.y),
    });
  };

  const handleMouseUp = () => setDragging(false);

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    setScale((s) => Math.max(0.2, Math.min(5, s + delta)));
  };

  const zoomIn = () => setScale((s) => Math.min(5, s + 0.15));
  const zoomOut = () => setScale((s) => Math.max(0.2, s - 0.15));
  const reset = () => {
    if (!img) return;
    const fitScale = Math.max(CANVAS_W / img.width, CANVAS_H / img.height);
    setScale(fitScale);
    setOffset({ x: (CANVAS_W - img.width * fitScale) / 2, y: (CANVAS_H - img.height * fitScale) / 2 });
  };

  const handleConfirm = () => {
    if (!img) return;
    const output = document.createElement('canvas');
    // Export at 2x for retina
    output.width = CROP_W * 2;
    output.height = CROP_H * 2;
    const ctx = output.getContext('2d')!;
    const srcX = (CROP_X - offset.x) / scale;
    const srcY = (CROP_Y - offset.y) / scale;
    const srcW = CROP_W / scale;
    const srcH = CROP_H / scale;
    ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, output.width, output.height);
    output.toBlob((blob) => {
      if (!blob) return;
      const croppedFile = new File([blob], file.name.replace(/\.[^.]+$/, '.png'), { type: 'image/png' });
      onConfirm(croppedFile);
    }, 'image/png', 0.95);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <Crop className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-sm">Crop Logo</h2>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Crop canvas */}
        <div className="p-4 bg-gray-950">
          <canvas
            ref={canvasRef}
            width={CANVAS_W}
            height={CANVAS_H}
            className="rounded-lg w-full cursor-grab active:cursor-grabbing select-none"
            style={{ maxWidth: '100%', aspectRatio: `${CANVAS_W}/${CANVAS_H}` }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onWheel={handleWheel}
          />
          <p className="text-xs text-gray-400 text-center mt-2">Drag to reposition · Scroll to zoom</p>
        </div>

        {/* Controls */}
        <div className="px-4 py-3 border-b flex items-center gap-2">
          <button onClick={zoomOut} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </button>
          <input
            type="range"
            min={20}
            max={500}
            value={Math.round(scale * 100)}
            onChange={(e) => setScale(Number(e.target.value) / 100)}
            className="flex-1 accent-primary"
          />
          <button onClick={zoomIn} className="p-2 rounded-lg hover:bg-muted transition-colors" title="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </button>
          <button onClick={reset} className="p-2 rounded-lg hover:bg-muted transition-colors ml-1" title="Reset">
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        {/* Preview + Actions */}
        <div className="px-4 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">Preview:</span>
            <div className="border rounded-lg overflow-hidden bg-gray-100 shadow-inner" style={{ width: 96, height: 36 }}>
              <canvas ref={previewCanvasRef} width={192} height={72} className="w-full h-full" style={{ imageRendering: 'auto' }} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={onCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleConfirm} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />
              Use Crop
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
