import React, { useState, useRef, useEffect, useCallback } from 'react';
import QRCode from 'qrcode';
import jsQR from 'jsqr';
import { FiDownload, FiUploadCloud, FiCopy, FiCheck, FiImage, FiEdit3 } from 'react-icons/fi';

export default function QrCodeTool() {
    const [activeTab, setActiveTab] = useState<'generate' | 'parse'>('generate');

    // Generate State
    const [inputText, setInputText] = useState('https://example.com');
    const [qrImageUrl, setQrImageUrl] = useState<string>('');
    const [generateError, setGenerateError] = useState('');

    // Parse State
    const [parseResult, setParseResult] = useState('');
    const [parseError, setParseError] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const [uploadedImagePreview, setUploadedImagePreview] = useState<string>('');

    const [copiedImage, setCopiedImage] = useState(false);
    const [copied, setCopied] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Generate QR Code
    useEffect(() => {
        if (!inputText.trim()) {
            setQrImageUrl('');
            return;
        }
        QRCode.toDataURL(inputText, {
            width: 400,
            margin: 2,
            color: {
                dark: '#0f172a',
                light: '#ffffff'
            }
        })
            .then(url => {
                setQrImageUrl(url);
                setGenerateError('');
            })
            .catch(err => {
                console.error(err);
                setGenerateError('生成二维码失败');
            });
    }, [inputText]);

    // Parse logic
    const decodeImage = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            setParseError('请上传图片文件');
            return;
        }

        const url = URL.createObjectURL(file);
        setUploadedImagePreview(url);

        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
                setParseError('浏览器不支持 canvas');
                return;
            }

            ctx.drawImage(img, 0, 0, img.width, img.height);
            const imageData = ctx.getImageData(0, 0, img.width, img.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });

            if (code) {
                setParseResult(code.data);
                setParseError('');
            } else {
                setParseResult('');
                setParseError('未能识别到二维码，请尝试更清晰的图片');
            }
        };
        img.onerror = () => {
            setParseError('读取图片失败');
        };
        img.src = url;
    }, []);

    // Handle File Upload
    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            decodeImage(file);
        }
    };

    // Drag and Drop
    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) {
            decodeImage(file);
        }
    };

    const handlePaste = useCallback((e: ClipboardEvent) => {
        if (activeTab !== 'parse') return;

        const items = e.clipboardData?.items;
        if (!items) return;

        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                const file = items[i].getAsFile();
                if (file) decodeImage(file);
                break;
            }
        }
    }, [activeTab, decodeImage]);

    useEffect(() => {
        window.addEventListener('paste', handlePaste);
        return () => window.removeEventListener('paste', handlePaste);
    }, [handlePaste]);

    const handleCopy = () => {
        if (!parseResult) return;
        navigator.clipboard.writeText(parseResult);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCopyImage = async () => {
        if (!qrImageUrl) return;
        try {
            const response = await fetch(qrImageUrl);
            const blob = await response.blob();
            await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
            setCopiedImage(true);
            setTimeout(() => setCopiedImage(false), 2000);
        } catch (err) {
            console.error('复制图片失败: ', err);
            // 这里可以添加一个简单的失败提示如果是由于浏览器权限导致
            alert('复制图片失败，请确保浏览器允许写入剪贴板或手动右键复制。');
        }
    };

    const handleDownload = () => {
        if (!qrImageUrl) return;
        const a = document.createElement('a');
        a.href = qrImageUrl;
        a.download = 'qrcode.png';
        a.click();
    };

    return (
        <div className="flex flex-col md:flex-row h-full w-full bg-transparent min-h-[600px]">
            {/* Sidebar for Navigation */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col bg-white/40 dark:bg-slate-900/40">
                <h2 className="text-xl font-bold mb-8 text-slate-800 dark:text-white flex items-center gap-2">
                    二维码工具
                </h2>

                <div className="flex flex-col gap-3">
                    <button
                        onClick={() => setActiveTab('generate')}
                        className={`py-4 px-5 rounded-2xl flex items-center gap-3 font-semibold transition-all ${activeTab === 'generate'
                            ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        <FiEdit3 className="text-xl" /> 生成二维码
                    </button>

                    <button
                        onClick={() => setActiveTab('parse')}
                        className={`py-4 px-5 rounded-2xl flex items-center gap-3 font-semibold transition-all ${activeTab === 'parse'
                            ? 'bg-brand-600 text-white shadow-md shadow-brand-500/20'
                            : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 hover:text-brand-600 dark:hover:text-brand-400 border border-slate-200 dark:border-slate-700'
                            }`}
                    >
                        <FiImage className="text-xl" /> 解析二维码
                    </button>
                </div>

                <div className="mt-auto pt-8 text-sm text-slate-500 dark:text-slate-400">
                    <p>在你的浏览器中本地生成和解析，数据绝对安全。</p>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex-grow flex flex-col bg-white/60 dark:bg-slate-950/60 p-6 md:p-10 transition-all">
                {activeTab === 'generate' && (
                    <div className="max-w-3xl w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white">字符串生成二维码</h3>
                        <p className="text-slate-500 mb-8">输入文本、网址或任何信息，即可实时生成完美对应的二维码。</p>

                        <div className="flex flex-col gap-6 md:gap-8">
                            <div className="w-full">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    输入内容
                                </label>
                                <textarea
                                    value={inputText}
                                    onChange={(e) => setInputText(e.target.value)}
                                    placeholder="输入网址、文本等..."
                                    className="w-full bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-brand-500/50 focus:border-brand-500 transition-all resize-none h-32 md:h-48 shadow-inner text-slate-700 dark:text-slate-200"
                                />
                                {generateError && <p className="text-red-500 text-sm mt-2">{generateError}</p>}
                            </div>

                            <div className="flex flex-col items-center justify-center w-full mx-auto max-w-sm bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-3xl p-6 md:p-8">
                                <div className="bg-white p-4 rounded-2xl shadow-sm mb-6 flex items-center justify-center w-full aspect-square border border-slate-100">
                                    {qrImageUrl ? (
                                        <img src={qrImageUrl} alt="QR Code" className="w-full h-full object-contain" />
                                    ) : (
                                        <div className="text-slate-400 flex flex-col items-center justify-center gap-2">
                                            <FiImage className="text-4xl opacity-50" />
                                            <span>无内容</span>
                                        </div>
                                    )}
                                </div>
                                <div className="flex gap-3 w-full">
                                    <button
                                        onClick={handleCopyImage}
                                        disabled={!qrImageUrl}
                                        className="flex-1 py-3 px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-700 dark:text-slate-300 rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 font-medium"
                                    >
                                        {copiedImage ? <FiCheck className="text-green-500 text-xl" /> : <FiCopy className="text-xl" />} {copiedImage ? '已复制' : '复制图片'}
                                    </button>
                                    <button
                                        onClick={handleDownload}
                                        disabled={!qrImageUrl}
                                        className="flex-1 py-3 px-4 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:dark:bg-slate-800 text-white rounded-xl shadow-sm hover:shadow transition-all flex items-center justify-center gap-2 font-medium"
                                    >
                                        <FiDownload className="text-xl" /> 下载图片
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'parse' && (
                    <div className="max-w-3xl w-full mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h3 className="text-2xl font-bold mb-2 text-slate-800 dark:text-white">二维码解析为字符串</h3>
                        <p className="text-slate-500 mb-8">上传图片、拖拽文件或直接粘贴包含二维码的图片，快速提取内容。</p>

                        <div
                            className={`relative border-2 border-dashed rounded-3xl p-10 flex flex-col items-center justify-center transition-all bg-slate-50 dark:bg-slate-900/30 overflow-hidden group ${isDragging
                                ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-inner'
                                : 'border-slate-300 dark:border-slate-700 hover:border-brand-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
                                }`}
                            onDragOver={handleDragOver}
                            onDragLeave={handleDragLeave}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <input
                                type="file"
                                className="hidden"
                                accept="image/*"
                                ref={fileInputRef}
                                onChange={handleFileUpload}
                            />

                            {uploadedImagePreview && !isDragging ? (
                                <div className="relative w-full h-48 md:h-64 flex items-center justify-center">
                                    <img
                                        src={uploadedImagePreview}
                                        alt="Uploaded Preview"
                                        className="max-w-full max-h-full object-contain rounded-xl shadow-sm border border-slate-200 dark:border-slate-700"
                                    />
                                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/5 dark:bg-white/5 cursor-pointer rounded-xl">
                                        <div className="bg-white dark:bg-slate-800 text-brand-600 dark:text-brand-400 px-6 py-3 rounded-full font-bold shadow-xl flex items-center gap-2 transition-transform transform scale-95 group-hover:scale-100">
                                            <FiUploadCloud className="text-xl" /> 点击或拖拽重新上传
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <>
                                    <div className="w-20 h-20 bg-brand-100 text-brand-600 dark:bg-brand-900/50 dark:text-brand-400 rounded-full flex items-center justify-center text-4xl mb-6 shadow-sm group-hover:scale-110 transition-transform relative z-10">
                                        <FiUploadCloud />
                                    </div>
                                    <h4 className="text-xl font-bold text-slate-800 dark:text-white mb-2 relative z-10">点击上传 或 拖拽图片至此</h4>
                                    <p className="text-slate-500 relative z-10 mb-2">也支持使用 Ctrl+V / Cmd+V 直接粘贴截图</p>
                                </>
                            )}
                        </div>

                        {parseError && (
                            <div className="mt-6 p-4 bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400 rounded-xl border border-red-100 dark:border-red-800/30 flex items-center gap-3">
                                <FiImage className="text-xl flex-shrink-0" />
                                <p>{parseError}</p>
                            </div>
                        )}

                        {parseResult && (
                            <div className="mt-8 animate-in fade-in slide-in-from-bottom-2">
                                <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">
                                    解析结果
                                </label>
                                <div className="relative">
                                    <textarea
                                        readOnly
                                        value={parseResult}
                                        className="w-full bg-white dark:bg-slate-900 border border-brand-200 dark:border-brand-800 rounded-2xl p-5 pr-14 focus:outline-none focus:ring-2 focus:ring-brand-500/30 transition-all resize-none min-h-[140px] shadow-sm text-slate-800 dark:text-slate-100 font-medium"
                                    />
                                    <button
                                        onClick={handleCopy}
                                        className="absolute top-4 right-4 p-2.5 bg-slate-100 hover:bg-brand-50 dark:bg-slate-800 dark:hover:bg-brand-900/50 text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 rounded-xl transition-colors border border-transparent shadow-sm"
                                        title="复制结果"
                                    >
                                        {copied ? <FiCheck className="text-green-500" /> : <FiCopy />}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
