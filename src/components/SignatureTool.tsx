import React, { useState, useRef, useEffect, useCallback } from 'react';
import { FiDownload, FiTrash2, FiCheck, FiCopy, FiPenTool } from 'react-icons/fi';

type PenColor = '#0f172a' | '#1d4ed8' | '#dc2626' | '#16a34a';
type BgColor = 'white' | 'transparent';

interface Point {
    x: number;
    y: number;
}

const PEN_COLORS: { label: string; value: PenColor; tw: string }[] = [
    { label: '黑色', value: '#0f172a', tw: 'bg-slate-900' },
    { label: '蓝色', value: '#1d4ed8', tw: 'bg-blue-700' },
    { label: '红色', value: '#dc2626', tw: 'bg-red-600' },
    { label: '绿色', value: '#16a34a', tw: 'bg-green-700' },
];

const PEN_SIZES = [2, 4, 6, 10];

export default function SignatureTool() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isDrawing, setIsDrawing] = useState(false);
    const [penColor, setPenColor] = useState<PenColor>('#0f172a');
    const [penSize, setPenSize] = useState(3);
    const [bgColor, setBgColor] = useState<BgColor>('white');
    const [isEmpty, setIsEmpty] = useState(true);
    const [copied, setCopied] = useState(false);

    const lastPoint = useRef<Point | null>(null);

    // Initialize canvas
    const initCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Fill background
        if (bgColor === 'white') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    }, [bgColor]);

    // Resize canvas to match container
    const resizeCanvas = useCallback(() => {
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!canvas || !container) return;

        // Save current drawing
        const imageData = canvas.toDataURL();

        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;

        initCanvas();

        // Restore drawing
        if (!isEmpty) {
            const img = new Image();
            img.onload = () => {
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0);
            };
            img.src = imageData;
        }
    }, [initCanvas, isEmpty]);

    useEffect(() => {
        resizeCanvas();
        const observer = new ResizeObserver(resizeCanvas);
        if (containerRef.current) {
            observer.observe(containerRef.current);
        }
        return () => observer.disconnect();
    }, []);

    // Re-init when bgColor changes (clear and reset)
    useEffect(() => {
        initCanvas();
    }, [bgColor]);

    const getPoint = (e: React.MouseEvent | React.TouchEvent): Point | null => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        if ('touches' in e) {
            const touch = e.touches[0];
            if (!touch) return null;
            return {
                x: (touch.clientX - rect.left) * scaleX,
                y: (touch.clientY - rect.top) * scaleY,
            };
        } else {
            return {
                x: (e.clientX - rect.left) * scaleX,
                y: (e.clientY - rect.top) * scaleY,
            };
        }
    };

    const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
        e.preventDefault();
        const point = getPoint(e);
        if (!point) return;

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (!ctx) return;

        setIsDrawing(true);
        setIsEmpty(false);
        lastPoint.current = point;

        // Draw a dot on click
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

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
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

    const stopDrawing = () => {
        setIsDrawing(false);
        lastPoint.current = null;
    };

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
            // For JPG we need a white background
            const tempCanvas = document.createElement('canvas');
            tempCanvas.width = canvas.width;
            tempCanvas.height = canvas.height;
            const tempCtx = tempCanvas.getContext('2d')!;
            tempCtx.fillStyle = '#ffffff';
            tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
            tempCtx.drawImage(canvas, 0, 0);
            dataUrl = tempCanvas.toDataURL('image/jpeg', 0.95);
        } else {
            dataUrl = canvas.toDataURL('image/png');
        }

        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = `signature.${format}`;
        a.click();
    };

    const handleCopyImage = async () => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        try {
            canvas.toBlob(async (blob) => {
                if (!blob) return;
                await navigator.clipboard.write([
                    new ClipboardItem({ 'image/png': blob }),
                ]);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
            }, 'image/png');
        } catch (err) {
            console.error('复制失败:', err);
            alert('复制图片失败，请确保浏览器允许写入剪贴板。');
        }
    };

    return (
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
                                className={`w-9 h-9 rounded-full ${c.tw} transition-all border-2 ${
                                    penColor === c.value
                                        ? 'border-brand-500 scale-110 shadow-md shadow-brand-400/30'
                                        : 'border-transparent hover:scale-105'
                                }`}
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
                                className={`flex items-center justify-center w-10 h-10 rounded-xl transition-all border ${
                                    penSize === size
                                        ? 'bg-brand-600 border-brand-500 shadow-md shadow-brand-400/30'
                                        : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                                }`}
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
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                                bgColor === 'white'
                                    ? 'bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-400/30'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                            }`}
                        >
                            白色
                        </button>
                        <button
                            onClick={() => setBgColor('transparent')}
                            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all border ${
                                bgColor === 'transparent'
                                    ? 'bg-brand-600 text-white border-brand-500 shadow-md shadow-brand-400/30'
                                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                            }`}
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
                        使用鼠标或触控屏在画布上书写，完成后可保存或复制图片。
                    </p>
                </div>

                <div
                    ref={containerRef}
                    className="relative flex-grow rounded-2xl overflow-hidden border-2 border-dashed border-slate-300 dark:border-slate-700 cursor-crosshair"
                    style={{ minHeight: 300 }}
                >
                    {/* Checkerboard pattern for transparent bg */}
                    {bgColor === 'transparent' && (
                        <div
                            className="absolute inset-0 pointer-events-none"
                            style={{
                                backgroundImage:
                                    'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
                                backgroundSize: '20px 20px',
                                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
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

                    {/* Placeholder hint */}
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
    );
}
