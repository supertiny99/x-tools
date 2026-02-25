import React, { useState, useEffect, useRef } from 'react';
import Peer from 'peerjs';
import type { DataConnection } from 'peerjs';
import { FiSend, FiPaperclip, FiCopy, FiCheck, FiUserPlus, FiInfo } from 'react-icons/fi';

interface Message {
    id: string;
    sender: 'me' | 'remote' | 'system';
    type: 'text' | 'file' | 'system';
    content: string;
    timestamp: number;
    fileName?: string;
    fileSize?: number;
    fileData?: ArrayBuffer;
    progress?: number;
}

export default function WebrtcApp() {
    const [peerId, setPeerId] = useState<string>('');
    const [targetId, setTargetId] = useState<string>('');
    const [connection, setConnection] = useState<DataConnection | null>(null);
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [copied, setCopied] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const peerRef = useRef<Peer | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Initialize Peer
    useEffect(() => {
        // Generate a shorter, readable ID rather than full UUID
        const id = Math.random().toString(36).substring(2, 8).toUpperCase();
        const peer = new Peer(id, {
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.qq.com:3478' },
                    { urls: 'stun:stun.miwifi.com:3478' },
                    { urls: 'stun:stun.taobao.com:3478' }
                ]
            }
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
            setStatus('disconnected');
            // Using setMessages directly because addSystemMessage might not be available
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    sender: 'system',
                    type: 'system',
                    content: `连接异常: ${err.type === 'peer-unavailable' ? '找不到该连接 ID 的伙伴，请确认在线' : err.message}`,
                    timestamp: Date.now(),
                },
            ]);
        });

        peer.on('open', (id) => {
            setPeerId(id);
        });

        // Handle incoming connections
        peer.on('connection', (conn) => {
            handleConnection(conn);
        });

        peerRef.current = peer;

        return () => {
            peer.destroy();
        };
    }, []);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    const handleConnection = (conn: DataConnection) => {
        setConnection(conn);

        // Wait for the connection to be open before sending messages
        conn.on('open', () => {
            setStatus('connected');
            addSystemMessage(`已与 ${conn.peer} 建立连接`);
        });

        conn.on('data', (data: any) => {
            if (data.type === 'text') {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now().toString(),
                        sender: 'remote',
                        type: 'text',
                        content: data.content,
                        timestamp: Date.now(),
                    },
                ]);
            } else if (data.type === 'file-start') {
                addSystemMessage(`${conn.peer} 正在发送文件: ${data.fileName}`);
            } else if (data.type === 'file') {
                // Simple file transfer implementation
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                        sender: 'remote',
                        type: 'file',
                        content: '文件已接收',
                        fileName: data.fileName,
                        fileSize: data.fileSize,
                        fileData: data.file,
                        timestamp: Date.now(),
                    },
                ]);
            }
        });

        conn.on('close', () => {
            setStatus('disconnected');
            setConnection(null);
            addSystemMessage('连接已断开');
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            setStatus('disconnected');
            setConnection(null);
            addSystemMessage(`连接错误: ${err.message}`);
        });
    };

    const connectToPeer = () => {
        if (!peerRef.current || !targetId.trim()) return;
        setStatus('connecting');
        // Add reliable true to improve reliability over SCTP instead of pure UDP
        const conn = peerRef.current.connect(targetId.trim(), {
            reliable: true
        });
        handleConnection(conn);
    };

    const addSystemMessage = (text: string) => {
        setMessages((prev) => [
            ...prev,
            {
                id: Date.now().toString(),
                sender: 'system',
                type: 'system',
                content: text,
                timestamp: Date.now(),
            },
        ]);
    };

    const sendMessage = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        if (!connection || !inputText.trim()) return;

        const data = { type: 'text', content: inputText };
        connection.send(data);

        setMessages((prev) => [
            ...prev,
            {
                id: Date.now().toString(),
                sender: 'me',
                type: 'text',
                content: inputText,
                timestamp: Date.now(),
            },
        ]);
        setInputText('');
    };

    const sendFile = (file: File) => {
        if (!file || !connection) return;

        connection.send({
            type: 'file-start',
            fileName: file.name,
            fileSize: file.size,
        });

        const reader = new FileReader();
        reader.onload = (event) => {
            const fileData = event.target?.result as ArrayBuffer;
            connection.send({
                type: 'file',
                file: fileData,
                fileName: file.name,
                fileSize: file.size,
            });

            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now().toString() + Math.random().toString(36).substring(2, 9),
                    sender: 'me',
                    type: 'file',
                    content: '文件已发送',
                    fileName: file.name,
                    fileSize: file.size,
                    fileData: fileData,
                    timestamp: Date.now(),
                },
            ]);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            sendFile(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (status === 'connected') {
            setIsDragging(true);
        }
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (status === 'connected') {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();

        // Prevent flickering when dragging over child elements
        const rect = e.currentTarget.getBoundingClientRect();
        if (
            e.clientX <= rect.left ||
            e.clientX >= rect.right ||
            e.clientY <= rect.top ||
            e.clientY >= rect.bottom
        ) {
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        if (status !== 'connected') return;

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            Array.from(files).forEach(file => {
                sendFile(file);
            });
        }
    };

    const downloadFile = (message: Message) => {
        if (!message.fileData || !message.fileName) return;
        const blob = new Blob([message.fileData]);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = message.fileName;
        a.click();
        URL.revokeObjectURL(url);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(peerId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    return (
        <div className="flex flex-col md:flex-row h-full w-full bg-transparent min-h-[500px]">
            {/* Sidebar for connection */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col bg-white/40 dark:bg-slate-900/40">
                <h2 className="text-lg font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
                    <FiInfo className="text-brand-500" /> 连接配置
                </h2>

                <div className="mb-8 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        我的连接 ID
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="flex-grow font-mono text-lg font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 selection:bg-brand-100">
                            {peerId || '生成中...'}
                        </div>
                        <button
                            onClick={copyToClipboard}
                            className="p-3 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:border-brand-500 hover:text-brand-500 transition-colors"
                            title="复制 ID"
                        >
                            {copied ? <FiCheck className="text-green-500" /> : <FiCopy />}
                        </button>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        连接到伙伴
                    </label>
                    <div className="flex flex-col gap-3">
                        <input
                            type="text"
                            value={targetId}
                            onChange={(e) => setTargetId(e.target.value.toUpperCase())}
                            placeholder="输入对方的 ID"
                            className="w-full px-4 py-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 focus:outline-none focus:ring-2 focus:ring-brand-500/50 font-mono transition-all"
                            disabled={status === 'connected'}
                        />
                        <button
                            onClick={connectToPeer}
                            disabled={!targetId || status === 'connected' || status === 'connecting'}
                            className="w-full py-3 rounded-xl bg-brand-600 hover:bg-brand-700 disabled:bg-slate-300 disabled:dark:bg-slate-800 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <FiUserPlus />
                            {status === 'connected' ? '已连接' : status === 'connecting' ? '连接中...' : '发起连接'}
                        </button>
                    </div>
                </div>

                {/* Status Indicator */}
                <div className="mt-auto pt-6 flex items-center justify-center gap-2 text-sm font-medium">
                    <span className={`w-2.5 h-2.5 rounded-full ${status === 'connected' ? 'bg-green-500' :
                        status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'
                        }`}></span>
                    <span className={status === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}>
                        {status === 'connected' ? '通信通道已建立' :
                            status === 'connecting' ? '正在握手...' : '等待连接'}
                    </span>
                </div>
            </div>

            {/* Main Chat Area */}
            <div
                className={`flex-grow flex flex-col h-[600px] md:h-auto transition-colors relative ${isDragging ? 'bg-brand-50/80 dark:bg-brand-900/20 ring-2 ring-brand-500 ring-inset' : 'bg-white/60 dark:bg-slate-950/60'}`}
                onDragOver={handleDragOver}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {isDragging && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm pointer-events-none">
                        <div className="text-center p-8 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl flex flex-col items-center gap-4 border-2 border-dashed border-brand-500">
                            <div className="w-20 h-20 bg-brand-100 text-brand-600 dark:bg-brand-900 dark:text-brand-300 rounded-full flex items-center justify-center text-4xl">
                                <FiPaperclip />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-800 dark:text-white">释放文件即可发送</h3>
                            <p className="text-slate-500">支持批量拖入多个文件</p>
                        </div>
                    </div>
                )}
                <div className="flex-grow overflow-y-auto p-6 space-y-4">
                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <div className="w-16 h-16 mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <FiInfo className="text-2xl" />
                            </div>
                            <p>请先在左侧输入对方的 ID 并发起连接</p>
                            <p className="text-sm mt-2">连接建立后，双方的聊天内容及文件均通过本地直连传输，不会经过服务端</p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div key={msg.id} className={`flex ${msg.sender === 'me' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'}`}>
                                {msg.type === 'system' ? (
                                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1 rounded-full">
                                        {msg.content}
                                    </span>
                                ) : (
                                    <div className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${msg.sender === 'me'
                                        ? 'bg-brand-600 text-white rounded-tr-sm'
                                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-sm'
                                        }`}>
                                        {msg.type === 'text' && <p className="whitespace-pre-wrap break-words">{msg.content}</p>}

                                        {msg.type === 'file' && (
                                            <div className="flex flex-col gap-2">
                                                <div className="flex items-center gap-3 bg-black/10 dark:bg-white/5 p-3 rounded-lg">
                                                    <div className="p-2 bg-white/20 rounded">
                                                        <FiPaperclip />
                                                    </div>
                                                    <div className="flex-grow overflow-hidden">
                                                        <p className="font-medium text-sm truncate">{msg.fileName}</p>
                                                        <p className="text-xs opacity-70">{formatSize(msg.fileSize || 0)}</p>
                                                    </div>
                                                    {msg.fileData && (
                                                        <button
                                                            onClick={() => downloadFile(msg)}
                                                            className="ml-2 text-xs font-medium bg-white text-brand-600 px-3 py-1.5 rounded shadow-sm hover:scale-105 transition-transform"
                                                        >
                                                            保存
                                                        </button>
                                                    )}
                                                </div>
                                                {msg.sender === 'me' && <p className="text-xs opacity-80 text-right">文件已发送</p>}
                                            </div>
                                        )}

                                        <span className={`text-[10px] block mt-1 ${msg.sender === 'me' ? 'text-brand-200' : 'text-slate-400'}`}>
                                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 bg-white/80 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800">
                    <form onSubmit={sendMessage} className="flex gap-2 items-end">
                        <button
                            type="button"
                            disabled={status !== 'connected'}
                            onClick={() => fileInputRef.current?.click()}
                            className="p-3 mb-1 text-slate-500 hover:text-brand-600 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors disabled:opacity-50"
                        >
                            <FiPaperclip className="text-xl" />
                        </button>
                        <input
                            type="file"
                            className="hidden"
                            ref={fileInputRef}
                            onChange={handleFileUpload}
                        />

                        <textarea
                            value={inputText}
                            onChange={(e) => setInputText(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    sendMessage();
                                }
                            }}
                            placeholder={status === 'connected' ? '输入消息，回车发送...' : '请先建立连接'}
                            disabled={status !== 'connected'}
                            className="flex-grow bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brand-500/50 resize-none h-[52px] min-h-[52px] max-h-32 disabled:opacity-60 transition-all"
                            rows={1}
                        />

                        <button
                            type="submit"
                            disabled={status !== 'connected' || !inputText.trim()}
                            className="p-3 mb-1 bg-brand-600 hover:bg-brand-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:dark:bg-slate-800 disabled:dark:text-slate-600 text-white rounded-xl shadow-sm transition-all flex items-center justify-center min-w-[52px]"
                        >
                            <FiSend className="text-xl" />
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
