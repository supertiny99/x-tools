import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiDownload, FiTrash2, FiCheck, FiCopy, FiPenTool, FiCrop, FiX } from 'react-icons/fi';

type PenColor = '#0f172a' | '#1d4ed8' | '#dc2626' | '#16a34a';
type BgColor = 'white' | 'transparent';

interface Point {
    x: number;
    y: number;
}

interface CropRect {
    x: number;
    y: number;
    w: number;
    h: number;
}

const PEN_COLORS: { label: string; value: PenColor; tw: string }[] = [
    { label: '黑色', value: '#0f172a', tw: 'bg-slate-900' },
    { label: '蓝色', value: '#1d4ed8', tw: 'bg-blue-700' },
    { label: '红色', value: '#dc2626', tw: 'bg-red-600' },
    { label: '绿色', value: '#16a34a', tw: 'bg-green-700' },
];

const PEN_SIZES = [2, 4, 6, 10];
const MIN_CROP = 20;
const HANDLE_SIZE = 10;

type DragMode =
    | 'move'
    | 'nw' | 'n' | 'ne'
    | 'e' | 'se' | 's'
    | 'sw' | 'w'
    | null;

// ─── Crop Modal ────────────────────────────────────────────────────────────────
interface CropModalProps {
    sourceCanvas: HTMLCanvasElement;
    bgColor: BgColor;
    onClose: () => void;
}

function CropModal({ sourceCanvas, bgColor, onClose }: CropModalProps) {
    const previewCanvasRef = useRef<HTMLCanvasElement>(null);
    const overlayRef = useRef<HTMLDivElement>(null);

    // crop rect in canvas-pixel coords
    const [crop, setCrop] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 });
    const [savedCopied, setSavedCopied] = useState(false);

    // display scale: canvas pixel → preview display pixel
    const scale = useRef(1);

    // drag state
    const dragMode = useRef<DragMode>(null);
    const dragStart = useRef<{ mx: number; my: number; rect: CropRect } | null>(null);

    // ── Initialize preview canvas
    useEffect(() => {
        const pc = previewCanvasRef.current;
        const overlay = overlayRef.current;
        if (!pc || !overlay) return;

        const maxW = overlay.clientWidth;
        const maxH = overlay.clientHeight;
        const s = Math.min(maxW / sourceCanvas.width, maxH / sourceCanvas.height, 1);
        scale.current = s;

        pc.width = Math.round(sourceCanvas.width * s);
        pc.height = Math.round(sourceCanvas.height * s);

        const ctx = pc.getContext('2d')!;
        if (bgColor === 'white') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pc.width, pc.height);
        }
        ctx.drawImage(sourceCanvas, 0, 0, pc.width, pc.height);

        // Default crop = whole canvas
        setCrop({ x: 0, y: 0, w: sourceCanvas.width, h: sourceCanvas.height });
    }, []);

    // ── Convert display (px relative to canvas element) → canvas pixels
    const toCanvas = useCallback((dx: number, dy: number) => ({
        x: dx / scale.current,
        y: dy / scale.current,
    }), []);

    // ── Convert canvas pixels → display px
    const toDisplay = useCallback((cx: number, cy: number) => ({
        x: cx * scale.current,
        y: cy * scale.current,
    }), []);

    const clampRect = useCallback((r: CropRect): CropRect => {
        let { x, y, w, h } = r;
        w = Math.max(MIN_CROP, w);
        h = Math.max(MIN_CROP, h);
        x = Math.max(0, Math.min(x, sourceCanvas.width - w));
        y = Math.max(0, Math.min(y, sourceCanvas.height - h));
        // Clamp w/h after clamping x/y
        w = Math.min(w, sourceCanvas.width - x);
        h = Math.min(h, sourceCanvas.height - y);
        return { x, y, w, h };
    }, [sourceCanvas]);

    // ── Hit-test: which handle or interior?
    const hitTest = useCallback((mx: number, my: number): DragMode => {
        const { x, y, w, h } = crop;
        const d = toDisplay(x, y);
        const dw = w * scale.current;
        const dh = h * scale.current;
        const hs = HANDLE_SIZE;

        const inX = mx >= d.x - hs && mx <= d.x + dw + hs;
        const inY = my >= d.y - hs && my <= d.y + dh + hs;
        if (!inX || !inY) return null;

        const onLeft = Math.abs(mx - d.x) <= hs;
        const onRight = Math.abs(mx - (d.x + dw)) <= hs;
        const onTop = Math.abs(my - d.y) <= hs;
        const onBottom = Math.abs(my - (d.y + dh)) <= hs;

        if (onTop && onLeft) return 'nw';
        if (onTop && onRight) return 'ne';
        if (onBottom && onLeft) return 'sw';
        if (onBottom && onRight) return 'se';
        if (onTop) return 'n';
        if (onBottom) return 's';
        if (onLeft) return 'w';
        if (onRight) return 'e';

        const inside =
            mx >= d.x && mx <= d.x + dw &&
            my >= d.y && my <= d.y + dh;
        return inside ? 'move' : null;
    }, [crop, toDisplay, scale]);

    const getCursor = (mode: DragMode) => {
        const map: Record<string, string> = {
            move: 'move',
            nw: 'nw-resize', ne: 'ne-resize',
            sw: 'sw-resize', se: 'se-resize',
            n: 'n-resize', s: 's-resize',
            e: 'e-resize', w: 'w-resize',
        };
        return mode ? (map[mode] ?? 'default') : 'default';
    };

    const getRelativePos = (e: React.MouseEvent | React.TouchEvent) => {
        const pc = previewCanvasRef.current!;
        const rect = pc.getBoundingClientRect();
        if ('touches' in e) {
            const t = e.touches[0] ?? e.changedTouches[0];
            return { mx: t.clientX - rect.left, my: t.clientY - rect.top };
        }
        return { mx: (e as React.MouseEvent).clientX - rect.left, my: (e as React.MouseEvent).clientY - rect.top };
    };

    const onPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const { mx, my } = getRelativePos(e);
        const mode = hitTest(mx, my);
        if (!mode) return;
        dragMode.current = mode;
        dragStart.current = { mx, my, rect: { ...crop } };
    };

    const onPointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const { mx, my } = getRelativePos(e);

        if (!dragMode.current || !dragStart.current) {
            // Just update cursor
            const pc = previewCanvasRef.current;
            if (pc) pc.style.cursor = getCursor(hitTest(mx, my));
            return;
        }

        const dx = (mx - dragStart.current.mx) / scale.current;
        const dy = (my - dragStart.current.my) / scale.current;
        const r = { ...dragStart.current.rect };

        switch (dragMode.current) {
            case 'move':
                r.x += dx; r.y += dy;
                break;
            case 'nw': r.x += dx; r.y += dy; r.w -= dx; r.h -= dy; break;
            case 'n':  r.y += dy; r.h -= dy; break;
            case 'ne': r.y += dy; r.w += dx; r.h -= dy; break;
            case 'e':  r.w += dx; break;
            case 'se': r.w += dx; r.h += dy; break;
            case 's':  r.h += dy; break;
            case 'sw': r.x += dx; r.w -= dx; r.h += dy; break;
            case 'w':  r.x += dx; r.w -= dx; break;
        }

        setCrop(clampRect(r));
    }, [hitTest, clampRect]);

    const onPointerUp = () => {
        dragMode.current = null;
        dragStart.current = null;
    };

    // ── Derived display values
    const dispX = crop.x * scale.current;
    const dispY = crop.y * scale.current;
    const dispW = crop.w * scale.current;
    const dispH = crop.h * scale.current;

    // ── Export helpers
    const getCroppedDataUrl = useCallback((format: 'png' | 'jpg') => {
        const tmp = document.createElement('canvas');
        tmp.width = Math.round(crop.w);
        tmp.height = Math.round(crop.h);
        const ctx = tmp.getContext('2d')!;

        if (format === 'jpg' || bgColor === 'white') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, tmp.width, tmp.height);
        }
        ctx.drawImage(
            sourceCanvas,
            Math.round(crop.x), Math.round(crop.y),
            Math.round(crop.w), Math.round(crop.h),
            0, 0,
            tmp.width, tmp.height
        );
        return format === 'jpg'
            ? tmp.toDataURL('image/jpeg', 0.95)
            : tmp.toDataURL('image/png');
    }, [crop, sourceCanvas, bgColor]);

    const handleDownload = (format: 'png' | 'jpg') => {
        const url = getCroppedDataUrl(format);
        const a = document.createElement('a');
        a.href = url;
        a.download = `signature-crop.${format}`;
        a.click();
    };

    const handleCopy = () => {
        const url = getCroppedDataUrl('png');
        fetch(url)
            .then(r => r.blob())
            .then(async blob => {
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                setSavedCopied(true);
                setTimeout(() => setSavedCopied(false), 2000);
            })
            .catch(() => alert('复制失败，请检查浏览器剪贴板权限。'));
    };

    // Handle size display
    const cropW = Math.round(crop.w);
    const cropH = Math.round(crop.h);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-3xl shadow-2xl w-full max-w-4xl flex flex-col overflow-hidden max-h-[95vh]">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex-shrink-0">
                    <div className="flex items-center gap-3">
                        <FiCrop className="text-brand-600 dark:text-brand-400 text-xl" />
                        <h2 className="text-lg font-bold text-slate-800 dark:text-white">裁剪签名</h2>
                        <span className="text-sm text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-full font-mono">
                            {cropW} × {cropH} px
                        </span>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                    >
                        <FiX />
                    </button>
                </div>

                {/* Preview area */}
                <div
                    ref={overlayRef}
                    className="flex-grow overflow-auto flex items-center justify-center p-6 bg-slate-50 dark:bg-slate-950 min-h-0"
                    style={{ minHeight: 200 }}
                >
                    <div className="relative inline-block select-none">
                        {/* Checkerboard for transparent bg */}
                        {bgColor === 'transparent' && (
                            <div
                                className="absolute inset-0 rounded pointer-events-none"
                                style={{
                                    backgroundImage:
                                        'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)',
                                    backgroundSize: '16px 16px',
                                    backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
                                }}
                            />
                        )}

                        {/* Preview canvas */}
                        <canvas
                            ref={previewCanvasRef}
                            className="block rounded shadow-md"
                            style={{ maxWidth: '100%', touchAction: 'none' }}
                            onMouseDown={onPointerDown}
                            onMouseMove={onPointerMove}
                            onMouseUp={onPointerUp}
                            onMouseLeave={onPointerUp}
                            onTouchStart={onPointerDown}
                            onTouchMove={onPointerMove}
                            onTouchEnd={onPointerUp}
                        />

                        {/* Darkened overlay outside crop rect */}
                        <svg
                            className="absolute inset-0 pointer-events-none"
                            style={{ width: previewCanvasRef.current?.offsetWidth ?? 0, height: previewCanvasRef.current?.offsetHeight ?? 0 }}
                        >
                            <defs>
                                <mask id="crop-mask">
                                    <rect width="100%" height="100%" fill="white" />
                                    <rect x={dispX} y={dispY} width={dispW} height={dispH} fill="black" />
                                </mask>
                            </defs>
                            <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#crop-mask)" />
                        </svg>

                        {/* Crop box overlay */}
                        <div
                            className="absolute pointer-events-none"
                            style={{
                                left: dispX,
                                top: dispY,
                                width: dispW,
                                height: dispH,
                                border: '2px solid #6366f1',
                                boxSizing: 'border-box',
                            }}
                        >
                            {/* Rule-of-thirds grid lines */}
                            <div className="absolute inset-0 pointer-events-none" style={{ border: 'none' }}>
                                {[1, 2].map(i => (
                                    <React.Fragment key={i}>
                                        <div className="absolute top-0 bottom-0" style={{ left: `${(i / 3) * 100}%`, width: 1, background: 'rgba(255,255,255,0.35)' }} />
                                        <div className="absolute left-0 right-0" style={{ top: `${(i / 3) * 100}%`, height: 1, background: 'rgba(255,255,255,0.35)' }} />
                                    </React.Fragment>
                                ))}
                            </div>

                            {/* Corner & edge handles */}
                            {(['nw','n','ne','e','se','s','sw','w'] as const).map(pos => {
                                const isCorner = pos.length === 2;
                                const style: React.CSSProperties = {
                                    position: 'absolute',
                                    width: isCorner ? 10 : 10,
                                    height: isCorner ? 10 : 10,
                                    background: '#6366f1',
                                    borderRadius: 2,
                                };
                                if (pos.includes('n')) style.top = -5;
                                if (pos.includes('s')) style.bottom = -5;
                                if (!pos.includes('n') && !pos.includes('s')) {
                                    style.top = '50%';
                                    style.transform = 'translateY(-50%)';
                                }
                                if (pos.includes('w')) style.left = -5;
                                if (pos.includes('e')) style.right = -5;
                                if (!pos.includes('w') && !pos.includes('e')) {
                                    style.left = '50%';
                                    style.transform = (style.transform ? style.transform + ' ' : '') + 'translateX(-50%)';
                                }
                                return <div key={pos} style={style} />;
                            })}
                        </div>
                    </div>
                </div>

                {/* Tip */}
                <p className="text-xs text-center text-slate-400 dark:text-slate-500 pb-2 flex-shrink-0">
                    拖动裁剪框移动位置，拖动边缘或角点调整大小
                </p>

                {/* Footer actions */}
                <div className="flex gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-800 flex-shrink-0 flex-wrap">
                    <button
                        onClick={onClose}
                        className="py-2.5 px-5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700"
                    >
                        取消
                    </button>
                    <div className="flex-grow" />
                    <button
                        onClick={handleCopy}
                        className="py-2.5 px-5 rounded-xl text-sm font-semibold bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                    >
                        {savedCopied ? <FiCheck className="text-green-500" /> : <FiCopy />}
                        {savedCopied ? '已复制' : '复制图片'}
                    </button>
                    <button
                        onClick={() => handleDownload('png')}
                        className="py-2.5 px-5 rounded-xl text-sm font-semibold bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-200 dark:border-slate-700 flex items-center gap-2"
                    >
                        <FiDownload /> 保存 PNG
                    </button>
                    <button
                        onClick={() => handleDownload('jpg')}
                        className="py-2.5 px-5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-400/20 transition-all flex items-center gap-2"
                    >
                        <FiDownload /> 保存 JPG
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function SignatureTool() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [penColor, setPenColor] = useState<PenColor>('#0f172a');
    const [penSize, setPenSize] = useState(3);
    const [bgColor, setBgColor] = useState<BgColor>('white');
    const [isEmpty, setIsEmpty] = useState(true);
    const [copied, setCopied] = useState(false);
    const [showCrop, setShowCrop] = useState(false);

    const lastPoint = useRef<Point | null>(null);

    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if (bgColor === 'white') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, [bgColor]);

    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;
        const imageData = canvas.toDataURL();
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        initCanvas();
        if (!isEmpty) {
            const img = new Image();
            img.onload = () => canvas.getContext('2d')?.drawImage(img, 0, 0);
            img.src = imageData;
        }
    }, [initCanvas, isEmpty]);

    useEffect(() => {
        resizeCanvas();
        const observer = new ResizeObserver(resizeCanvas);
        if (containerRef.current) observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, []);

    useEffect(() => { initCanvas(); }, [bgColor]);

    const getPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const sx = canvas.width / rect.width;
        const sy = canvas.height / rect.height;
        if ('touches' in e) {
            const t = e.touches[0];
            if (!t) return null;
            return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy };
        }
        return { x: ((e as React.MouseEvent).clientX - rect.left) * sx, y: ((e as React.MouseEvent).clientY - rect.top) * sy };
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const point = getPoint(e);
        if (!point) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx) return;
        setIsDrawing(true);
        setIsEmpty(false);
        lastPoint.current = point;
        ctx.beginPath();
        ctx.arc(point.x, point.y, penSize / 2, 0, Math.PI * 2);
        ctx.fillStyle = penColor;
        ctx.fill();
    };

    const draw = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        if (!isDrawing) return;
        const point = getPoint(e);
        if (!point) return;
        const ctx = canvasRef.current?.getContext('2d');
        if (!ctx || !lastPoint.current) return;
        ctx.beginPath();
        ctx.moveTo(lastPoint.current.x, lastPoint.current.y);
        ctx.lineTo(point.x, point.y);
        ctx.strokeStyle = penColor;
        ctx.lineWidth = penSize;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.stroke();
        lastPoint.current = point;
    };

    const stopDrawing = () => { setIsDrawing(false); lastPoint.current = null; };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx || !canvas) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        initCanvas();
        setIsEmpty(true);
    };

    const handleDownload = (format: 'png' | 'jpg' = 'png') => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        let dataUrl: string;
        if (format === 'jpg') {
            const tmp = document.createElement('canvas');
            tmp.width = canvas.width; tmp.height = canvas.height;
            const ctx = tmp.getContext('2d')!;
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, tmp.width, tmp.height);
            ctx.drawImage(canvas, 0, 0);
            dataUrl = tmp.toDataURL('image/jpeg', 0.95);
        } else {
            dataUrl = canvas.toDataURL('image/png');
        }
        const a = document.createElement('a');
        a.href = dataUrl; a.download = `signature.${format}`; a.click();
    };

    const handleCopyImage = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        try {
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }, 'image/png');
        } catch {
            alert('复制图片失败，请确保浏览器允许写入剪贴板。');
        }
    };

    return (
        <>
            <div className="flex flex-col md:flex-row h-full w-full bg-transparent min-h-[600px]">
                {/* Sidebar */}
                <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-6 bg-white/40 dark:bg-slate-900/40">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
                        <FiPenTool className="text-brand-600 dark:text-brand-400" />
                        电子签名
                    </h2>

                    {/* Pen Color */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                            笔迹颜色
                        </label>
                        <div className="flex gap-2 flex-wrap">
                            {PEN_COLORS.map((c) => (
                                <button
                                    key={c.value}
                                    onClick={() => setPenColor(c.value)}
                                    title={c.label}
                                    className={`w-9 h-9 rounded-full ${c.tw} transition-all border-2 ${penColor === c.value
                                        ? 'border-brand-500 scale-110 shadow-md shadow-brand-400/30'
                                        : 'border-transparent hover:scale-105'}`}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Pen Size */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                            笔迹粗细
                        </label>
                        <div className="flex gap-2 items-center">
                            {PEN_SIZES.map((size) => (
                                <button
                                    key={size}
                                    onClick={() => setPenSize(size)}
                                    title={`${size}px`}
                                    className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all border ${penSize === size
                                        ? 'bg-brand-600 border-brand-500 shadow-md shadow-brand-400/30'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-400'}`}
                                >
                                    <span
                                        className={`rounded-full ${penSize === size ? 'bg-white' : 'bg-slate-700 dark:bg-slate-300'}`}
                                        style={{ width: size + 2, height: size + 2 }}
                                    />
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Background */}
                    <div>
                        <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-3">
                            背景
                        </label>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setBgColor('white')}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${bgColor === 'white'
                                    ? 'bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-400/30'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'}`}
                            >
                                白色
                            </button>
                            <button
                                onClick={() => setBgColor('transparent')}
                                className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${bgColor === 'transparent'
                                    ? 'bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-400/30'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'}`}
                            >
                                透明
                            </button>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-col gap-2 mt-auto">
                        <button
                            onClick={handleClear}
                            disabled={isEmpty}
                            className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm bg-white dark:bg-slate-800 text-red-500 border border-red-200 dark:border-red-900/40 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            <FiTrash2 /> 清除画布
                        </button>

                        {/* Crop Button */}
                        <button
                            onClick={() => setShowCrop(true)}
                            disabled={isEmpty}
                            className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm bg-violet-50 dark:bg-violet-900/20 text-violet-600 dark:text-violet-400 border border-violet-200 dark:border-violet-800/40 hover:bg-violet-100 dark:hover:bg-violet-900/30 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            <FiCrop /> 裁剪并保存
                        </button>

                        <button
                            onClick={handleCopyImage}
                            disabled={isEmpty}
                            className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            {copied ? <FiCheck className="text-green-500" /> : <FiCopy />}
                            {copied ? '已复制！' : '复制图片'}
                        </button>
                        <button
                            onClick={() => handleDownload('png')}
                            disabled={isEmpty}
                            className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-400/20 disabled:bg-slate-300 disabled:dark:bg-slate-800 disabled:text-slate-400 disabled:shadow-none disabled:cursor-not-allowed transition-all"
                        >
                            <FiDownload /> 保存为 PNG
                        </button>
                        <button
                            onClick={() => handleDownload('jpg')}
                            disabled={isEmpty}
                            className="w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 font-semibold text-sm bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                        >
                            <FiDownload /> 保存为 JPG
                        </button>
                    </div>

                    <p className="text-xs text-slate-400 dark:text-slate-500 text-center">
                        签名数据仅在本地处理，绝不上传
                    </p>
                </div>

                {/* Canvas Area */}
                <div className="flex-grow flex flex-col bg-white/60 dark:bg-slate-950/60 p-6 md:p-10">
                    <div className="mb-4">
                        <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-1">
                            在下方区域手写您的签名
                        </h3>
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                            使用鼠标或触控屏在画布上书写，完成后可裁剪、保存或复制图片。
                        </p>
                    </div>

                    <div
                        ref={containerRef}
                        className="relative flex-grow rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 cursor-crosshair"
                        style={{ minHeight: 300 }}
                    >
                        {bgColor === 'transparent' && (
                            <div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                    backgroundImage:
                                        'linear-gradient(45deg,#e2e8f0 25%,transparent 25%),linear-gradient(-45deg,#e2e8f0 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#e2e8f0 75%),linear-gradient(-45deg,transparent 75%,#e2e8f0 75%)',
                                    backgroundSize: '20px 20px',
                                    backgroundPosition: '0 0,0 10px,10px -10px,-10px 0',
                                }}
                            />
                        )}
                        <canvas
                            ref={canvasRef}
                            className="absolute inset-0 w-full h-full touch-none"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            onTouchStart={startDrawing}
                            onTouchMove={draw}
                            onTouchEnd={stopDrawing}
                        />
                        {isEmpty && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none select-none">
                                <FiPenTool className="text-5xl text-slate-300 dark:text-slate-700 mb-3" />
                                <p className="text-slate-400 dark:text-slate-600 text-base font-medium">
                                    在此处手写签名
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Crop Modal */}
            {showCrop && canvasRef.current && (
                <CropModal
                    sourceCanvas={canvasRef.current}
                    bgColor={bgColor}
                    onClose={() => setShowCrop(false)}
                />
            )}
        </>
    );
}
