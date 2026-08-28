import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    FiUploadCloud, FiDownload, FiImage, FiSliders, FiCrop,
    FiMaximize2, FiDroplet, FiRefreshCw, FiCheck, FiX, FiInfo, FiGrid, FiMove, FiPlus, FiClipboard, FiTrash2
} from 'react-icons/fi';
import { clampPosterQrLayer, composePosterQrPng, type PosterQrLayer } from '../lib/image/poster-qr';

type TabType = 'convert' | 'compress' | 'crop' | 'resize' | 'watermark' | 'posterQr';
type PosterQrId = string;
type PosterQrLayerKey = keyof PosterQrLayer;

interface ImageState {
    file: File | null;
    src: string;
    width: number;
    height: number;
    name: string;
}

interface PosterQrImage extends ImageState {
    id: PosterQrId;
    layer: PosterQrLayer;
}

interface PosterQrSnapshot {
    poster: ImageState | null;
    qrImages: PosterQrImage[];
    selectedQrId: PosterQrId | null;
}

const FORMAT_OPTIONS = ['image/jpeg', 'image/png', 'image/webp'];
const FORMAT_LABELS: Record<string, string> = {
    'image/jpeg': 'JPEG',
    'image/png': 'PNG',
    'image/webp': 'WebP',
};
const FORMAT_EXTS: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

function formatBytes(bytes: number): string {
    if (bytes === 0) return '0 B';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function getBaseName(filename: string): string {
    return filename.replace(/\.[^/.]+$/, '');
}

function readBrowserImage(file: File): Promise<ImageState> {
    return new Promise((resolve, reject) => {
        if (!file.type.startsWith('image/')) {
            reject(new Error('请选择图片文件'));
            return;
        }

        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => resolve({ file, src: url, width: img.width, height: img.height, name: file.name });
        img.onerror = () => reject(new Error('图片读取失败'));
        img.src = url;
    });
}

function loadHtmlImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

function createDefaultQrLayer(poster: ImageState, index: number): PosterQrLayer {
    const size = Math.round(Math.min(poster.width, poster.height) * 0.14);
    const y = Math.round(poster.height - size - poster.height * 0.035);
    const slotCount = Math.max(1, Math.min(4, index + 2));
    const slot = index % slotCount;
    const x = Math.round((poster.width * (slot + 1)) / (slotCount + 1) - size / 2);

    return clampPosterQrLayer({ x, y, width: size, height: size }, poster.width, poster.height);
}

function isEditableTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement)) return false;
    const tagName = target.tagName.toLowerCase();
    return target.isContentEditable || tagName === 'input' || tagName === 'textarea' || tagName === 'select';
}

function PosterQrReplacementTool() {
    const [poster, setPoster] = useState<ImageState | null>(null);
    const [qrImages, setQrImages] = useState<PosterQrImage[]>([]);
    const [selectedQrId, setSelectedQrId] = useState<PosterQrId | null>(null);
    const [resultUrl, setResultUrl] = useState('');
    const [resultSize, setResultSize] = useState(0);
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState('');
    const [previewWidth, setPreviewWidth] = useState(0);
    const [layerInputDrafts, setLayerInputDrafts] = useState<Record<PosterQrId, Partial<Record<PosterQrLayerKey, string>>>>({});
    const [dragState, setDragState] = useState<{
        id: PosterQrId;
        mode: 'move' | 'resize';
        startX: number;
        startY: number;
        layer: PosterQrLayer;
    } | null>(null);

    const posterInputRef = useRef<HTMLInputElement>(null);
    const qrInputRef = useRef<HTMLInputElement>(null);
    const previewShellRef = useRef<HTMLDivElement>(null);
    const layerCounterRef = useRef(0);
    const undoStackRef = useRef<PosterQrSnapshot[]>([]);

    const saveHistory = useCallback(() => {
        undoStackRef.current = [
            ...undoStackRef.current.slice(-29),
            {
                poster,
                qrImages,
                selectedQrId,
            },
        ];
    }, [poster, qrImages, selectedQrId]);

    const undoLastChange = useCallback(() => {
        const previous = undoStackRef.current.pop();
        if (!previous) return;

        setPoster(previous.poster);
        setQrImages(previous.qrImages);
        setSelectedQrId(previous.selectedQrId);
        setResultUrl('');
        setResultSize(0);
        setError('');
        setLayerInputDrafts({});
    }, []);

    const getLayerInputValue = (image: PosterQrImage, key: PosterQrLayerKey) => {
        return layerInputDrafts[image.id]?.[key] ?? String(image.layer[key]);
    };

    const clearLayerInputDraft = (id: PosterQrId, key: PosterQrLayerKey) => {
        setLayerInputDrafts(current => {
            const nextLayerDraft = { ...current[id] };
            delete nextLayerDraft[key];
            return { ...current, [id]: nextLayerDraft };
        });
    };

    const handleLayerInputChange = (id: PosterQrId, key: PosterQrLayerKey, value: string) => {
        setLayerInputDrafts(current => ({
            ...current,
            [id]: {
                ...current[id],
                [key]: value,
            },
        }));

        if (value === '') return;
        const nextValue = Number(value);
        if (!Number.isFinite(nextValue)) return;
        updateQrLayer(id, { [key]: nextValue } as Partial<PosterQrLayer>);
    };

    useEffect(() => {
        if (!previewShellRef.current) return;
        if (typeof ResizeObserver === 'undefined') {
            setPreviewWidth(previewShellRef.current.clientWidth || 720);
            return;
        }
        const resizeObserver = new ResizeObserver(entries => {
            const width = entries[0]?.contentRect.width || 0;
            setPreviewWidth(width);
        });
        resizeObserver.observe(previewShellRef.current);
        return () => resizeObserver.disconnect();
    }, []);

    const previewScale = poster && previewWidth
        ? Math.min(1, previewWidth / poster.width)
        : 1;
    const previewHeight = poster ? Math.round(poster.height * previewScale) : 360;

    const updateQrLayer = useCallback((id: PosterQrId, patch: Partial<PosterQrLayer>, recordHistory = true) => {
        if (!poster) return;
        if (recordHistory) saveHistory();
        setQrImages(current => {
            return current.map(qr => {
                if (qr.id !== id) return qr;
                const nextLayer = clampPosterQrLayer({ ...qr.layer, ...patch }, poster.width, poster.height);
                return { ...qr, layer: nextLayer };
            });
        });
        setResultUrl('');
        setResultSize(0);
    }, [poster, saveHistory]);

    useEffect(() => {
        if (!dragState || !poster) return;

        const handleMove = (event: PointerEvent) => {
            const dx = (event.clientX - dragState.startX) / previewScale;
            const dy = (event.clientY - dragState.startY) / previewScale;

            if (dragState.mode === 'move') {
                updateQrLayer(dragState.id, {
                    x: dragState.layer.x + dx,
                    y: dragState.layer.y + dy,
                }, false);
            } else {
                const nextSize = Math.max(24, Math.round(Math.max(dragState.layer.width + dx, dragState.layer.height + dy)));
                updateQrLayer(dragState.id, {
                    width: nextSize,
                    height: nextSize,
                }, false);
            }
        };
        const handleEnd = () => setDragState(null);

        window.addEventListener('pointermove', handleMove);
        window.addEventListener('pointerup', handleEnd);
        return () => {
            window.removeEventListener('pointermove', handleMove);
            window.removeEventListener('pointerup', handleEnd);
        };
    }, [dragState, poster, previewScale, updateQrLayer]);

    const handlePosterFile = async (file: File) => {
        try {
            setError('');
            const nextPoster = await readBrowserImage(file);
            saveHistory();
            setPoster(nextPoster);
            setQrImages(current => current.map((qr, index) => ({ ...qr, layer: createDefaultQrLayer(nextPoster, index) })));
            setLayerInputDrafts({});
            setResultUrl('');
            setResultSize(0);
        } catch (err) {
            setError(err instanceof Error ? err.message : '图片读取失败');
        }
    };

    const handleQrFiles = async (files: FileList | File[]) => {
        try {
            setError('');
            const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
            if (imageFiles.length === 0) {
                setError('剪贴板或文件中没有图片');
                return;
            }

            const loadedImages = await Promise.all(imageFiles.map(readBrowserImage));
            saveHistory();
            setQrImages(current => {
                const nextImages = loadedImages.map((image, offset) => {
                    const index = current.length + offset;
                    const id = `qr-${Date.now()}-${layerCounterRef.current++}`;
                    const layer = poster
                        ? createDefaultQrLayer(poster, index)
                        : { x: 0, y: 0, width: image.width, height: image.height };
                    return { ...image, id, layer };
                });
                setSelectedQrId(nextImages[nextImages.length - 1]?.id || current[0]?.id || null);
                return [...current, ...nextImages];
            });
            setResultUrl('');
            setResultSize(0);
        } catch (err) {
            setError(err instanceof Error ? err.message : '图片读取失败');
        }
    };

    const handleRemoveQr = (id: PosterQrId) => {
        saveHistory();
        setQrImages(current => {
            const next = current.filter(qr => qr.id !== id);
            if (selectedQrId === id) {
                setSelectedQrId(next[0]?.id || null);
            }
            return next;
        });
        setResultUrl('');
        setResultSize(0);
        setLayerInputDrafts(current => {
            const next = { ...current };
            delete next[id];
            return next;
        });
    };

    const handleClipboardFiles = useCallback(async (files: File[]) => {
        if (files.length === 0) {
            setError('剪贴板中没有图片');
            return;
        }

        if (!poster) {
            await handlePosterFile(files[0]);
            if (files.length > 1) {
                await handleQrFiles(files.slice(1));
            }
            return;
        }

        await handleQrFiles(files);
    }, [poster]);

    const pasteFromClipboard = useCallback(async () => {
        try {
            setError('');
            const clipboard = navigator.clipboard;
            if (!clipboard || !('read' in clipboard)) {
                setError('当前浏览器不支持直接读取剪贴板图片');
                return;
            }

            const clipboardItems = await clipboard.read();
            const files: File[] = [];
            for (const item of clipboardItems) {
                const imageType = item.types.find(type => type.startsWith('image/'));
                if (!imageType) continue;
                const blob = await item.getType(imageType);
                const extension = imageType.split('/')[1] || 'png';
                files.push(new File([blob], `clipboard-${Date.now()}.${extension}`, { type: imageType }));
            }
            await handleClipboardFiles(files);
        } catch (err) {
            setError(err instanceof Error ? err.message : '剪贴板图片读取失败');
        }
    }, [handleClipboardFiles]);

    useEffect(() => {
        const handlePaste = (event: ClipboardEvent) => {
            const files = Array.from(event.clipboardData?.files || []).filter(file => file.type.startsWith('image/'));
            if (files.length > 0) {
                event.preventDefault();
                void handleClipboardFiles(files);
            }
        };
        const handleKeyDown = (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z' && !event.shiftKey && !isEditableTarget(event.target)) {
                event.preventDefault();
                undoLastChange();
                return;
            }
            if (event.key.toLowerCase() !== 'v' || event.ctrlKey || event.metaKey || event.altKey || isEditableTarget(event.target)) return;
            event.preventDefault();
            void pasteFromClipboard();
        };

        window.addEventListener('paste', handlePaste);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('paste', handlePaste);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [handleClipboardFiles, pasteFromClipboard, undoLastChange]);

    const handleExport = async () => {
        if (!poster) return;
        if (qrImages.length === 0) return;

        setProcessing(true);
        setError('');
        try {
            const posterImg = await loadHtmlImage(poster.src);
            const drawableLayers = await Promise.all(qrImages.map(async item => ({
                image: await loadHtmlImage(item.src),
                layer: item.layer,
            })));
            const url = await composePosterQrPng(posterImg, drawableLayers);
            const blob = await (await fetch(url)).blob();
            setResultUrl(url);
            setResultSize(blob.size);
        } catch (err) {
            setError(err instanceof Error ? err.message : '图片合成失败');
        } finally {
            setProcessing(false);
        }
    };

    const handleDownload = () => {
        if (!resultUrl) return;
        const a = document.createElement('a');
        a.href = resultUrl;
        a.download = `${getBaseName(poster?.name || 'poster')}_qr_replaced.png`;
        a.click();
    };

    const selectedImage = qrImages.find(qr => qr.id === selectedQrId) || null;
    const canExport = Boolean(poster && qrImages.length > 0);

    return (
        <div className="flex-grow flex flex-col min-w-0">
            <input
                ref={posterInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={event => {
                    const file = event.target.files?.[0];
                    if (file) void handlePosterFile(file);
                    event.target.value = '';
                }}
            />
            <input
                ref={qrInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={event => {
                    const files = event.target.files;
                    if (files?.length) void handleQrFiles(files);
                    event.target.value = '';
                }}
            />

            <div className="border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-950/30 p-5 md:p-6">
                <div className="grid gap-4 xl:grid-cols-[minmax(220px,280px)_minmax(0,1fr)_minmax(280px,360px)]">
                    <div className="grid gap-3">
                        <button
                            type="button"
                            onClick={() => posterInputRef.current?.click()}
                            className="text-left rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 hover:border-brand-400 transition-colors"
                        >
                            <span className="flex items-center gap-2 font-bold text-slate-800 dark:text-white">
                                <FiUploadCloud className="text-brand-500" /> 上传海报底图
                            </span>
                            <span className="mt-2 block text-xs text-slate-500 dark:text-slate-400 truncate">
                                {poster ? `${poster.name} · ${poster.width} × ${poster.height}` : 'PNG / JPG / WebP'}
                            </span>
                        </button>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                type="button"
                                onClick={() => qrInputRef.current?.click()}
                                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-brand-400 transition-colors flex items-center justify-center gap-2"
                            >
                                <FiPlus /> 添加二维码
                            </button>
                            <button
                                type="button"
                                onClick={() => void pasteFromClipboard()}
                                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-bold text-slate-700 dark:text-slate-200 hover:border-brand-400 transition-colors flex items-center justify-center gap-2"
                            >
                                <FiClipboard /> 粘贴图片
                            </button>
                        </div>
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3 min-w-0">
                        <div className="mb-2 flex items-center justify-between gap-3">
                            <span className="text-sm font-bold text-slate-800 dark:text-white">二维码图层</span>
                            <span className="text-xs text-slate-500 dark:text-slate-400">{qrImages.length} 个</span>
                        </div>
                        {qrImages.length > 0 ? (
                            <div className="flex gap-2 overflow-x-auto pb-1">
                                {qrImages.map((item, index) => (
                                    <button
                                        key={item.id}
                                        type="button"
                                        onClick={() => setSelectedQrId(item.id)}
                                        className={`shrink-0 rounded-lg border px-3 py-2 text-left text-xs transition-colors ${selectedQrId === item.id
                                            ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-950/40 dark:text-brand-300'
                                            : 'border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                                            }`}
                                    >
                                        <span className="block font-bold">二维码 {index + 1}</span>
                                        <span className="block max-w-28 truncate">{item.name}</span>
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 dark:text-slate-400">暂无二维码图层</div>
                        )}
                    </div>

                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
                        {poster && selectedImage ? (
                            <div className="grid grid-cols-4 gap-2">
                                {[
                                    { key: 'x', label: 'X', max: poster.width },
                                    { key: 'y', label: 'Y', max: poster.height },
                                    { key: 'width', label: '宽', max: poster.width },
                                    { key: 'height', label: '高', max: poster.height },
                                ].map(field => (
                                    <label key={field.key} className="text-xs font-medium text-slate-500 dark:text-slate-400">
                                        {field.label}
                                        <input
                                            type="number"
                                            min={0}
                                            max={field.max}
                                            value={getLayerInputValue(selectedImage, field.key as PosterQrLayerKey)}
                                            onChange={event => handleLayerInputChange(selectedImage.id, field.key as PosterQrLayerKey, event.target.value)}
                                            onBlur={() => clearLayerInputDraft(selectedImage.id, field.key as PosterQrLayerKey)}
                                            className="mt-1 w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 dark:text-slate-200"
                                        />
                                    </label>
                                ))}
                            </div>
                        ) : (
                            <div className="text-sm text-slate-500 dark:text-slate-400">选择一个二维码图层后可调整坐标。</div>
                        )}
                    </div>

                    <div className="grid gap-2">
                        {error && (
                            <div className="rounded-lg border border-red-200 bg-red-50 p-2.5 text-sm text-red-600 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
                                {error}
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={handleExport}
                            disabled={!canExport || processing}
                            className="w-full py-3 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:dark:bg-slate-800 disabled:cursor-not-allowed text-white rounded-xl font-bold shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            {processing ? <><FiRefreshCw className="animate-spin" /> 合成中...</> : <><FiCheck /> 导出 PNG</>}
                        </button>
                    </div>
                </div>
            </div>

            <div className="flex-1 min-h-0 p-5 md:p-6 flex flex-col gap-4">
                <div ref={previewShellRef} className="flex-1 min-h-[520px] rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/60 p-4 overflow-auto">
                    {poster ? (
                        <div
                            className="relative mx-auto shadow-sm"
                            style={{ width: Math.round(poster.width * previewScale), height: previewHeight }}
                        >
                            <img src={poster.src} alt="poster preview" className="absolute inset-0 h-full w-full select-none object-contain" draggable={false} />
                            {qrImages.map((item, index) => {
                                const active = selectedQrId === item.id;
                                return (
                                    <div
                                        key={item.id}
                                        role="button"
                                        tabIndex={0}
                                        aria-label={`二维码 ${index + 1} 图层`}
                                        onPointerDown={event => {
                                            setSelectedQrId(item.id);
                                            saveHistory();
                                            setDragState({ id: item.id, mode: 'move', startX: event.clientX, startY: event.clientY, layer: item.layer });
                                        }}
                                        className={`absolute cursor-move touch-none border-2 ${active ? 'border-brand-500' : 'border-white/80'} shadow-lg`}
                                        style={{
                                            left: item.layer.x * previewScale,
                                            top: item.layer.y * previewScale,
                                            width: item.layer.width * previewScale,
                                            height: item.layer.height * previewScale,
                                        }}
                                    >
                                        <img src={item.src} alt={`二维码 ${index + 1}`} className="h-full w-full select-none object-fill" draggable={false} />
                                        <span className="absolute left-1 top-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold text-white">{index + 1}</span>
                                        {active && (
                                            <button
                                                type="button"
                                                aria-label={`删除二维码 ${index + 1}`}
                                                onClick={event => {
                                                    event.stopPropagation();
                                                    handleRemoveQr(item.id);
                                                }}
                                                className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-red-600 text-white shadow"
                                            >
                                                <FiTrash2 className="text-xs" />
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            aria-label={`二维码 ${index + 1} 缩放`}
                                            onPointerDown={event => {
                                                event.stopPropagation();
                                                setSelectedQrId(item.id);
                                                saveHistory();
                                                setDragState({ id: item.id, mode: 'resize', startX: event.clientX, startY: event.clientY, layer: item.layer });
                                            }}
                                            className="absolute -bottom-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-brand-600 text-white shadow"
                                        >
                                            <FiMove className="text-xs" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="flex h-full min-h-[360px] flex-col items-center justify-center gap-4 text-slate-400 dark:text-slate-600">
                            <FiImage className="text-5xl" />
                            <p className="text-sm">上传海报底图后开始编辑</p>
                        </div>
                    )}
                </div>

                {resultUrl && (
                    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 flex flex-col md:flex-row items-center gap-4">
                        <img src={resultUrl} alt="合成结果" className="max-h-40 rounded-xl border border-slate-100 dark:border-slate-800 object-contain" />
                        <div className="flex-1 text-sm text-slate-600 dark:text-slate-300">
                            <p className="font-bold text-slate-800 dark:text-white">合成完成</p>
                            <p className="mt-1">PNG · {poster?.width} × {poster?.height} px · {formatBytes(resultSize)}</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleDownload}
                            className="w-full md:w-auto px-5 py-3 bg-brand-600 hover:bg-brand-700 text-white rounded-xl font-bold shadow-md shadow-brand-500/20 transition-all flex items-center justify-center gap-2"
                        >
                            <FiDownload /> 下载图片
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ImageTool() {
    const [activeTab, setActiveTab] = useState<TabType>('convert');
    const [image, setImage] = useState<ImageState | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [resultUrl, setResultUrl] = useState<string>('');
    const [resultSize, setResultSize] = useState<number>(0);
    const [processing, setProcessing] = useState(false);
    const [downloadName, setDownloadName] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Convert
    const [targetFormat, setTargetFormat] = useState('image/jpeg');

    // Compress
    const [quality, setQuality] = useState(80);

    // Crop - use string type to allow empty input
    const [cropX, setCropX] = useState('0');
    const [cropY, setCropY] = useState('0');
    const [cropW, setCropW] = useState('0');
    const [cropH, setCropH] = useState('0');

    // Resize - use string type to allow empty input
    const [resizeW, setResizeW] = useState('');
    const [resizeH, setResizeH] = useState('');
    const [keepRatio, setKeepRatio] = useState(true);

    // Watermark
    const [watermarkText, setWatermarkText] = useState('水印文字');
    const [watermarkColor, setWatermarkColor] = useState('#ffffff');
    const [watermarkOpacity, setWatermarkOpacity] = useState(60);
    const [watermarkSize, setWatermarkSize] = useState('32');
    const [watermarkPosition, setWatermarkPosition] = useState<'center' | 'bottomRight' | 'bottomLeft' | 'topRight' | 'topLeft' | 'tile'>('bottomRight');

    // Reset result when tab or image changes
    useEffect(() => {
        setResultUrl('');
        setResultSize(0);
    }, [activeTab, image]);

    // Initialize crop/resize when image loads
    useEffect(() => {
        if (image) {
            setCropX('0');
            setCropY('0');
            setCropW(String(image.width));
            setCropH(String(image.height));
            setResizeW(String(image.width));
            setResizeH(String(image.height));
        }
    }, [image]);

    const loadImage = useCallback(async (file: File) => {
        let processFile = file;
        const extension = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
        const isHeic = file.type === 'image/heic' || file.type === 'image/heif' || extension === '.heic' || extension === '.heif';

        if (isHeic) {
            setProcessing(true);
            try {
                const heic2anyModule = await import('heic2any');
                const heic2any = heic2anyModule.default || heic2anyModule;
                const convertedBlob = await heic2any({
                    blob: file,
                    toType: "image/jpeg",
                    quality: 0.92
                });

                const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
                const newName = file.name.replace(/\.heic|\.heif/i, '.jpg');
                processFile = new File([blob], newName, { type: 'image/jpeg' });
            } catch (error) {
                console.error('Failed to convert HEIC/HEIF', error);
                setProcessing(false);
                return;
            }
            setProcessing(false);
        } else if (!processFile.type.startsWith('image/')) {
            return;
        }

        const url = URL.createObjectURL(processFile);
        const img = new Image();
        img.onload = () => {
            setImage({ file: processFile, src: url, width: img.width, height: img.height, name: processFile.name });
            setResultUrl('');
            setResultSize(0);
        };
        img.src = url;
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) loadImage(file);
        e.target.value = '';
    };

    const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); };
    const handleDragLeave = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); };
    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) loadImage(file);
    };

    const handlePaste = useCallback((e: ClipboardEvent) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (let i = 0; i < items.length; i++) {
            const itemType = items[i].type;
            if (itemType.startsWith('image/') || itemType === '') {
                const file = items[i].getAsFile();
                if (file) {
                    const ext = file.name.toLowerCase();
                    if (itemType.startsWith('image/') || ext.endsWith('.heic') || ext.endsWith('.heif')) {
                        loadImage(file);
                        break;
                    }
                }
            }
        }
    }, [loadImage]);

    useEffect(() => {
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handlePaste]);

    const getImageBitmap = (): Promise<HTMLImageElement> => {
        return new Promise((resolve, reject) => {
            if (!image) return reject('no image');
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = image.src;
        });
    };

    const processConvert = async () => {
        if (!image) return;
        setProcessing(true);
        try {
            const img = await getImageBitmap();
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            if (targetFormat === 'image/jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0);
            const url = canvas.toDataURL(targetFormat, 0.92);
            const blob = await (await fetch(url)).blob();
            setResultUrl(url);
            setResultSize(blob.size);
            setDownloadName(`${getBaseName(image.name)}.${FORMAT_EXTS[targetFormat]}`);
        } finally {
            setProcessing(false);
        }
    };

    const processCompress = async () => {
        if (!image) return;
        setProcessing(true);
        try {
            const img = await getImageBitmap();
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            // For jpeg, fill white background
            const mime = image.file!.type === 'image/png' ? 'image/jpeg' : image.file!.type || 'image/jpeg';
            if (mime === 'image/jpeg') {
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }
            ctx.drawImage(img, 0, 0);
            const url = canvas.toDataURL(mime, quality / 100);
            const blob = await (await fetch(url)).blob();
            setResultUrl(url);
            setResultSize(blob.size);
            setDownloadName(`${getBaseName(image.name)}_compressed.${FORMAT_EXTS[mime] || 'jpg'}`);
        } finally {
            setProcessing(false);
        }
    };

    const processCrop = async () => {
        if (!image) return;
        const cxVal = Number(cropX) || 0;
        const cyVal = Number(cropY) || 0;
        const cwVal = Number(cropW) || 0;
        const chVal = Number(cropH) || 0;
        const cw = Math.max(1, Math.min(cwVal, image.width - cxVal));
        const ch = Math.max(1, Math.min(chVal, image.height - cyVal));
        const cx = Math.max(0, Math.min(cxVal, image.width - 1));
        const cy = Math.max(0, Math.min(cyVal, image.height - 1));
        setProcessing(true);
        try {
            const img = await getImageBitmap();
            const canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, cx, cy, cw, ch, 0, 0, cw, ch);
            const mime = image.file!.type || 'image/png';
            const url = canvas.toDataURL(mime, 0.92);
            const blob = await (await fetch(url)).blob();
            setResultUrl(url);
            setResultSize(blob.size);
            setDownloadName(`${getBaseName(image.name)}_cropped.${FORMAT_EXTS[mime] || 'png'}`);
        } finally {
            setProcessing(false);
        }
    };

    const processResize = async () => {
        if (!image) return;
        const rw = Math.max(1, Number(resizeW) || 1);
        const rh = Math.max(1, Number(resizeH) || 1);
        setProcessing(true);
        try {
            const img = await getImageBitmap();
            const canvas = document.createElement('canvas');
            canvas.width = rw;
            canvas.height = rh;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0, rw, rh);
            const mime = image.file!.type || 'image/png';
            const url = canvas.toDataURL(mime, 0.92);
            const blob = await (await fetch(url)).blob();
            setResultUrl(url);
            setResultSize(blob.size);
            setDownloadName(`${getBaseName(image.name)}_${rw}x${rh}.${FORMAT_EXTS[mime] || 'png'}`);
        } finally {
            setProcessing(false);
        }
    };

    const processWatermark = async () => {
        if (!image) return;
        setProcessing(true);
        try {
            const img = await getImageBitmap();
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);

            // Parse color + opacity
            const hex = watermarkColor.replace('#', '');
            const r = parseInt(hex.substring(0, 2), 16);
            const g = parseInt(hex.substring(2, 4), 16);
            const b = parseInt(hex.substring(4, 6), 16);
            const alpha = watermarkOpacity / 100;

            ctx.font = `bold ${Number(watermarkSize) || 32}px Inter, Arial, sans-serif`;
            ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
            ctx.textBaseline = 'middle';

            const padding = 20;
            const textMetrics = ctx.measureText(watermarkText);
            const textW = textMetrics.width;
            const textH = Number(watermarkSize) || 32;

            if (watermarkPosition === 'tile') {
                const stepX = textW + 60;
                const stepY = textH + 60;
                ctx.save();
                for (let y = -stepY; y < canvas.height + stepY; y += stepY) {
                    for (let x = -stepX; x < canvas.width + stepX; x += stepX) {
                        ctx.save();
                        ctx.translate(x + textW / 2, y + textH / 2);
                        ctx.rotate(-Math.PI / 6);
                        ctx.fillText(watermarkText, -textW / 2, 0);
                        ctx.restore();
                    }
                }
                ctx.restore();
            } else {
                let x = 0, y = 0;
                if (watermarkPosition === 'center') {
                    x = canvas.width / 2 - textW / 2;
                    y = canvas.height / 2;
                } else if (watermarkPosition === 'bottomRight') {
                    x = canvas.width - textW - padding;
                    y = canvas.height - textH / 2 - padding;
                } else if (watermarkPosition === 'bottomLeft') {
                    x = padding;
                    y = canvas.height - textH / 2 - padding;
                } else if (watermarkPosition === 'topRight') {
                    x = canvas.width - textW - padding;
                    y = textH / 2 + padding;
                } else if (watermarkPosition === 'topLeft') {
                    x = padding;
                    y = textH / 2 + padding;
                }
                ctx.fillText(watermarkText, x, y);
            }

            const mime = image.file!.type || 'image/png';
            const url = canvas.toDataURL(mime, 0.92);
            const blob = await (await fetch(url)).blob();
            setResultUrl(url);
            setResultSize(blob.size);
            setDownloadName(`${getBaseName(image.name)}_watermarked.${FORMAT_EXTS[mime] || 'png'}`);
        } finally {
            setProcessing(false);
        }
    };

    const handleProcess = () => {
        switch (activeTab) {
            case 'convert': return processConvert();
            case 'compress': return processCompress();
            case 'crop': return processCrop();
            case 'resize': return processResize();
            case 'watermark': return processWatermark();
            case 'posterQr': return undefined;
        }
    };

    const handleDownload = () => {
        if (!resultUrl) return;
        const a = document.createElement('a');
        a.href = resultUrl;
        a.download = downloadName || 'image';
        a.click();
    };

    const handleResizeWidthChange = (val: string) => {
        setResizeW(val);
        if (keepRatio && image && val !== '') {
            const numVal = Number(val);
            if (!isNaN(numVal)) {
                setResizeH(String(Math.round(numVal * image.height / image.width)));
            }
        }
    };
    const handleResizeHeightChange = (val: string) => {
        setResizeH(val);
        if (keepRatio && image && val !== '') {
            const numVal = Number(val);
            if (!isNaN(numVal)) {
                setResizeW(String(Math.round(numVal * image.width / image.height)));
            }
        }
    };

    const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
        { id: 'convert', label: '格式转换', icon: <FiRefreshCw /> },
        { id: 'compress', label: '压缩', icon: <FiSliders /> },
        { id: 'crop', label: '裁剪', icon: <FiCrop /> },
        { id: 'resize', label: '缩放', icon: <FiMaximize2 /> },
        { id: 'watermark', label: '水印', icon: <FiDroplet /> },
        { id: 'posterQr', label: '二维码替换', icon: <FiGrid /> },
    ];

    return (
        <div className="flex flex-col md:flex-row h-full w-full bg-transparent min-h-[700px]">
            {/* Sidebar */}
            <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col bg-white/40 dark:bg-slate-900/40">
                <h2 className="text-xl font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
                    <FiImage className="text-brand-500" /> 图片处理
                </h2>
                <div className="flex flex-col gap-2">
                    {tabs.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`py-3.5 px-5 rounded-2xl flex items-center gap-3 font-semibold transition-all ${activeTab === tab.id
                                ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700'
                                }`}
                        >
                            <span className="text-lg">{tab.icon}</span> {tab.label}
                        </button>
                    ))}
                </div>
                <div className="mt-auto pt-8 text-sm text-slate-500 dark:text-slate-400">
                    <p>所有处理均在浏览器本地完成，图片不会上传到任何服务器。</p>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-grow flex flex-col bg-white/60 dark:bg-slate-950/60 overflow-y-auto">
                {activeTab === 'posterQr' ? (
                    <PosterQrReplacementTool />
                ) : (
                <div className="flex-grow flex flex-col lg:flex-row gap-0 divide-y lg:divide-y-0 lg:divide-x divide-slate-200 dark:divide-slate-800">
                    {/* Left: Upload + Settings */}
                    <div className="flex-1 p-6 md:p-8 flex flex-col gap-6 min-w-0">
                        {/* Upload zone */}
                        <div>
                            <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3">
                                上传图片
                            </label>
                            <div
                                className={`relative border-2 border-dashed rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer transition-all group ${isDragging
                                    ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20'
                                    : 'border-slate-300 dark:border-slate-700 hover:border-brand-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                                    }`}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={() => fileInputRef.current?.click()}
                            >
                                <input type="file" className="hidden" accept="image/*,.heic,.heif" ref={fileInputRef} onChange={handleFileChange} />
                                {image ? (
                                    <div className="relative w-full flex flex-col items-center gap-3">
                                        <img
                                            src={image.src}
                                            alt="preview"
                                            className="max-h-48 max-w-full object-contain rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm"
                                        />
                                        <div className="flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400 justify-center">
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">{image.name}</span>
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">{image.width} × {image.height} px</span>
                                            <span className="bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full">{formatBytes(image.file!.size)}</span>
                                        </div>
                                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 dark:bg-white/5 rounded-xl cursor-pointer">
                                            <div className="bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 px-4 py-2 rounded-full font-bold shadow-xl flex items-center gap-2 text-sm">
                                                <FiUploadCloud /> 点击重新上传
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center py-4 gap-3">
                                        <div className="w-16 h-16 bg-brand-100 text-brand-600 dark:bg-brand-900/50 dark:text-brand-400 rounded-full flex items-center justify-center text-3xl shadow-sm group-hover:scale-110 transition-transform">
                                            <FiUploadCloud />
                                        </div>
                                        <p className="font-semibold text-slate-700 dark:text-slate-200">点击上传 或 拖拽图片至此</p>
                                        <p className="text-slate-400 text-sm">支持 JPG、PNG、WebP、HEIF/HEIC 等格式，也可 Ctrl+V 粘贴</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Settings panel per tab */}
                        {image && (
                            <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-5 border border-slate-200 dark:border-slate-700 flex flex-col gap-5">
                                {/* Convert */}
                                {activeTab === 'convert' && (
                                    <div className="flex flex-col gap-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><FiRefreshCw className="text-brand-500" /> 格式转换</h4>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-600 dark:text-slate-400 mb-2">目标格式</label>
                                            <div className="flex gap-3 flex-wrap">
                                                {FORMAT_OPTIONS.map(fmt => (
                                                    <button
                                                        key={fmt}
                                                        onClick={() => setTargetFormat(fmt)}
                                                        className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all border ${targetFormat === fmt
                                                            ? 'bg-brand-600 text-white border-brand-600 shadow-sm'
                                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                                                            }`}
                                                    >
                                                        {FORMAT_LABELS[fmt]}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                            <FiInfo className="mt-0.5 flex-shrink-0 text-blue-500" />
                                            转为 JPEG 时，透明背景将自动填充为白色。
                                        </div>
                                    </div>
                                )}

                                {/* Compress */}
                                {activeTab === 'compress' && (
                                    <div className="flex flex-col gap-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><FiSliders className="text-brand-500" /> 压缩质量</h4>
                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="text-sm font-medium text-slate-600 dark:text-slate-400">质量</label>
                                                <span className="text-2xl font-bold text-brand-600 dark:text-brand-400 tabular-nums">{quality}%</span>
                                            </div>
                                            <input
                                                type="range" min={1} max={100} value={quality}
                                                onChange={e => setQuality(Number(e.target.value))}
                                                className="w-full accent-brand-600 cursor-pointer"
                                            />
                                            <div className="flex justify-between text-xs text-slate-400 mt-1">
                                                <span>最小文件</span>
                                                <span>最高画质</span>
                                            </div>
                                        </div>
                                        <div className="text-sm text-slate-500 dark:text-slate-400 flex items-start gap-2 bg-blue-50 dark:bg-blue-900/20 p-3 rounded-xl border border-blue-100 dark:border-blue-800/30">
                                            <FiInfo className="mt-0.5 flex-shrink-0 text-blue-500" />
                                            建议 70~85% 之间，画质与体积均衡。PNG 为无损格式，压缩效果有限。
                                        </div>
                                    </div>
                                )}

                                {/* Crop */}
                                {activeTab === 'crop' && (
                                    <div className="flex flex-col gap-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><FiCrop className="text-brand-500" /> 裁剪区域</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            {[
                                                { label: '起始 X', value: cropX, setter: setCropX, max: image.width - 1, default: '0' },
                                                { label: '起始 Y', value: cropY, setter: setCropY, max: image.height - 1, default: '0' },
                                                { label: '宽度', value: cropW, setter: setCropW, max: image.width, default: '0' },
                                                { label: '高度', value: cropH, setter: setCropH, max: image.height, default: '0' },
                                            ].map(({ label, value, setter, max, default: defaultVal }) => (
                                                <div key={label}>
                                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label} <span className="text-slate-400">(0~{max})</span></label>
                                                    <input
                                                        type="number" min={0} max={max} value={value} step={1}
                                                        onChange={e => setter(e.target.value)}
                                                        onBlur={e => {
                                                            const val = Number(e.target.value);
                                                            if (isNaN(val) || e.target.value === '') {
                                                                setter(defaultVal);
                                                            } else {
                                                                setter(String(Math.max(0, Math.min(max, val))));
                                                            }
                                                        }}
                                                        className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 dark:text-slate-200"
                                                    />
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">原始尺寸: {image.width} × {image.height} px</p>
                                    </div>
                                )}

                                {/* Resize */}
                                {activeTab === 'resize' && (
                                    <div className="flex flex-col gap-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><FiMaximize2 className="text-brand-500" /> 缩放尺寸</h4>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">宽度 (px)</label>
                                                <input
                                                    type="number" min={1} value={resizeW} step={1}
                                                    onChange={e => handleResizeWidthChange(e.target.value)}
                                                    onBlur={e => {
                                                        const val = Number(e.target.value);
                                                        if (isNaN(val) || e.target.value === '' || val < 1) {
                                                            setResizeW(String(image.width));
                                                        } else {
                                                            setResizeW(e.target.value);
                                                        }
                                                    }}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 dark:text-slate-200"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">高度 (px)</label>
                                                <input
                                                    type="number" min={1} value={resizeH} step={1}
                                                    onChange={e => handleResizeHeightChange(e.target.value)}
                                                    onBlur={e => {
                                                        const val = Number(e.target.value);
                                                        if (isNaN(val) || e.target.value === '' || val < 1) {
                                                            setResizeH(String(image.height));
                                                        } else {
                                                            setResizeH(e.target.value);
                                                        }
                                                    }}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 dark:text-slate-200"
                                                />
                                            </div>
                                        </div>
                                        <label className="flex items-center gap-2 cursor-pointer select-none text-sm text-slate-600 dark:text-slate-400">
                                            <div
                                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${keepRatio ? 'bg-brand-600 border-brand-600' : 'border-slate-300 dark:border-slate-600'}`}
                                                onClick={() => setKeepRatio(v => !v)}
                                            >
                                                {keepRatio && <FiCheck className="text-white text-xs" />}
                                            </div>
                                            保持宽高比
                                        </label>
                                        <p className="text-xs text-slate-400 dark:text-slate-500">原始尺寸: {image.width} × {image.height} px</p>
                                    </div>
                                )}

                                {/* Watermark */}
                                {activeTab === 'watermark' && (
                                    <div className="flex flex-col gap-4">
                                        <h4 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><FiDroplet className="text-brand-500" /> 水印设置</h4>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">水印文字</label>
                                            <input
                                                type="text" value={watermarkText}
                                                onChange={e => setWatermarkText(e.target.value)}
                                                placeholder="请输入水印文字"
                                                className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 dark:text-slate-200"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">颜色</label>
                                                <div className="flex items-center gap-2">
                                                    <input type="color" value={watermarkColor} onChange={e => setWatermarkColor(e.target.value)}
                                                        className="w-10 h-10 rounded-lg cursor-pointer border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1"
                                                    />
                                                    <span className="text-sm text-slate-600 dark:text-slate-400 font-mono">{watermarkColor}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">字体大小</label>
                                                <input
                                                    type="number" min={8} max={200} value={watermarkSize} step={1}
                                                    onChange={e => setWatermarkSize(e.target.value)}
                                                    onBlur={e => {
                                                        const val = Number(e.target.value);
                                                        if (isNaN(val) || e.target.value === '') {
                                                            setWatermarkSize('32');
                                                        } else {
                                                            setWatermarkSize(String(Math.max(8, Math.min(200, val))));
                                                        }
                                                    }}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 dark:text-slate-200"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <div className="flex justify-between items-center mb-1">
                                                <label className="text-xs font-medium text-slate-500 dark:text-slate-400">透明度</label>
                                                <span className="text-sm font-bold text-brand-600 dark:text-brand-400">{watermarkOpacity}%</span>
                                            </div>
                                            <input
                                                type="range" min={5} max={100} value={watermarkOpacity}
                                                onChange={e => setWatermarkOpacity(Number(e.target.value))}
                                                className="w-full accent-brand-600 cursor-pointer"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">位置</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {[
                                                    { id: 'topLeft', label: '左上' },
                                                    { id: 'topRight', label: '右上' },
                                                    { id: 'center', label: '居中' },
                                                    { id: 'bottomLeft', label: '左下' },
                                                    { id: 'bottomRight', label: '右下' },
                                                    { id: 'tile', label: '平铺' },
                                                ].map(pos => (
                                                    <button
                                                        key={pos.id}
                                                        onClick={() => setWatermarkPosition(pos.id as any)}
                                                        className={`py-2 rounded-xl text-xs font-semibold transition-all border ${watermarkPosition === pos.id
                                                            ? 'bg-brand-600 text-white border-brand-600'
                                                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:border-brand-400'
                                                            }`}
                                                    >
                                                        {pos.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Process Button */}
                        <button
                            onClick={handleProcess}
                            disabled={!image || processing}
                            className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:dark:bg-slate-800 disabled:cursor-not-allowed text-white rounded-2xl font-bold shadow-md shadow-brand-500/20 hover:shadow-lg hover:shadow-brand-500/30 transition-all flex items-center justify-center gap-2"
                        >
                            {processing ? (
                                <><FiRefreshCw className="animate-spin" /> 处理中...</>
                            ) : (
                                <><FiCheck /> 立即处理</>
                            )}
                        </button>
                    </div>

                    {/* Right: Result */}
                    <div className="flex-1 p-6 md:p-8 flex flex-col gap-6 min-w-0">
                        <h3 className="text-lg font-bold text-slate-800 dark:text-white">处理结果</h3>
                        {resultUrl ? (
                            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4 border border-slate-200 dark:border-slate-700 flex items-center justify-center min-h-[200px]">
                                    <img
                                        src={resultUrl}
                                        alt="result"
                                        className="max-h-72 max-w-full object-contain rounded-xl shadow-sm border border-slate-100 dark:border-slate-800"
                                    />
                                </div>

                                {/* Stats */}
                                <div className="flex flex-wrap gap-3">
                                    <div className="flex-1 min-w-[140px] bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">原始大小</p>
                                        <p className="font-bold text-slate-700 dark:text-slate-200">{formatBytes(image?.file?.size || 0)}</p>
                                    </div>
                                    <div className="flex-1 min-w-[140px] bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">处理后大小</p>
                                        <p className="font-bold text-slate-700 dark:text-slate-200">{formatBytes(resultSize)}</p>
                                    </div>
                                    {activeTab === 'compress' && image?.file && resultSize > 0 && (
                                        <div className="flex-1 min-w-[140px] bg-white dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">压缩率</p>
                                            <p className={`font-bold ${resultSize < image.file.size ? 'text-green-600 dark:text-green-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                                {resultSize < image.file.size
                                                    ? `-${((1 - resultSize / image.file.size) * 100).toFixed(1)}%`
                                                    : '+' + ((resultSize / image.file.size - 1) * 100).toFixed(1) + '%'
                                                }
                                            </p>
                                        </div>
                                    )}
                                </div>

                                <button
                                    onClick={handleDownload}
                                    className="w-full py-3.5 bg-brand-600 hover:bg-brand-700 text-white rounded-2xl font-bold shadow-md shadow-brand-500/20 hover:shadow-lg transition-all flex items-center justify-center gap-2"
                                >
                                    <FiDownload /> 下载图片
                                </button>
                            </div>
                        ) : (
                            <div className="flex-grow flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 gap-4 py-16">
                                <div className="w-20 h-20 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-4xl">
                                    <FiImage />
                                </div>
                                <p className="text-sm text-center">
                                    {image ? '配置参数后点击「立即处理」' : '请先上传图片'}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
                )}
            </div>
        </div>
    );
}
