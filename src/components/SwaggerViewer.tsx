import React, { useState, useEffect } from 'react';
import SwaggerUI from 'swagger-ui-react';
import 'swagger-ui-react/swagger-ui.css';
import Editor from '@monaco-editor/react';
import YAML from 'yaml';
import { FiUpload, FiCheck, FiAlertCircle, FiCode } from 'react-icons/fi';

const defaultSpec = `openapi: 3.0.0
info:
  title: Sample API Toolkit
  description: API Documentation generated from the yaml configuration. Edit me in the left panel!
  version: 1.0.0
servers:
  - url: https://api.example.com/v1
    description: Production Server
paths:
  /users:
    get:
      summary: Retrieve a list of users
      responses:
        '200':
          description: A JSON array of user names
          content:
            application/json:
              schema: 
                type: array
                items: 
                  type: string
`;

export default function SwaggerViewer() {
    const [value, setValue] = useState(defaultSpec);
    const [parsedSpec, setParsedSpec] = useState<any>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        try {
            const parsed = YAML.parse(value);
            if (parsed && typeof parsed === 'object') {
                setParsedSpec(parsed);
                setError(null);
            } else {
                throw new Error('Parsed result is not a valid JSON object');
            }
        } catch (err: any) {
            setError(err.message || '格式错误');
        }
    }, [value]);

    const handleEditorChange = (newValue: string | undefined) => {
        if (newValue !== undefined) {
            setValue(newValue);
        }
    };

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target?.result as string;
            if (content) {
                setValue(content);
            }
        };
        reader.readAsText(file);
        e.target.value = ''; // Reset file input
    };

    return (
        <div className="w-full flex-grow flex flex-col bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 shadow-2xl rounded-2xl overflow-hidden backdrop-blur-sm">
            {/* Toolbar */}
            <div className="flex flex-wrap items-center justify-between p-3 sm:p-4 border-b border-slate-200 dark:border-slate-700/50 bg-white dark:bg-slate-800">
                <div className="flex items-center gap-3">
                    <label className="flex items-center gap-2 px-4 py-2 bg-brand-600 hover:bg-brand-700 text-white rounded-lg cursor-pointer transition-all shadow-sm hover:translate-y-[-1px] active:scale-95 font-medium text-sm">
                        <FiUpload className="w-4 h-4" />
                        <span className="hidden sm:inline">导入文件 (JSON/YAML)</span>
                        <span className="sm:hidden">导入</span>
                        <input type="file" accept=".json,.yaml,.yml" className="hidden" onChange={handleFileUpload} />
                    </label>
                </div>
                <div className="flex items-center mt-2 sm:mt-0">
                    {error ? (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg text-sm font-medium border border-red-200 dark:border-red-900/50">
                            <FiAlertCircle className="w-4 h-4 flex-shrink-0" />
                            <span className="max-w-[200px] sm:max-w-[300px] truncate" title={error}>{error}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg text-sm font-medium border border-emerald-200 dark:border-emerald-900/50">
                            <FiCheck className="w-4 h-4" />
                            <span>验证通过</span>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content Area */}
            <div className="flex flex-col lg:flex-row h-[700px] xl:h-[800px] overflow-hidden">
                {/* Left: Editor */}
                <div className="w-full lg:w-5/12 h-1/2 lg:h-full border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-slate-700/50 flex flex-col relative bg-[#1E1E1E]">
                    <div className="absolute top-0 right-0 z-10 px-3 py-1 text-xs text-white/50 bg-black/40 rounded-bl-lg font-mono flex items-center gap-1 backdrop-blur-md">
                        <FiCode /> yaml / json
                    </div>
                    <Editor
                        height="100%"
                        language="yaml"
                        theme="vs-dark"
                        value={value}
                        onChange={handleEditorChange}
                        options={{
                            minimap: { enabled: false },
                            fontSize: 14,
                            fontFamily: "'Fira Code', 'JetBrains Mono', 'Roboto Mono', monospace",
                            wordWrap: 'on',
                            lineNumbers: 'on',
                            scrollBeyondLastLine: false,
                            renderWhitespace: 'none',
                            padding: { top: 20, bottom: 20 },
                            smoothScrolling: true,
                            cursorBlinking: 'smooth',
                            cursorSmoothCaretAnimation: 'on',
                            formatOnPaste: true,
                        }}
                    />
                </div>

                {/* Right: Swagger UI */}
                <div className="w-full lg:w-7/12 h-1/2 lg:h-full overflow-y-auto bg-white relative">
                    {!error && parsedSpec ? (
                        <div className="swagger-ui-wrapper p-2 sm:p-4 min-h-full">
                            <SwaggerUI spec={parsedSpec} />
                        </div>
                    ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 gap-4 p-8 text-center bg-slate-50">
                            <FiAlertCircle className="w-12 h-12 opacity-30 text-red-500" />
                            <p className="text-lg font-medium text-slate-600">无法预览 API 文档</p>
                            <p className="text-sm max-w-md text-slate-500">
                                请在左侧编辑器中修正 YAML 或 JSON 格式错误即可恢复实时预览。
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
