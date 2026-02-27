import React, { useState, useEffect, useRef, useCallback } from 'react';
import Peer from 'peerjs';
import type { DataConnection, MediaConnection } from 'peerjs';
import {
    FiSend, FiPaperclip, FiCopy, FiCheck, FiUserPlus, FiInfo,
    FiPhone, FiPhoneOff, FiPhoneMissed, FiVideo, FiVideoOff,
    FiMic, FiMicOff, FiPhoneIncoming,
} from 'react-icons/fi';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Message {
    id: string;
    sender: 'me' | 'remote' | 'system';
    type: 'text' | 'file' | 'system';
    content: string;
    timestamp: number;
    fileName?: string;
    fileSize?: number;
    fileData?: ArrayBuffer;
}

type CallState =
    | 'idle'
    | 'calling'       // we initiated, waiting for answer
    | 'incoming'      // remote is calling us
    | 'active';       // call in progress

type CallMode = 'audio' | 'video';

// ─── Component ───────────────────────────────────────────────────────────────

export default function WebrtcApp() {
    // Connection
    const [peerId, setPeerId] = useState<string>('');
    const [targetId, setTargetId] = useState<string>('');
    const [connection, setConnection] = useState<DataConnection | null>(null);
    const [status, setStatus] = useState<'disconnected' | 'connecting' | 'connected'>('disconnected');

    // Messages
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [copied, setCopied] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    // Call state
    const [callState, setCallState] = useState<CallState>('idle');
    const [callMode, setCallMode] = useState<CallMode>('audio');
    const [isMuted, setIsMuted] = useState(false);
    const [isCamOff, setIsCamOff] = useState(false);
    const [callDuration, setCallDuration] = useState(0);

    // Refs
    const peerRef = useRef<Peer | null>(null);
    const connectionRef = useRef<DataConnection | null>(null);
    const mediaCallRef = useRef<MediaConnection | null>(null);
    const localStreamRef = useRef<MediaStream | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const localVideoRef = useRef<HTMLVideoElement>(null);
    const remoteVideoRef = useRef<HTMLVideoElement>(null);
    const remoteAudioRef = useRef<HTMLAudioElement>(null);
    const callTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    // ── Peer Initialization ──────────────────────────────────────────────────

    useEffect(() => {
        const id = Math.random().toString(36).substring(2, 8).toUpperCase();
        const peer = new Peer(id, {
            debug: 2,
            config: {
                iceServers: [
                    { urls: 'stun:stun.qq.com:3478' },
                    { urls: 'stun:stun.miwifi.com:3478' },
                    { urls: 'stun:stun.taobao.com:3478' },
                    { urls: 'stun:stun.l.google.com:19302' },
                ],
            },
        });

        peer.on('open', (id) => setPeerId(id));

        peer.on('connection', (conn) => handleDataConnection(conn));

        // Handle incoming media (audio/video) call
        peer.on('call', (call) => {
            mediaCallRef.current = call;
            // Determine mode from metadata
            const mode: CallMode = call.metadata?.mode ?? 'audio';
            setCallMode(mode);
            setCallState('incoming');
            addSystemMessage(`收到来自 ${call.peer} 的${mode === 'video' ? '视频' : '语音'}通话请求`);
        });

        peer.on('error', (err) => {
            console.error('Peer error:', err);
            setStatus('disconnected');
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now().toString(),
                    sender: 'system',
                    type: 'system',
                    content: `连接异常: ${err.type === 'peer-unavailable' ? '找不到该 ID，请确认对方在线' : err.message}`,
                    timestamp: Date.now(),
                },
            ]);
        });

        peerRef.current = peer;

        return () => {
            stopLocalStream();
            peer.destroy();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Call timer ───────────────────────────────────────────────────────────

    useEffect(() => {
        if (callState === 'active') {
            setCallDuration(0);
            callTimerRef.current = setInterval(() => setCallDuration((d) => d + 1), 1000);
        } else {
            if (callTimerRef.current) {
                clearInterval(callTimerRef.current);
                callTimerRef.current = null;
            }
            setCallDuration(0);
        }
        return () => {
            if (callTimerRef.current) clearInterval(callTimerRef.current);
        };
    }, [callState]);

    // ── Helpers ──────────────────────────────────────────────────────────────

    const addSystemMessage = useCallback((text: string) => {
        setMessages((prev) => [
            ...prev,
            {
                id: Date.now().toString() + Math.random(),
                sender: 'system',
                type: 'system',
                content: text,
                timestamp: Date.now(),
            },
        ]);
    }, []);

    const stopLocalStream = () => {
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
    };

    const formatDuration = (s: number) => {
        const m = Math.floor(s / 60).toString().padStart(2, '0');
        const ss = (s % 60).toString().padStart(2, '0');
        return `${m}:${ss}`;
    };

    const formatSize = (bytes: number) => {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    };

    // ── Data connection ──────────────────────────────────────────────────────

    const handleDataConnection = (conn: DataConnection) => {
        connectionRef.current = conn;
        setConnection(conn);

        conn.on('open', () => {
            setStatus('connected');
            addSystemMessage(`已与 ${conn.peer} 建立数据通道`);
        });

        conn.on('data', (data: any) => {
            if (data.type === 'text') {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now().toString() + Math.random(),
                        sender: 'remote',
                        type: 'text',
                        content: data.content,
                        timestamp: Date.now(),
                    },
                ]);
            } else if (data.type === 'file-start') {
                addSystemMessage(`${conn.peer} 正在发送文件: ${data.fileName}`);
            } else if (data.type === 'file') {
                setMessages((prev) => [
                    ...prev,
                    {
                        id: Date.now().toString() + Math.random(),
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
            connectionRef.current = null;
            addSystemMessage('数据通道已断开');
        });

        conn.on('error', (err) => {
            console.error('Connection error:', err);
            setStatus('disconnected');
            setConnection(null);
            connectionRef.current = null;
            addSystemMessage(`连接错误: ${err.message}`);
        });
    };

    const connectToPeer = () => {
        if (!peerRef.current || !targetId.trim()) return;
        setStatus('connecting');
        const conn = peerRef.current.connect(targetId.trim(), { reliable: true });
        handleDataConnection(conn);
    };

    // ── Media call helpers ───────────────────────────────────────────────────

    /**
     * Attach a MediaStream to a media element ref (video or audio).
     */
    const attachStream = (
        ref: React.RefObject<HTMLVideoElement | HTMLAudioElement | null>,
        stream: MediaStream,
    ) => {
        if (!ref.current) return;
        ref.current.srcObject = stream;
        ref.current.play().catch(() => {/* autoplay policy — user gesture already happened */});
    };

    /**
     * Wire up a MediaConnection (call) once the remote stream arrives.
     */
    const setupMediaCall = (call: MediaConnection, localStream: MediaStream) => {
        const mode: CallMode = call.metadata?.mode ?? 'audio';
        call.on('stream', (remoteStream) => {
            if (mode === 'video') {
                attachStream(remoteVideoRef, remoteStream);
            } else {
                attachStream(remoteAudioRef, remoteStream);
            }
            setCallState('active');
            addSystemMessage('通话已接通');
        });

        call.on('close', () => {
            handleCallEnded('对方已挂断');
        });

        call.on('error', (err) => {
            handleCallEnded(`通话错误: ${err.message}`);
        });
    };

    const handleCallEnded = useCallback((reason: string) => {
        stopLocalStream();
        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
        mediaCallRef.current = null;
        setCallState('idle');
        setIsMuted(false);
        setIsCamOff(false);
        addSystemMessage(reason);
    }, [addSystemMessage]);

    // ── Initiate call ────────────────────────────────────────────────────────

    const startCall = async (mode: CallMode) => {
        if (!peerRef.current || !targetId.trim()) return;

        setCallMode(mode);
        setCallState('calling');

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: mode === 'video',
            });

            localStreamRef.current = stream;

            if (mode === 'video') {
                attachStream(localVideoRef, stream);
            }

            const call = peerRef.current.call(targetId.trim(), stream, {
                metadata: { mode },
            });

            mediaCallRef.current = call;
            setupMediaCall(call, stream);

            addSystemMessage(`正在呼叫 ${targetId.trim()} (${mode === 'video' ? '视频通话' : '语音通话'})…`);
        } catch (err: any) {
            setCallState('idle');
            addSystemMessage(`无法获取媒体设备: ${err.message}`);
        }
    };

    // ── Answer incoming call ─────────────────────────────────────────────────

    const answerCall = async () => {
        const call = mediaCallRef.current;
        if (!call) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: callMode === 'video',
            });

            localStreamRef.current = stream;

            if (callMode === 'video') {
                attachStream(localVideoRef, stream);
            }

            call.answer(stream);
            setupMediaCall(call, stream);
        } catch (err: any) {
            setCallState('idle');
            addSystemMessage(`无法获取媒体设备: ${err.message}`);
        }
    };

    // ── Reject / hang up ─────────────────────────────────────────────────────

    const rejectCall = () => {
        mediaCallRef.current?.close();
        mediaCallRef.current = null;
        setCallState('idle');
        addSystemMessage('已拒绝通话');
    };

    const hangUp = () => {
        mediaCallRef.current?.close();
        handleCallEnded('通话已结束');
    };

    // ── In-call controls ─────────────────────────────────────────────────────

    const toggleMute = () => {
        const stream = localStreamRef.current;
        if (!stream) return;
        stream.getAudioTracks().forEach((t) => {
            t.enabled = isMuted; // toggle
        });
        setIsMuted((m) => !m);
    };

    const toggleCamera = () => {
        const stream = localStreamRef.current;
        if (!stream) return;
        stream.getVideoTracks().forEach((t) => {
            t.enabled = isCamOff; // toggle
        });
        setIsCamOff((c) => !c);
    };

    // ── Text / file send ─────────────────────────────────────────────────────

    const sendMessage = (e?: React.FormEvent) => {
        if (e) e.preventDefault();
        const conn = connectionRef.current;
        if (!conn || !inputText.trim()) return;

        conn.send({ type: 'text', content: inputText });
        setMessages((prev) => [
            ...prev,
            {
                id: Date.now().toString() + Math.random(),
                sender: 'me',
                type: 'text',
                content: inputText,
                timestamp: Date.now(),
            },
        ]);
        setInputText('');
    };

    const sendFile = (file: File) => {
        const conn = connectionRef.current;
        if (!file || !conn) return;

        conn.send({ type: 'file-start', fileName: file.name, fileSize: file.size });

        const reader = new FileReader();
        reader.onload = (event) => {
            const fileData = event.target?.result as ArrayBuffer;
            conn.send({ type: 'file', file: fileData, fileName: file.name, fileSize: file.size });
            setMessages((prev) => [
                ...prev,
                {
                    id: Date.now().toString() + Math.random(),
                    sender: 'me',
                    type: 'file',
                    content: '文件已发送',
                    fileName: file.name,
                    fileSize: file.size,
                    fileData,
                    timestamp: Date.now(),
                },
            ]);
        };
        reader.readAsArrayBuffer(file);
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) sendFile(file);
        if (fileInputRef.current) fileInputRef.current.value = '';
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

    // ── Drag & Drop ───────────────────────────────────────────────────────────

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (status === 'connected') setIsDragging(true);
    };

    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (status === 'connected') setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
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
        if (files && files.length > 0) Array.from(files).forEach(sendFile);
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(peerId);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col md:flex-row h-full w-full bg-transparent min-h-[500px]">

            {/* ── Sidebar ── */}
            <div className="w-full md:w-80 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 p-6 flex flex-col bg-white/40 dark:bg-slate-900/40">
                <h2 className="text-lg font-bold mb-6 text-slate-800 dark:text-white flex items-center gap-2">
                    <FiInfo className="text-brand-500" /> 连接配置
                </h2>

                {/* My ID */}
                <div className="mb-8 p-4 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-100 dark:border-slate-700">
                    <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">
                        我的连接 ID
                    </label>
                    <div className="flex items-center gap-2">
                        <div className="flex-grow font-mono text-lg font-bold text-slate-900 dark:text-white bg-white dark:bg-slate-900 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700">
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

                {/* Connect */}
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

                {/* Call buttons — shown when data channel is up */}
                {status === 'connected' && callState === 'idle' && (
                    <div className="mt-4 flex flex-col gap-2">
                        <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">
                            发起通话
                        </p>
                        <button
                            onClick={() => startCall('audio')}
                            className="w-full py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <FiPhone /> 语音通话
                        </button>
                        <button
                            onClick={() => startCall('video')}
                            className="w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium flex items-center justify-center gap-2 transition-colors"
                        >
                            <FiVideo /> 视频通话
                        </button>
                    </div>
                )}

                {/* Calling — waiting */}
                {callState === 'calling' && (
                    <div className="mt-4 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 flex flex-col items-center gap-3">
                        <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400 font-medium">
                            <FiPhone className="animate-pulse" />
                            正在呼叫… {callMode === 'video' ? '(视频)' : '(语音)'}
                        </div>
                        <button
                            onClick={hangUp}
                            className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 transition-colors"
                        >
                            <FiPhoneOff /> 取消
                        </button>
                    </div>
                )}

                {/* Incoming call */}
                {callState === 'incoming' && (
                    <div className="mt-4 p-4 rounded-xl bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 flex flex-col gap-3">
                        <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300 font-medium animate-pulse">
                            <FiPhoneIncoming />
                            来电 — {callMode === 'video' ? '视频通话' : '语音通话'}
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={answerCall}
                                className="flex-1 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-1 transition-colors text-sm"
                            >
                                <FiPhone /> 接听
                            </button>
                            <button
                                onClick={rejectCall}
                                className="flex-1 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-1 transition-colors text-sm"
                            >
                                <FiPhoneMissed /> 拒绝
                            </button>
                        </div>
                    </div>
                )}

                {/* Active call controls */}
                {callState === 'active' && (
                    <div className="mt-4 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                            <span className="text-green-700 dark:text-green-400 font-medium flex items-center gap-2">
                                <FiPhone className="text-green-500" />
                                {callMode === 'video' ? '视频通话' : '语音通话'}
                            </span>
                            <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                                {formatDuration(callDuration)}
                            </span>
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={toggleMute}
                                title={isMuted ? '取消静音' : '静音'}
                                className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1 transition-colors text-sm font-medium ${isMuted
                                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                    : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                                    }`}
                            >
                                {isMuted ? <FiMicOff /> : <FiMic />}
                                {isMuted ? '已静音' : '静音'}
                            </button>
                            {callMode === 'video' && (
                                <button
                                    onClick={toggleCamera}
                                    title={isCamOff ? '开启摄像头' : '关闭摄像头'}
                                    className={`flex-1 py-2 rounded-xl flex items-center justify-center gap-1 transition-colors text-sm font-medium ${isCamOff
                                        ? 'bg-orange-500 hover:bg-orange-600 text-white'
                                        : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
                                        }`}
                                >
                                    {isCamOff ? <FiVideoOff /> : <FiVideo />}
                                    {isCamOff ? '已关摄' : '关摄像'}
                                </button>
                            )}
                        </div>
                        <button
                            onClick={hangUp}
                            className="w-full py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2 transition-colors font-medium"
                        >
                            <FiPhoneOff /> 挂断
                        </button>
                    </div>
                )}

                {/* Status indicator */}
                <div className="mt-auto pt-6 flex items-center justify-center gap-2 text-sm font-medium">
                    <span className={`w-2.5 h-2.5 rounded-full ${status === 'connected' ? 'bg-green-500' :
                        status === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-slate-300 dark:bg-slate-600'
                        }`} />
                    <span className={status === 'connected' ? 'text-green-600 dark:text-green-400' : 'text-slate-500'}>
                        {status === 'connected' ? '通信通道已建立' :
                            status === 'connecting' ? '正在握手...' : '等待连接'}
                    </span>
                </div>
            </div>

            {/* ── Main area ── */}
            <div className="flex-grow flex flex-col min-h-0">

                {/* Video panel — only shown during active video call */}
                {(callState === 'active' || callState === 'calling') && callMode === 'video' && (
                    <div className="relative bg-black w-full" style={{ height: '280px' }}>
                        {/* Remote video (full panel) */}
                        <video
                            ref={remoteVideoRef}
                            autoPlay
                            playsInline
                            className="w-full h-full object-cover"
                        />

                        {/* Local video (picture-in-picture, bottom-right) */}
                        <div className="absolute bottom-3 right-3 w-28 h-20 rounded-xl overflow-hidden border-2 border-white/60 shadow-lg bg-slate-900">
                            <video
                                ref={localVideoRef}
                                autoPlay
                                playsInline
                                muted
                                className="w-full h-full object-cover"
                            />
                            {isCamOff && (
                                <div className="absolute inset-0 bg-slate-800 flex items-center justify-center">
                                    <FiVideoOff className="text-slate-400 text-2xl" />
                                </div>
                            )}
                        </div>

                        {/* Overlay label */}
                        {callState === 'calling' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white gap-2">
                                <FiVideo className="text-4xl animate-pulse" />
                                <p className="text-lg font-medium">等待对方接听…</p>
                            </div>
                        )}

                        {/* Duration badge */}
                        {callState === 'active' && (
                            <div className="absolute top-3 left-3 bg-black/60 text-white text-xs font-mono px-3 py-1 rounded-full">
                                {formatDuration(callDuration)}
                            </div>
                        )}
                    </div>
                )}

                {/* Hidden audio element — always rendered so the ref is available */}
                <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />

                {/* Audio-only call overlay — shown in the chat area top */}
                {callState === 'active' && callMode === 'audio' && (
                    <div className="flex items-center justify-center gap-4 bg-green-50 dark:bg-green-900/20 border-b border-green-200 dark:border-green-800 py-3 px-6">
                        <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-medium">
                            <div className="flex gap-0.5 items-end h-5">
                                {[3, 5, 4, 6, 3, 5, 4].map((h, i) => (
                                    <span
                                        key={i}
                                        style={{ height: `${h * 3}px`, animationDelay: `${i * 0.1}s` }}
                                        className="w-1 bg-green-500 rounded-full animate-pulse"
                                    />
                                ))}
                            </div>
                            语音通话中
                        </div>
                        <span className="font-mono text-sm text-slate-600 dark:text-slate-400">
                            {formatDuration(callDuration)}
                        </span>
                    </div>
                )}

                {/* Audio-only calling overlay */}
                {callState === 'calling' && callMode === 'audio' && (
                    <div className="flex items-center justify-center gap-3 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800 py-3 px-6 text-yellow-700 dark:text-yellow-400 font-medium">
                        <FiPhone className="animate-bounce" /> 正在呼叫语音通话…
                    </div>
                )}

                {/* Chat messages */}
                <div
                    className={`flex-grow overflow-y-auto p-6 space-y-4 transition-colors relative ${isDragging ? 'bg-brand-50/80 dark:bg-brand-900/20 ring-2 ring-brand-500 ring-inset' : 'bg-white/60 dark:bg-slate-950/60'}`}
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

                    {messages.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500">
                            <div className="w-16 h-16 mb-4 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                                <FiInfo className="text-2xl" />
                            </div>
                            <p>请先在左侧输入对方的 ID 并发起连接</p>
                            <p className="text-sm mt-2">连接建立后可发起语音/视频通话，聊天内容及文件均通过本地直连传输</p>
                        </div>
                    ) : (
                        messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === 'me' ? 'justify-end' : msg.sender === 'system' ? 'justify-center' : 'justify-start'}`}
                            >
                                {msg.type === 'system' ? (
                                    <span className="text-xs bg-slate-100 dark:bg-slate-800 text-slate-500 px-3 py-1 rounded-full">
                                        {msg.content}
                                    </span>
                                ) : (
                                    <div className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${msg.sender === 'me'
                                        ? 'bg-brand-600 text-white rounded-tr-sm'
                                        : 'bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-200 border border-slate-100 dark:border-slate-700 rounded-tl-sm'
                                        }`}>
                                        {msg.type === 'text' && (
                                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                                        )}

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
                                                {msg.sender === 'me' && (
                                                    <p className="text-xs opacity-80 text-right">文件已发送</p>
                                                )}
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

                {/* Input area */}
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
