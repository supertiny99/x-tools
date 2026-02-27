import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
    FiUploadCloud, FiDownload, FiImage, FiSliders, FiCrop,
    FiMaximize2, FiDroplet, FiRefreshCw, FiCheck, FiX, FiInfo
} from 'react-icons/fi';

type TabType = 'convert' | 'compress' | 'crop' | 'resize' | 'watermark';

interface ImageState {
    file: File | null;
    src: string;
    width: number;
    height: number;
    name: string;
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

    // Crop
    const [cropX, setCropX] = useState(0);
    const [cropY, setCropY] = useState(0);
    const [cropW, setCropW] = useState(0);
    const [cropH, setCropH] = useState(0);

    // Resize
    const [resizeW, setResizeW] = useState(0);
    const [resizeH, setResizeH] = useState(0);
    const [keepRatio, setKeepRatio] = useState(true);

    // Watermark
    const [watermarkText, setWatermarkText] = useState('水印文字');
    const [watermarkColor, setWatermarkColor] = useState('#ffffff');
    const [watermarkOpacity, setWatermarkOpacity] = useState(60);
    const [watermarkSize, setWatermarkSize] = useState(32);
    const [watermarkPosition, setWatermarkPosition] = useState<'center' | 'bottomRight' | 'bottomLeft' | 'topRight' | 'topLeft' | 'tile'>('bottomRight');

    // Reset result when tab or image changes
    useEffect(() => {
        setResultUrl('');
        setResultSize(0);
    }, [activeTab, image]);

    // Initialize crop/resize when image loads
    useEffect(() => {
        if (image) {
            setCropX(0);
            setCropY(0);
            setCropW(image.width);
            setCropH(image.height);
            setResizeW(image.width);
            setResizeH(image.height);
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
        const cw = Math.max(1, Math.min(cropW, image.width - cropX));
        const ch = Math.max(1, Math.min(cropH, image.height - cropY));
        const cx = Math.max(0, Math.min(cropX, image.width - 1));
        const cy = Math.max(0, Math.min(cropY, image.height - 1));
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
        const rw = Math.max(1, resizeW);
        const rh = Math.max(1, resizeH);
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

            ctx.font = `bold ${watermarkSize}px Inter, Arial, sans-serif`;
            ctx.fillStyle = `rgba(${r},${g},${b},${alpha})`;
            ctx.textBaseline = 'middle';

            const padding = 20;
            const textMetrics = ctx.measureText(watermarkText);
            const textW = textMetrics.width;
            const textH = watermarkSize;

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
        }
    };

    const handleDownload = () => {
        if (!resultUrl) return;
        const a = document.createElement('a');
        a.href = resultUrl;
        a.download = downloadName || 'image';
        a.click();
    };

    const handleResizeWidthChange = (val: number) => {
        setResizeW(val);
        if (keepRatio && image) {
            setResizeH(Math.round(val * image.height / image.width));
        }
    };
    const handleResizeHeightChange = (val: number) => {
        setResizeH(val);
        if (keepRatio && image) {
            setResizeW(Math.round(val * image.width / image.height));
        }
    };

    const tabs: { id: TabType; label: string; icon: React.ReactNode }[] = [
        { id: 'convert', label: '格式转换', icon: <FiRefreshCw /> },
        { id: 'compress', label: '压缩', icon: <FiSliders /> },
        { id: 'crop', label: '裁剪', icon: <FiCrop /> },
        { id: 'resize', label: '缩放', icon: <FiMaximize2 /> },
        { id: 'watermark', label: '水印', icon: <FiDroplet /> },
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
                                                { label: '起始 X', value: cropX, setter: setCropX, max: image.width - 1 },
                                                { label: '起始 Y', value: cropY, setter: setCropY, max: image.height - 1 },
                                                { label: '宽度', value: cropW, setter: setCropW, max: image.width },
                                                { label: '高度', value: cropH, setter: setCropH, max: image.height },
                                            ].map(({ label, value, setter, max }) => (
                                                <div key={label}>
                                                    <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label} <span className="text-slate-400">(0~{max})</span></label>
                                                    <input
                                                        type="number" min={0} max={max} value={value}
                                                        onChange={e => setter(Number(e.target.value))}
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
                                                    type="number" min={1} value={resizeW}
                                                    onChange={e => handleResizeWidthChange(Number(e.target.value))}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/50 text-slate-700 dark:text-slate-200"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">高度 (px)</label>
                                                <input
                                                    type="number" min={1} value={resizeH}
                                                    onChange={e => handleResizeHeightChange(Number(e.target.value))}
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
                                                    type="number" min={8} max={200} value={watermarkSize}
                                                    onChange={e => setWatermarkSize(Number(e.target.value))}
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
            </div>
        </div>
    );
}
