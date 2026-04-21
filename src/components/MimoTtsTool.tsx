import React, { useEffect, useMemo, useState } from 'react';
import {
  FiAlertCircle,
  FiDownload,
  FiKey,
  FiLoader,
  FiMusic,
  FiPlayCircle,
  FiSettings,
  FiSliders,
  FiVolume2,
} from 'react-icons/fi';

import {
  buildMimoTtsRequestBody,
  decodeBase64AudioToBlob,
  extractAudioPayload,
  MIMO_TTS_API_URL,
  MIMO_TTS_FORMATS,
  MIMO_TTS_VOICES,
  type MimoTtsFormat,
  type MimoTtsVoice,
} from '../lib/mimo-tts';

const API_KEY_STORAGE_KEY = 'mimo-tts-api-key';

const QUICK_TAGS = [
  { label: '轻轻停顿', snippet: '（轻轻停顿）' },
  { label: '沉默片刻', snippet: '（沉默片刻）' },
  { label: '低声', snippet: '（低声）' },
  { label: '轻笑', snippet: '（轻笑）' },
  { label: '叹气', snippet: '（叹气）' },
  { label: '呼吸', snippet: '[heavy breathing]' },
];

const STYLE_GUIDE_GROUPS = [
  { label: '语速控制', examples: ['变快', '变慢'] },
  { label: '情绪变化', examples: ['开心', '悲伤', '生气'] },
  { label: '角色扮演', examples: ['孙悟空', '林黛玉'] },
  { label: '风格变化', examples: ['悄悄话', '夹子音', '台湾腔'] },
  { label: '方言', examples: ['东北话', '四川话', '河南话', '粤语'] },
];

const STYLE_EXAMPLES = [
  {
    label: '开心',
    style: '开心',
    text: '明天就是周五了，真开心！',
  },
  {
    label: '东北话',
    style: '东北话',
    text: '哎呀妈呀，这天儿也忒冷了吧！你说这风，嗖嗖的，跟刀子似的，割脸啊！',
  },
  {
    label: '粤语',
    style: '粤语',
    text: '呢个真係好正啊！食过一次就唔会忘记！',
  },
  {
    label: '唱歌',
    style: '唱歌',
    text: '原谅我这一生不羁放纵爱自由，也会怕有一天会跌倒，Oh no。背弃了理想，谁人都可以，哪会怕有一天只你共我。',
  },
];

const TAG_EXAMPLES = [
  '（紧张，深呼吸）呼……冷静，冷静。不就是一个面试吗……（语速加快，碎碎念）自我介绍已经背了五十遍了，应该没问题的。加油，你可以的……（小声）哎呀，领带歪没歪？',
  '（极其疲惫，有气无力）师傅……到地方了叫我一声……（长叹一口气）我先眯一会儿，这班加得我魂儿都要散了。',
  '如果我当时……（沉默片刻）哪怕再坚持一秒钟，结果是不是就不一样了？（苦笑）呵，没如果了。',
  '（寒冷导致的急促呼吸）呼——呼——这、这大兴安岭的雪……（咳嗽）简直能把人骨头冻透了……别、别停下，走，快走。',
  '（提高音量喊话）大姐！这鱼新鲜着呢！早上刚捞上来的！哎！那个谁，别乱翻，压坏了你赔啊？！',
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function buildFileName(format: string): string {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `mimo-tts-${stamp}.${format === 'pcm' ? 'pcm' : format}`;
}

export default function MimoTtsTool() {
  const [apiKey, setApiKey] = useState('');
  const [voice, setVoice] = useState<MimoTtsVoice>('mimo_default');
  const [format, setFormat] = useState<MimoTtsFormat>('wav');
  const [userContext, setUserContext] = useState('');
  const [style, setStyle] = useState('温柔、缓慢、略带耳语');
  const [text, setText] = useState('今天辛苦了。（轻轻停顿）先休息一下吧。');
  const [audioUrl, setAudioUrl] = useState('');
  const [audioSize, setAudioSize] = useState(0);
  const [downloadName, setDownloadName] = useState('');
  const [requestPreview, setRequestPreview] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const savedKey = window.sessionStorage.getItem(API_KEY_STORAGE_KEY);
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  useEffect(() => {
    if (apiKey.trim()) {
      window.sessionStorage.setItem(API_KEY_STORAGE_KEY, apiKey.trim());
      return;
    }

    window.sessionStorage.removeItem(API_KEY_STORAGE_KEY);
  }, [apiKey]);

  useEffect(() => {
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const canSubmit = apiKey.trim().length > 0 && text.trim().length > 0 && status !== 'loading';

  const helperText = useMemo(() => {
    if (status === 'loading') return '正在向 Xiaomi MiMo 发送合成请求...';
    if (status === 'success') return '生成完成';
    if (status === 'error') return errorMessage;
    return '将整体风格写成自然语言，把局部语气变化直接插进正文。';
  }, [errorMessage, status]);

  const insertTag = (snippet: string) => {
    setText((current) => {
      const separator = current && !current.endsWith('\n') ? '' : '';
      return `${current}${separator}${snippet}`;
    });
  };

  const applyStyleExample = (example: (typeof STYLE_EXAMPLES)[number]) => {
    setStyle(example.style);
    setText(example.text);
  };

  const applyTagExample = (example: string) => {
    setText(example);
  };

  const handleGenerate = async () => {
    const trimmedApiKey = apiKey.trim();
    const trimmedText = text.trim();

    if (!trimmedApiKey) {
      setStatus('error');
      setErrorMessage('请先填写 API Key');
      return;
    }

    if (!trimmedText) {
      setStatus('error');
      setErrorMessage('请输入待合成文本');
      return;
    }

    setStatus('loading');
    setErrorMessage('');

    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl('');
    }

    const requestBody = buildMimoTtsRequestBody({
      userContext,
      style,
      text: trimmedText,
      voice,
      format,
    });

    setRequestPreview(JSON.stringify(requestBody, null, 2));

    try {
      const response = await fetch(MIMO_TTS_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': trimmedApiKey,
        },
        body: JSON.stringify(requestBody),
      });

      const payload = await response.json();

      if (!response.ok) {
        const message = payload?.error?.message || payload?.message || '音频生成失败，请检查参数或稍后重试';
        throw new Error(message);
      }

      const audio = extractAudioPayload(payload);
      const blob = decodeBase64AudioToBlob(audio.base64, audio.format);
      const url = URL.createObjectURL(blob);

      setAudioUrl(url);
      setAudioSize(blob.size);
      setDownloadName(buildFileName(audio.format));
      setStatus('success');
    } catch (error) {
      setStatus('error');
      setErrorMessage(error instanceof Error ? error.message : '音频生成失败，请稍后重试');
    }
  };

  return (
    <div className="grid h-full min-h-[720px] grid-cols-1 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="flex min-h-0 flex-col border-b border-slate-200 bg-white/70 xl:border-b-0 xl:border-r dark:border-slate-800 dark:bg-slate-900/60">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <FiMusic size={20} />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-slate-900 dark:text-white">MiMo TTS 语音生成</h2>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                浏览器直连 Xiaomi MiMo，支持整体风格提示和正文内细粒度标签控制。
              </p>
            </div>
          </div>
        </div>

        <div className="grid flex-1 gap-5 overflow-auto p-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FiKey size={16} />
              鉴权配置
            </div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              API Key
              <input
                aria-label="API Key"
                type="password"
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
                placeholder="输入你的小米 MiMo API Key"
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none ring-0 transition focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </label>
            <p className="mt-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
              仅保存在当前浏览器会话，不写入仓库或服务端。
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FiSettings size={16} />
              音频配置
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                音色
                <select
                  aria-label="音色"
                  value={voice}
                  onChange={(event) => setVoice(event.target.value as MimoTtsVoice)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  {MIMO_TTS_VOICES.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                输出格式
                <select
                  aria-label="输出格式"
                  value={format}
                  onChange={(event) => setFormat(event.target.value as MimoTtsFormat)}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                >
                  {MIMO_TTS_FORMATS.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FiSliders size={16} />
              风格控制
            </div>
            <div className="grid gap-4">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                整体风格
                <input
                  aria-label="整体风格"
                  value={style}
                  onChange={(event) => setStyle(event.target.value)}
                  placeholder="例如：温柔、缓慢、略带耳语 / 东北话 / 唱歌"
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">语音整体风格控制写法</div>
                <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                  将 <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{'<style>风格1 风格2</style>待合成内容'}</code>{' '}
                  置于文本开头。多个风格放在同一个 <code className="rounded bg-slate-100 px-1.5 py-0.5 dark:bg-slate-800">{'<style>'}</code>{' '}
                  标签里即可，分隔符不限。
                </p>
                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {STYLE_GUIDE_GROUPS.map((group) => (
                    <div key={group.label} className="rounded-xl bg-slate-50 px-3 py-2 dark:bg-slate-800/70">
                      <div className="text-xs font-semibold text-slate-700 dark:text-slate-300">{group.label}</div>
                      <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">{group.examples.join(' / ')}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4">
                  <div className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">官方风格样例</div>
                  <div className="grid gap-2">
                    {STYLE_EXAMPLES.map((example) => (
                      <button
                        key={example.label}
                        type="button"
                        onClick={() => applyStyleExample(example)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left transition hover:border-brand-300 hover:bg-brand-50/60 dark:border-slate-700 dark:bg-slate-800/70 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
                      >
                        <div className="text-xs font-semibold text-brand-600 dark:text-brand-400">{example.label}</div>
                        <div className="mt-1 break-all font-mono text-[11px] leading-5 text-slate-500 dark:text-slate-400">
                          {`<style>${example.style}</style>${example.text}`}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                用户上下文（可选）
                <textarea
                  aria-label="用户上下文"
                  value={userContext}
                  onChange={(event) => setUserContext(event.target.value)}
                  placeholder="给 TTS 一个对话背景，比如：请用安抚语气回应刚加班完的同事。"
                  rows={3}
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
                />
              </label>

              <div>
                <div className="mb-2 text-sm font-medium text-slate-700 dark:text-slate-300">常用标签快捷插入</div>
                <div className="flex flex-wrap gap-2">
                  {QUICK_TAGS.map((tag) => (
                    <button
                      key={tag.label}
                      type="button"
                      onClick={() => insertTag(tag.snippet)}
                      className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition hover:border-brand-300 hover:text-brand-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:text-brand-400"
                    >
                      {tag.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-white/70 p-4 dark:border-slate-700 dark:bg-slate-900/70">
                <div className="text-sm font-medium text-slate-800 dark:text-slate-200">音频标签细粒度控制样例</div>
                <p className="mt-2 text-xs leading-6 text-slate-500 dark:text-slate-400">
                  通过括号里的提示词，你可以细致控制语气、情绪、节奏和表达方式，比如低声耳语、停顿、呼吸、咳嗽、喊话或语速变化。
                </p>
                <div className="mt-3 grid gap-2">
                  {TAG_EXAMPLES.map((example) => (
                    <button
                      key={example}
                      type="button"
                      onClick={() => applyTagExample(example)}
                      className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs leading-6 text-slate-600 transition hover:border-brand-300 hover:bg-brand-50/60 dark:border-slate-700 dark:bg-slate-800/70 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:bg-brand-500/10"
                    >
                      {example}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FiVolume2 size={16} />
              文本编辑
            </div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              待合成文本
              <textarea
                aria-label="待合成文本"
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder="把要说的话写在这里，并在局部加入（轻声）、（停顿）、[heavy breathing] 这类标签。"
                rows={8}
                className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-7 text-slate-900 outline-none transition focus:border-brand-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
              />
            </label>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={!canSubmit}
                className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:bg-slate-300 dark:disabled:bg-slate-700"
              >
                {status === 'loading' ? <FiLoader className="animate-spin" size={16} /> : <FiPlayCircle size={16} />}
                生成音频
              </button>
              <div
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium ${
                  status === 'error'
                    ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300'
                    : status === 'success'
                      ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                }`}
              >
                {status === 'error' ? <FiAlertCircle size={14} /> : <FiMusic size={14} />}
                {helperText}
              </div>
            </div>
          </div>
        </div>
      </section>

      <aside className="flex min-h-0 flex-col bg-slate-50/70 dark:bg-slate-950/60">
        <div className="border-b border-slate-200 px-6 py-5 dark:border-slate-800">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-white">试听与请求预览</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            生成完成后可直接试听、下载，也可以核对最终请求结构。
          </p>
        </div>

        <div className="flex-1 space-y-5 overflow-auto p-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FiPlayCircle size={16} />
              音频结果
            </div>

            {audioUrl ? (
              <div className="space-y-4">
                <audio aria-label="生成结果音频" controls src={audioUrl} className="w-full" />
                <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <span>文件大小：{formatBytes(audioSize)}</span>
                  <a
                    href={audioUrl}
                    download={downloadName}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-2 font-medium text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
                  >
                    <FiDownload size={14} />
                    下载音频
                  </a>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm leading-6 text-slate-500 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-400">
                还没有音频结果。填写配置后点击“生成音频”，这里会显示播放器和下载按钮。
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/70">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
              <FiSettings size={16} />
              请求预览
            </div>
            <pre className="max-h-[420px] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
              <code>{requestPreview || '点击“生成音频”后，这里会显示发往 Xiaomi MiMo 的请求体。'}</code>
            </pre>
          </div>
        </div>
      </aside>
    </div>
  );
}
