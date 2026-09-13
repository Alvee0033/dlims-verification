'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  title?: string;
  aspectRatio: number; // width / height, e.g. 404 / 480
  targetWidth?: number;
  targetHeight?: number;
  isSignature?: boolean;
  onCrop: (blob: Blob, previewUrl: string) => void;
  onCancel: () => void;
}

export default function ImageCropperModal({
  isOpen,
  imageSrc,
  title = 'Adjust & Crop Image',
  aspectRatio,
  targetWidth = 404,
  targetHeight = 480,
  isSignature = false,
  onCrop,
  onCancel,
}: ImageCropperModalProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState<number>(1.0);
  const [rotation, setRotation] = useState<number>(0);
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isApplying, setIsApplying] = useState<boolean>(false);

  // Virtual canvas dimensions for crisp interactive rendering
  const V_WIDTH = 560;
  const V_HEIGHT = 440;

  // Compute crop box inside virtual canvas
  const pad = 28;
  const availW = V_WIDTH - pad * 2;
  const availH = V_HEIGHT - pad * 2;
  let cropW = availW;
  let cropH = cropW / aspectRatio;
  if (cropH > availH) {
    cropH = availH;
    cropW = cropH * aspectRatio;
  }
  const cropX = (V_WIDTH - cropW) / 2;
  const cropY = (V_HEIGHT - cropH) / 2;
  const cropCenterX = cropX + cropW / 2;
  const cropCenterY = cropY + cropH / 2;

  // Load image when imageSrc changes
  useEffect(() => {
    if (!isOpen || !imageSrc) {
      setImageObj(null);
      return;
    }

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      setImageObj(img);
      setZoom(1.0);
      setRotation(0);
      setOffset({ x: 0, y: 0 });
    };
    img.src = imageSrc;
  }, [isOpen, imageSrc]);

  // Compute base scale to cover crop box at 1.0x zoom
  const getBaseScale = useCallback(
    (img: HTMLImageElement, rot: number) => {
      const isRotated90 = rot === 90 || rot === 270;
      const effW = isRotated90 ? img.naturalHeight : img.naturalWidth;
      const effH = isRotated90 ? img.naturalWidth : img.naturalHeight;
      if (!effW || !effH) return 1.0;
      return Math.max(cropW / effW, cropH / effH);
    },
    [cropW, cropH]
  );

  // Render on canvas
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, V_WIDTH, V_HEIGHT);

    // Background pattern
    ctx.fillStyle = '#1a1f2c';
    ctx.fillRect(0, 0, V_WIDTH, V_HEIGHT);

    const baseScale = getBaseScale(imageObj, rotation);
    const currentScale = baseScale * zoom;

    ctx.save();
    // Move to center of crop box + user offset
    ctx.translate(cropCenterX + offset.x, cropCenterY + offset.y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.scale(currentScale, currentScale);

    // Draw image centered at origin
    ctx.drawImage(
      imageObj,
      -imageObj.naturalWidth / 2,
      -imageObj.naturalHeight / 2,
      imageObj.naturalWidth,
      imageObj.naturalHeight
    );
    ctx.restore();

    // Darken outside crop box (4 surrounding rectangles)
    ctx.fillStyle = 'rgba(10, 15, 25, 0.72)';
    // Top
    ctx.fillRect(0, 0, V_WIDTH, cropY);
    // Bottom
    ctx.fillRect(0, cropY + cropH, V_WIDTH, V_HEIGHT - (cropY + cropH));
    // Left
    ctx.fillRect(0, cropY, cropX, cropH);
    // Right
    ctx.fillRect(cropX + cropW, cropY, V_WIDTH - (cropX + cropW), cropH);

    // Rule of thirds subtle grid lines inside crop box
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    // Vertical grid
    ctx.moveTo(cropX + cropW / 3, cropY);
    ctx.lineTo(cropX + cropW / 3, cropY + cropH);
    ctx.moveTo(cropX + (cropW * 2) / 3, cropY);
    ctx.lineTo(cropX + (cropW * 2) / 3, cropY + cropH);
    // Horizontal grid
    ctx.moveTo(cropX, cropY + cropH / 3);
    ctx.lineTo(cropX + cropW, cropY + cropH / 3);
    ctx.moveTo(cropX, cropY + (cropH * 2) / 3);
    ctx.lineTo(cropX + cropW, cropY + (cropH * 2) / 3);
    ctx.stroke();

    // Border around crop box
    ctx.strokeStyle = '#10b981'; // dl-green
    ctx.lineWidth = 2.5;
    ctx.strokeRect(cropX, cropY, cropW, cropH);

    // Corner guides
    const cornerLen = 18;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    // Top-left
    ctx.moveTo(cropX, cropY + cornerLen);
    ctx.lineTo(cropX, cropY);
    ctx.lineTo(cropX + cornerLen, cropY);
    // Top-right
    ctx.moveTo(cropX + cropW - cornerLen, cropY);
    ctx.lineTo(cropX + cropW, cropY);
    ctx.lineTo(cropX + cropW, cropY + cornerLen);
    // Bottom-left
    ctx.moveTo(cropX, cropY + cropH - cornerLen);
    ctx.lineTo(cropX, cropY + cropH);
    ctx.lineTo(cropX + cornerLen, cropY + cropH);
    // Bottom-right
    ctx.moveTo(cropX + cropW - cornerLen, cropY + cropH);
    ctx.lineTo(cropX + cropW, cropY + cropH);
    ctx.lineTo(cropX + cropW, cropY + cropH - cornerLen);
    ctx.stroke();
  }, [
    imageObj,
    zoom,
    rotation,
    offset,
    getBaseScale,
    cropCenterX,
    cropCenterY,
    cropX,
    cropY,
    cropW,
    cropH,
  ]);

  useEffect(() => {
    draw();
  }, [draw]);

  // Pointer position helpers with scaling
  const getCanvasCoords = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const scaleX = V_WIDTH / rect.width;
    const scaleY = V_HEIGHT / rect.height;
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    setIsDragging(true);
    const p = getCanvasCoords(e.clientX, e.clientY);
    setDragStart({ x: p.x - offset.x, y: p.y - offset.y });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging) return;
    const p = getCanvasCoords(e.clientX, e.clientY);
    setOffset({ x: p.x - dragStart.x, y: p.y - dragStart.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch support for mobile devices
  const touchDistRef = useRef<number | null>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      const p = getCanvasCoords(e.touches[0].clientX, e.touches[0].clientY);
      setDragStart({ x: p.x - offset.x, y: p.y - offset.y });
    } else if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.touches.length === 1 && isDragging) {
      const p = getCanvasCoords(e.touches[0].clientX, e.touches[0].clientY);
      setOffset({ x: p.x - dragStart.x, y: p.y - dragStart.y });
    } else if (e.touches.length === 2 && touchDistRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const ratio = newDist / touchDistRef.current;
      setZoom((prev) => Math.min(3.5, Math.max(0.6, prev * ratio)));
      touchDistRef.current = newDist;
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchDistRef.current = null;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomDelta = e.deltaY < 0 ? 0.08 : -0.08;
    setZoom((prev) => Math.min(3.5, Math.max(0.6, prev + zoomDelta)));
  };

  const handleRotate = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleReset = () => {
    setZoom(1.0);
    setRotation(0);
    setOffset({ x: 0, y: 0 });
  };

  // Perform the exact crop on offscreen canvas and export Blob
  const handleApply = async () => {
    if (!imageObj) return;
    setIsApplying(true);

    try {
      const offCanvas = document.createElement('canvas');
      offCanvas.width = targetWidth;
      offCanvas.height = targetHeight;
      const offCtx = offCanvas.getContext('2d');

      if (!offCtx) {
        throw new Error('Could not initialize offscreen rendering canvas');
      }

      // Clear offscreen canvas
      offCtx.clearRect(0, 0, targetWidth, targetHeight);

      // Fill white background for photo (if jpeg)
      if (!isSignature) {
        offCtx.fillStyle = '#ffffff';
        offCtx.fillRect(0, 0, targetWidth, targetHeight);
      }

      const ratio = targetWidth / cropW;
      const baseScale = getBaseScale(imageObj, rotation);
      const currentScale = baseScale * zoom * ratio;

      offCtx.save();
      // Translate to center of target crop canvas + scaled offset
      offCtx.translate(targetWidth / 2 + offset.x * ratio, targetHeight / 2 + offset.y * ratio);
      offCtx.rotate((rotation * Math.PI) / 180);
      offCtx.scale(currentScale, currentScale);

      // Draw image
      offCtx.drawImage(
        imageObj,
        -imageObj.naturalWidth / 2,
        -imageObj.naturalHeight / 2,
        imageObj.naturalWidth,
        imageObj.naturalHeight
      );
      offCtx.restore();

      const mimeType = isSignature ? 'image/png' : 'image/jpeg';
      const quality = isSignature ? undefined : 0.92;

      offCanvas.toBlob(
        (blob) => {
          setIsApplying(false);
          if (blob) {
            const previewUrl = URL.createObjectURL(blob);
            onCrop(blob, previewUrl);
          } else {
            alert('Error generating cropped image');
          }
        },
        mimeType,
        quality
      );
    } catch (err: any) {
      setIsApplying(false);
      alert(err.message || 'Error cropping image');
    }
  };

  if (!isOpen || !imageSrc) return null;

  return (
    <div
      className="modal fade show d-block"
      tabIndex={-1}
      style={{
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        zIndex: 1060,
        backdropFilter: 'blur(4px)',
      }}
    >
      <div className="modal-dialog modal-dialog-centered modal-lg">
        <div className="modal-content bg-dark text-white border-secondary shadow-lg rounded-3 overflow-hidden">
          {/* Header */}
          <div className="modal-header border-secondary py-3 px-4 d-flex justify-content-between align-items-center bg-black bg-opacity-40">
            <div className="d-flex align-items-center gap-2">
              <i className={isSignature ? 'fas fa-file-signature text-info' : 'fas fa-crop-alt text-success'}></i>
              <h5 className="modal-title fw-bold mb-0 text-white" style={{ fontSize: '1.1rem' }}>
                {title}
              </h5>
            </div>
            <button
              type="button"
              className="btn-close btn-close-white"
              onClick={onCancel}
              aria-label="Close"
              disabled={isApplying}
            ></button>
          </div>

          {/* Body with Interactive Canvas */}
          <div className="modal-body p-3 p-md-4 text-center d-flex flex-column align-items-center">
            <div className="text-secondary small mb-2 d-flex align-items-center gap-2 justify-content-center">
              <i className="fas fa-arrows-alt"></i>
              <span>Drag to position &bull; Use slider or scroll to zoom &bull; Box is exact card fit</span>
            </div>

            <div
              className="position-relative rounded-2 overflow-hidden shadow-lg border border-secondary border-opacity-50"
              style={{
                width: '100%',
                maxWidth: '560px',
                aspectRatio: `${V_WIDTH} / ${V_HEIGHT}`,
                cursor: isDragging ? 'grabbing' : 'grab',
                userSelect: 'none',
                touchAction: 'none',
                backgroundColor: '#111827',
              }}
            >
              <canvas
                ref={canvasRef}
                width={V_WIDTH}
                height={V_HEIGHT}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onWheel={handleWheel}
                className="w-100 h-100"
                style={{ display: 'block' }}
              />
            </div>

            {/* Controls Toolbar */}
            <div className="w-100 max-w-560 mt-3 px-2" style={{ maxWidth: '560px' }}>
              <div className="d-flex align-items-center justify-content-between gap-3 bg-secondary bg-opacity-25 p-2 rounded-3 border border-secondary border-opacity-50">
                {/* Zoom out */}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light border-0 px-2"
                  onClick={() => setZoom((prev) => Math.max(0.6, prev - 0.1))}
                  title="Zoom Out"
                >
                  <i className="fas fa-search-minus"></i>
                </button>

                {/* Zoom slider */}
                <div className="flex-grow-1 d-flex align-items-center gap-2">
                  <i className="fas fa-search text-muted small"></i>
                  <input
                    type="range"
                    className="form-range"
                    min="0.6"
                    max="3.0"
                    step="0.05"
                    value={zoom}
                    onChange={(e) => setZoom(parseFloat(e.target.value))}
                    style={{ cursor: 'pointer' }}
                  />
                  <span className="small text-muted font-monospace" style={{ minWidth: '38px' }}>
                    {Math.round(zoom * 100)}%
                  </span>
                </div>

                {/* Zoom in */}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light border-0 px-2"
                  onClick={() => setZoom((prev) => Math.min(3.0, prev + 0.1))}
                  title="Zoom In"
                >
                  <i className="fas fa-search-plus"></i>
                </button>

                {/* Rotate button */}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-light border-secondary px-3 d-flex align-items-center gap-1"
                  onClick={handleRotate}
                  title="Rotate 90 degrees"
                >
                  <i className="fas fa-redo-alt"></i>
                  <span className="d-none d-sm-inline">Rotate</span>
                </button>

                {/* Reset button */}
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary border-0 px-2"
                  onClick={handleReset}
                  title="Reset adjustment"
                >
                  <i className="fas fa-undo"></i>
                </button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="modal-footer border-secondary py-3 px-4 d-flex justify-content-between bg-black bg-opacity-40">
            <button
              type="button"
              className="btn btn-outline-light px-4"
              onClick={onCancel}
              disabled={isApplying}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-success px-4 fw-semibold d-inline-flex align-items-center gap-2 shadow-sm"
              onClick={handleApply}
              disabled={isApplying}
              style={{ backgroundColor: '#0f4c3a', borderColor: '#0f4c3a' }}
            >
              {isApplying ? (
                <>
                  <span className="spinner-border spinner-border-sm" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <i className="fas fa-check"></i>
                  <span>Crop &amp; Apply</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
