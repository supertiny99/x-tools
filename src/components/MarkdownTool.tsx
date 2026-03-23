import React, { useState, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { FiCopy, FiCheck, FiTrash2, FiFileText, FiEye } from 'react-icons/fi';

const SAMPLE_MD = `# Markdown 预览工具

欢迎使用 **Markdown 预览工具**！在左侧输入 Markdown 文本，右侧将实时显示渲染效果。

## 功能特性

- ✅ 实时预览
- ✅ GitHub 风味 Markdown (GFM)
- ✅ 表格、任务列表、删除线
- ✅ 代码高亮
- ✅ 纯本地处理，数据安全

## 代码示例

\`\`\`javascript
function greet(name) {
  console.log(\`Hello, \${name}!\`);
}
greet('World');
\`\`\`

行内代码：\`const x = 42;\`

## 表格

| 功能 | 状态 | 备注 |
|------|:----:|------|
| 实时预览 | ✅ | 输入即渲染 |
| GFM 支持 | ✅ | 表格/任务列表 |
| 代码高亮 | ✅ | 多语言支持 |

## 任务列表

- [x] 实现编辑器
- [x] 实现预览面板
- [ ] 更多功能开发中...

## 引用

> Markdown 是一种轻量级标记语言，它允许人们使用易读易写的纯文本格式编写文档。
>
> — John Gruber

---

*开始编辑左侧内容，体验实时预览吧！*
`;

export default function MarkdownTool() {
  const [markdown, setMarkdown] = useState(SAMPLE_MD);
  const [copied, setCopied] = useState(false);
  const [view, setView] = useState<'split' | 'edit' | 'preview'>('split');

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }, [markdown]);

  const handleClear = useCallback(() => {
    setMarkdown('');
  }, []);

  const handlePaste = useCallback(async () => {
    const text = await navigator.clipboard.readText();
    setMarkdown(text);
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-200 dark:border-slate-700/60 bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
        <div className="flex items-center gap-1.5">
          {/* View toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-700/50 rounded-lg p-0.5">
            <button
              onClick={() => setView('edit')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                view === 'edit'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <FiFileText size={13} />
              编辑
            </button>
            <button
              onClick={() => setView('split')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                view === 'split'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              分栏
            </button>
            <button
              onClick={() => setView('preview')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                view === 'preview'
                  ? 'bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm'
                  : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              <FiEye size={13} />
              预览
            </button>
          </div>

          <span className="text-xs text-slate-400 dark:text-slate-500 ml-2">
            {markdown.length} 字符
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={handlePaste}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-brand-500/10 text-brand-600 dark:text-brand-400 hover:bg-brand-500/20 transition-colors"
          >
            <FiCopy size={13} />
            粘贴
          </button>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors"
          >
            {copied ? <FiCheck size={13} className="text-emerald-500" /> : <FiCopy size={13} />}
            {copied ? '已复制' : '复制'}
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg text-slate-600 dark:text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors"
          >
            <FiTrash2 size={13} />
            清空
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex min-h-0">
        {/* Editor Panel */}
        {(view === 'split' || view === 'edit') && (
          <div className={`flex flex-col ${view === 'split' ? 'w-1/2 border-r border-slate-200 dark:border-slate-700/60' : 'w-full'}`}>
            <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700/40">
              Markdown 源码
            </div>
            <textarea
              value={markdown}
              onChange={(e) => setMarkdown(e.target.value)}
              className="flex-1 w-full p-4 bg-transparent text-sm text-slate-800 dark:text-slate-200 font-mono leading-relaxed resize-none outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
              placeholder="在此粘贴或输入 Markdown 内容…"
              spellCheck={false}
            />
          </div>
        )}

        {/* Preview Panel */}
        {(view === 'split' || view === 'preview') && (
          <div className={`flex flex-col ${view === 'split' ? 'w-1/2' : 'w-full'}`}>
            <div className="px-3 py-1.5 text-[11px] font-semibold tracking-wider text-slate-400 dark:text-slate-500 uppercase bg-slate-50/50 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700/40">
              渲染预览
            </div>
            <div className="flex-1 overflow-auto p-6">
              <article className="markdown-body prose prose-slate dark:prose-invert max-w-none prose-headings:font-semibold prose-a:text-brand-600 dark:prose-a:text-brand-400 prose-code:before:content-none prose-code:after:content-none prose-code:bg-slate-100 prose-code:dark:bg-slate-800 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-code:font-normal prose-pre:bg-slate-900 prose-pre:dark:bg-slate-950 prose-img:rounded-xl prose-table:text-sm">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {markdown}
                </ReactMarkdown>
              </article>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
