import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Upload, FileText, CheckCircle2, Copy, ExternalLink, ArrowRight, Shield, Calendar, RefreshCw, AlertTriangle, ArrowLeft, Download, FileIcon, Edit3 } from 'lucide-react';

// API base URL - injected by Vite at build time
const API_BASE = typeof __API_BASE__ !== 'undefined' ? __API_BASE__ : '';

// MIME type mapping for file extensions
const MIME_MAP = {
  html: 'text/html; charset=utf-8',
  htm: 'text/html; charset=utf-8',
  md: 'text/markdown; charset=utf-8',
  txt: 'text/plain; charset=utf-8',
  pdf: 'application/pdf',
  hwp: 'application/haansofthwp',
  hwpx: 'application/haansofthwpx',
};

// Text-based files that can be read with file.text()
const TEXT_EXTENSIONS = ['html', 'htm', 'md', 'txt'];

// Binary files that need Base64 encoding
const BINARY_EXTENSIONS = ['pdf', 'hwp', 'hwpx'];

// Files that can be opened with rhwp editor
const RHWP_EXTENSIONS = ['hwp', 'hwpx'];

// All supported extensions
const SUPPORTED_EXTENSIONS = [...TEXT_EXTENSIONS, ...BINARY_EXTENSIONS];

function getExtension(filename) {
  return (filename.split('.').pop() || '').toLowerCase();
}

function getMimeType(filename) {
  const ext = getExtension(filename);
  return MIME_MAP[ext] || 'application/octet-stream';
}

function isTextFile(filename) {
  return TEXT_EXTENSIONS.includes(getExtension(filename));
}

function isRhwpFile(filename) {
  return RHWP_EXTENSIONS.includes(getExtension(filename));
}

function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Fetch a file from the publish API (raw=true for binary) and return as ArrayBuffer
async function fetchRawFile(id, password = '') {
  const headers = {};
  if (password) {
    headers['x-drop-password'] = password;
  }
  const res = await fetch(`${API_BASE}/.netlify/functions/publish?id=${id}&raw=true`, { headers });
  if (!res.ok) throw new Error(`Failed to fetch raw file: ${res.status}`);
  return res.arrayBuffer();
}

// RhwpEditor component — embeds the rhwp-studio editor for HWP/HWPX files
function RhwpEditor({ dropId, dropTitle, password }) {
  const containerRef = useRef(null);
  const editorRef = useRef(null);
  const [status, setStatus] = useState('loading'); // loading, ready, error
  const [pageCount, setPageCount] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function initEditor() {
      try {
        // Dynamically import @rhwp/editor (it's an ESM module)
        const { createEditor } = await import('@rhwp/editor');

        if (cancelled) return;

        const editor = await createEditor(containerRef.current, {
          width: '100%',
          height: '100%',
        });
        editorRef.current = editor;

        // Fetch the raw HWP/HWPX file
        const buffer = await fetchRawFile(dropId, password);

        if (cancelled) return;

        const result = await editor.loadFile(buffer, dropTitle || 'document.hwp', {
          suppressDialogs: true,
        });

        setPageCount(result.pageCount);
        setStatus('ready');
      } catch (err) {
        console.error('RhwpEditor init error:', err);
        if (!cancelled) {
          setStatus('error');
        }
      }
    }

    initEditor();

    return () => {
      cancelled = true;
      if (editorRef.current) {
        try {
          editorRef.current.destroy();
        } catch (e) {
          // ignore
        }
        editorRef.current = null;
      }
    };
  }, [dropId, dropTitle, password]);

  return (
    <div className="w-full min-h-screen flex flex-col bg-[#f5f5f5]">
      {/* Toolbar header */}
      <div className="bg-[#0f1626] text-gray-300 text-xs px-4 py-2 flex justify-between items-center border-b border-[#1e293b] shrink-0">
        <span
          className="font-semibold flex items-center gap-1.5 text-cyan-400 cursor-pointer"
          onClick={() => window.history.back()}
        >
          💧 htmldrop <span className="text-gray-500">| rhwp 에디터</span>
        </span>
        <div className="flex items-center gap-3">
          {pageCount && (
            <span className="text-gray-400">{pageCount} 페이지</span>
          )}
          <a
            href={`${API_BASE}/.netlify/functions/publish?id=${dropId}&raw=true${password ? '&password=' + encodeURIComponent(password) : ''}`}
            download={dropTitle}
            className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs"
          >
            <Download className="w-3 h-3" /> 다운로드
          </a>
        </div>
      </div>

      {/* Editor container */}
      {status === 'loading' && (
        <div className="flex-1 flex items-center justify-center bg-[#0f1626]">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="animate-spin text-cyan-400 w-10 h-10" />
            <p className="text-gray-400">rhwp 에디터를 불러오는 중...</p>
          </div>
        </div>
      )}

      {status === 'error' && (
        <div className="flex-1 flex items-center justify-center bg-[#0f1626]">
          <div className="bg-[#0f1626] border border-[#1e293b] p-8 rounded-2xl w-full max-w-md shadow-2xl text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-white">에디터 로드 실패</h2>
            <p className="text-gray-400 text-sm mb-6">
              rhwp 에디터를 불러오지 못했습니다. 파일을 다운로드하여 로컬에서 열어보세요.
            </p>
            <div className="flex gap-3 justify-center">
              <a
                href={`${API_BASE}/.netlify/functions/publish?id=${dropId}&raw=true${password ? '&password=' + encodeURIComponent(password) : ''}`}
                download={dropTitle}
                className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-6 py-3 rounded-lg transition"
              >
                <Download className="w-4 h-4" /> 파일 다운로드
              </a>
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center gap-2 bg-[#1e293b] hover:bg-[#2d3d5a] text-gray-300 font-semibold px-6 py-3 rounded-lg transition"
              >
                <ArrowLeft className="w-4 h-4" /> 뒤로 가기
              </button>
            </div>
          </div>
        </div>
      )}

      {/* The editor iframe */}
      <div
        ref={containerRef}
        className="flex-1 w-full"
        style={{ display: status === 'ready' ? 'block' : 'none' }}
      />
    </div>
  );
}

function App() {
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [ttlDays, setTtlDays] = useState('7');
  const [publishResult, setPublishResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const [mimeType, setMimeType] = useState('text/html; charset=utf-8');
  const [currentFile, setCurrentFile] = useState(null);

  // View state for published links (Client side routing simulation or Direct Preview)
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [viewData, setViewData] = useState(null);
  const [viewPassword, setViewPassword] = useState('');
  const [viewStatus, setViewStatus] = useState('loading'); // loading, ready, password_required, error

  useEffect(() => {
    // Check for SPA redirect from 404.html (GitHub Pages)
    const redirectPath = sessionStorage.getItem('redirect');
    if (redirectPath) {
      sessionStorage.removeItem('redirect');
      // Extract the path relative to base
      const base = '/htmldrop-clone';
      const relPath = redirectPath.startsWith(base) ? redirectPath.slice(base.length) : redirectPath;
      if (relPath && relPath !== '/') {
        setCurrentPath(relPath);
        window.history.replaceState({}, '', base + relPath);
        return;
      }
    }

    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Fetch target page if the path matches a view
  useEffect(() => {
    const match = currentPath.match(/^\/view\/([a-zA-Z0-9-]+)/);
    const rhwpMatch = currentPath.match(/^\/rhwp-view\/([a-zA-Z0-9-]+)/);
    
    if (rhwpMatch) {
      // rhwp editor route — handled in render
      setViewStatus('rhwp');
    } else if (match) {
      const id = match[1];
      fetchPage(id);
    } else {
      setViewStatus('idle');
    }
  }, [currentPath]);

  const fetchPage = async (id, withPassword = '') => {
    setViewStatus('loading');
    try {
      const headers = {};
      if (withPassword) {
        headers['x-drop-password'] = withPassword;
      }
      
      const res = await fetch(`${API_BASE}/.netlify/functions/publish?id=${id}`, { headers });
      
      if (res.status === 401) {
        setViewStatus('password_required');
        return;
      }
      
      if (!res.ok) {
        setViewStatus('error');
        return;
      }

      const data = await res.json();
      setViewData(data);
      setViewStatus('ready');
    } catch (e) {
      setViewStatus('error');
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const processFile = async (file) => {
    const fileName = file.name;
    const ext = getExtension(fileName);
    
    if (!SUPPORTED_EXTENSIONS.includes(ext)) {
      alert(`지원하지 않는 파일 형식입니다: .${ext}\n지원 형식: ${SUPPORTED_EXTENSIONS.map(e => '.' + e).join(', ')}`);
      return;
    }

    const detectedMime = getMimeType(fileName);
    setMimeType(detectedMime);
    setCurrentFile(file);

    if (isTextFile(fileName)) {
      const text = await readFileAsText(file);
      setContent(text);
    } else {
      // Binary file: convert to Base64 data URI
      const dataUri = await readFileAsDataURL(file);
      setContent(dataUri);
    }
    
    setTitle(fileName.replace(/\.[^/.]+$/, ""));
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      await processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files[0]) {
      await processFile(e.target.files[0]);
    }
  };

  const handlePasteContent = (text) => {
    setContent(text);
    setMimeType('text/html; charset=utf-8');
    setTitle('Pasted Content');
    setCurrentFile(null);
  };

  const handlePublish = async () => {
    if (!content) return;
    setUploadStatus('uploading');
    try {
      const response = await fetch(`${API_BASE}/.netlify/functions/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          title: title || 'Untitled Drop',
          mimeType,
          ttlDays,
          password: password || null
        })
      });

      if (!response.ok) throw new Error('Publish failed');
      const data = await response.json();
      setPublishResult(data);
      setUploadStatus('success');

      // Update local storage of user drops
      const history = JSON.parse(localStorage.getItem('htmldrop_history') || '[]');
      history.unshift({
        id: data.id,
        title: title || 'Untitled Drop',
        url: data.url,
        rhwpUrl: data.rhwpUrl,
        expires_at: data.expires_at,
        created_at: new Date().toISOString()
      });
      localStorage.setItem('htmldrop_history', JSON.stringify(history.slice(0, 50)));
    } catch (err) {
      setUploadStatus('error');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // Helper to check if content is a data URI (binary)
  const isDataUri = (str) => str && str.startsWith('data:');

  // 1. RHWP VIEW MODE — HWP/HWPX files open in rhwp editor
  if (currentPath.startsWith('/rhwp-view/')) {
    const dropId = currentPath.split('/rhwp-view/')[1];

    return (
      <RhwpEditor
        dropId={dropId}
        dropTitle={viewData?.title || 'document.hwp'}
        password=""
      />
    );
  }

  // 2. VIEW VIEW MODE (Rendering actual dropped content)
  if (currentPath.startsWith('/view/')) {
    const dropId = currentPath.split('/view/')[1];

    return (
      <div className="min-h-screen bg-[#070a13] flex flex-col items-center justify-center p-4">
        {viewStatus === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="animate-spin text-cyan-400 w-10 h-10" />
            <p className="text-gray-400">페이지를 로드하고 있습니다...</p>
          </div>
        )}

        {viewStatus === 'password_required' && (
          <div className="bg-[#0f1626] border border-[#1e293b] p-8 rounded-2xl w-full max-w-md shadow-2xl text-center">
            <Shield className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-white">비밀번호가 필요합니다</h2>
            <p className="text-gray-400 text-sm mb-6">이 페이지는 보호되어 있습니다. 비밀번호를 입력해주세요.</p>
            <input
              type="password"
              placeholder="비밀번호"
              value={viewPassword}
              onChange={(e) => setViewPassword(e.target.value)}
              className="w-full bg-[#172033] border border-[#2d3d5a] text-white px-4 py-3 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={() => fetchPage(dropId, viewPassword)}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 rounded-lg transition"
            >
              확인
            </button>
          </div>
        )}

        {viewStatus === 'error' && (
          <div className="bg-[#0f1626] border border-[#1e293b] p-8 rounded-2xl w-full max-w-md shadow-2xl text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-white">찾을 수 없거나 만료된 페이지</h2>
            <p className="text-gray-400 text-sm mb-6">존재하지 않는 페이지이거나 보존 기간(TTL)이 만료되었습니다.</p>
            <button
              onClick={() => navigateTo('/')}
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> 홈으로 이동
            </button>
          </div>
        )}

        {viewStatus === 'ready' && viewData && (() => {
          const vmime = viewData.mimeType || 'text/html';
          const isPdf = vmime.includes('pdf');
          const isHwp = vmime.includes('haansoft');
          const isDataUriContent = isDataUri(viewData.content);

          // HWP/HWPX: rhwp editor link + download
          if (isHwp) {
            return (
              <div className="w-full min-h-screen flex flex-col bg-[#0f1626]">
                <div className="bg-[#0f1626] text-gray-300 text-xs px-4 py-2 flex justify-between items-center border-b border-[#1e293b]">
                  <span className="font-semibold flex items-center gap-1.5 text-cyan-400 cursor-pointer" onClick={() => navigateTo('/')}>
                    💧 htmldrop <span className="text-gray-500">| {viewData.title}</span>
                  </span>
                  <span className="text-gray-400">만료일: {new Date(viewData.expires_at).toLocaleDateString()}</span>
                </div>
                <div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
                  <FileIcon className="w-20 h-20 text-gray-500" />
                  <h3 className="text-xl font-bold text-white">{viewData.title}</h3>
                  <p className="text-gray-400 text-sm">
                    HWP/HWPX 파일입니다. rhwp 에디터로 열어서 편집하거나, 다운로드할 수 있습니다.
                  </p>
                  <div className="flex gap-4 flex-wrap justify-center">
                    {/* Primary: rhwp editor */}
                    <button
                      onClick={() => navigateTo(`/rhwp-view/${dropId}`)}
                      className="inline-flex items-center gap-2 bg-cyan-500 hover:bg-cyan-600 text-white font-semibold px-6 py-3 rounded-lg transition"
                    >
                      <Edit3 className="w-4 h-4" /> rhwp 에디터로 열기
                    </button>
                    <a
                      href={viewData.content}
                      download={viewData.title}
                      className="inline-flex items-center gap-2 bg-[#1e293b] hover:bg-[#2d3d5a] text-gray-300 font-semibold px-6 py-3 rounded-lg transition"
                    >
                      <Download className="w-4 h-4" /> 파일 다운로드
                    </a>
                    <button
                      onClick={() => {
                        window.open(viewData.content, '_blank');
                      }}
                      className="inline-flex items-center gap-2 bg-[#1e293b] hover:bg-[#2d3d5a] text-gray-300 font-semibold px-6 py-3 rounded-lg transition"
                    >
                      <ExternalLink className="w-4 h-4" /> 새 탭에서 열기
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          // PDF: browser native viewer + download
          if (isPdf && isDataUriContent) {
            return (
              <div className="w-full min-h-screen flex flex-col bg-white">
                <div className="bg-[#0f1626] text-gray-300 text-xs px-4 py-2 flex justify-between items-center border-b border-[#1e293b]">
                  <span className="font-semibold flex items-center gap-1.5 text-cyan-400 cursor-pointer" onClick={() => navigateTo('/')}>
                    💧 htmldrop <span className="text-gray-500">| {viewData.title}</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <a
                      href={viewData.content}
                      download={viewData.title}
                      className="inline-flex items-center gap-1 text-cyan-400 hover:text-cyan-300 text-xs"
                    >
                      <Download className="w-3 h-3" /> 다운로드
                    </a>
                    <span className="text-gray-400">만료일: {new Date(viewData.expires_at).toLocaleDateString()}</span>
                  </div>
                </div>
                <iframe
                  src={viewData.content}
                  title={viewData.title}
                  className="w-full flex-1 border-none bg-white"
                />
              </div>
            );
          }

          // HTML / MD / TXT: render in iframe
          return (
            <div className="w-full min-h-screen flex flex-col bg-white text-black">
              <div className="bg-[#0f1626] text-gray-300 text-xs px-4 py-2 flex justify-between items-center border-b border-[#1e293b]">
                <span className="font-semibold flex items-center gap-1.5 text-cyan-400 cursor-pointer" onClick={() => navigateTo('/')}>
                  💧 htmldrop <span className="text-gray-500">| {viewData.title}</span>
                </span>
                <span className="text-gray-400">만료일: {new Date(viewData.expires_at).toLocaleDateString()}</span>
              </div>
              <iframe
                srcDoc={viewData.content}
                title={viewData.title}
                className="w-full flex-1 border-none bg-white"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          );
        })()}
      </div>
    );
  }

  // MAIN CREATOR INTERFACE
  return (
    <div className="min-h-screen bg-[#070a13] flex flex-col items-center pt-8 pb-16 px-4">
      {/* Header */}
      <div className="text-center mb-10">
        <div className="inline-flex items-center gap-2 mb-3">
          <span className="text-3xl">💧</span>
          <h1 className="text-3xl font-bold text-white">htmldrop</h1>
        </div>
        <p className="text-gray-400 text-sm">Temporary publishing — 설치 없이 바로 공유</p>
        <p className="text-gray-500 text-xs mt-1">Publish at the speed of thought</p>
      </div>

      {/* Main Card */}
      <div className="w-full max-w-2xl bg-[#0f1626] border border-[#1e293b] rounded-2xl p-6 shadow-2xl">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8 text-xs text-gray-500">
          <span className="bg-cyan-500/20 text-cyan-400 px-3 py-1 rounded-full font-semibold">01 파일 선택</span>
          <ArrowRight className="w-3 h-3" />
          <span className="bg-[#1e293b] px-3 py-1 rounded-full">02 옵션 설정</span>
          <ArrowRight className="w-3 h-3" />
          <span className="bg-[#1e293b] px-3 py-1 rounded-full">03 링크 공유</span>
        </div>

        {/* Drop Zone */}
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center transition-all cursor-pointer mb-6 ${
            dragActive
              ? 'border-cyan-400 bg-cyan-400/10'
              : 'border-[#2d3d5a] hover:border-gray-500 bg-[#0a0f1a]'
          }`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
          onClick={() => document.getElementById('fileInput').click()}
        >
          {content ? (
            <div className="flex flex-col items-center gap-2">
              <CheckCircle2 className="w-10 h-10 text-green-400" />
              <p className="text-white font-semibold">{currentFile ? currentFile.name : '코드 붙여넣기 완료'}</p>
              <p className="text-gray-400 text-xs">
                {currentFile 
                  ? `${getExtension(currentFile.name).toUpperCase()} 파일 · ${(currentFile.size / 1024).toFixed(1)} KB`
                  : `${content.length.toLocaleString()} 자`}
              </p>
              <button
                onClick={(e) => { e.stopPropagation(); setContent(''); setCurrentFile(null); }}
                className="text-xs text-red-400 hover:text-red-300 mt-1"
              >
                변경하기
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3">
              <Upload className="w-10 h-10 text-gray-500" />
              <p className="text-white font-semibold">파일을 끌어다 놓으세요</p>
              <p className="text-gray-400 text-xs">또는 클릭해서 파일 선택</p>
              <p className="text-gray-500 text-xs mt-1">
                · {SUPPORTED_EXTENSIONS.map(e => '.' + e).join(' / ')}
              </p>
            </div>
          )}
          <input
            id="fileInput"
            type="file"
            className="hidden"
            accept={SUPPORTED_EXTENSIONS.map(e => '.' + e).join(',')}
            onChange={handleFileInput}
          />
        </div>

        {/* Paste code area */}
        {!content && (
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-gray-500" />
              <span className="text-gray-400 text-xs">or paste code</span>
            </div>
            <textarea
              placeholder="HTML / Markdown 코드를 여기에 붙여넣으세요..."
              className="w-full bg-[#0a0f1a] border border-[#2d3d5a] text-gray-300 rounded-lg p-4 h-32 resize-y focus:outline-none focus:ring-2 focus:ring-cyan-500 text-sm"
              onChange={(e) => {
                if (e.target.value) {
                  handlePasteContent(e.target.value);
                }
              }}
            />
          </div>
        )}

        {/* Options */}
        {content && (
          <div className="space-y-4 animate-fadeIn">
            {/* Title */}
            <div>
              <label className="text-gray-400 text-xs mb-1 block">페이지 제목</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#0a0f1a] border border-[#2d3d5a] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                placeholder="제목을 입력하세요"
              />
            </div>

            <div className="flex gap-4 flex-wrap">
              {/* TTL */}
              <div className="flex-1 min-w-[150px]">
                <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                  <Calendar className="w-3 h-3" /> 보존 기간
                </label>
                <select
                  value={ttlDays}
                  onChange={(e) => setTtlDays(e.target.value)}
                  className="w-full bg-[#0a0f1a] border border-[#2d3d5a] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                >
                  <option value="1">1일</option>
                  <option value="7">7일</option>
                  <option value="30">30일</option>
                </select>
              </div>

              {/* Password */}
              <div className="flex-1 min-w-[150px]">
                <label className="text-gray-400 text-xs mb-1 flex items-center gap-1">
                  <Shield className="w-3 h-3" /> 비밀번호 (선택)
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#0a0f1a] border border-[#2d3d5a] text-white rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-500"
                  placeholder="비밀번호 (없으면 공개)"
                />
              </div>
            </div>

            {/* HWP/HWPX hint */}
            {currentFile && isRhwpFile(currentFile.name) && (
              <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-3 flex items-center gap-3">
                <Edit3 className="w-5 h-5 text-cyan-400 shrink-0" />
                <p className="text-cyan-300 text-sm">
                  HWP/HWPX 파일입니다. 공유하면 rhwp 에디터로 열어서 편집할 수 있습니다.
                </p>
              </div>
            )}

            {/* Publish Button */}
            {uploadStatus !== 'success' ? (
              <button
                onClick={handlePublish}
                disabled={uploadStatus === 'uploading'}
                className={`w-full font-semibold py-3 rounded-lg transition flex items-center justify-center gap-2 ${
                  uploadStatus === 'uploading'
                    ? 'bg-gray-600 text-gray-300 cursor-not-allowed'
                    : 'bg-cyan-500 hover:bg-cyan-600 text-white'
                }`}
              >
                {uploadStatus === 'uploading' ? (
                  <>
                    <RefreshCw className="animate-spin w-4 h-4" /> 업로드 중...
                  </>
                ) : (
                  '공유 링크 만들기'
                )}
              </button>
            ) : (
              /* Success State */
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-5 text-center space-y-3">
                <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto" />
                <p className="text-green-400 font-semibold">공유 링크가 생성되었습니다!</p>

                {/* Standard view URL */}
                <div className="flex items-center gap-2 bg-[#0a0f1a] border border-[#2d3d5a] rounded-lg px-4 py-2.5">
                  <input
                    type="text"
                    value={publishResult?.url || ''}
                    readOnly
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                  />
                  <button
                    onClick={() => copyToClipboard(publishResult?.url || '')}
                    className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-sm"
                  >
                    {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? '복사됨' : '복사'}
                  </button>
                </div>

                {/* RHWP editor URL — only for HWP/HWPX files */}
                {publishResult?.rhwpUrl && (
                  <div className="flex items-center gap-2 bg-[#0a0f1a] border border-cyan-500/50 rounded-lg px-4 py-2.5">
                    <Edit3 className="w-4 h-4 text-cyan-400 shrink-0" />
                    <input
                      type="text"
                      value={publishResult.rhwpUrl}
                      readOnly
                      className="flex-1 bg-transparent text-cyan-300 text-sm focus:outline-none"
                    />
                    <button
                      onClick={() => copyToClipboard(publishResult.rhwpUrl)}
                      className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 text-sm shrink-0"
                    >
                      <Copy className="w-4 h-4" /> 복사
                    </button>
                  </div>
                )}

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => navigateTo(publishResult?.url ? new URL(publishResult.url).pathname : '/')}
                    className="inline-flex items-center gap-1.5 text-cyan-400 hover:text-cyan-300 text-sm font-semibold"
                  >
                    <ExternalLink className="w-4 h-4" /> 미리보기
                  </button>
                  {publishResult?.rhwpUrl && (
                    <button
                      onClick={() => navigateTo(new URL(publishResult.rhwpUrl).pathname)}
                      className="inline-flex items-center gap-1.5 text-green-400 hover:text-green-300 text-sm font-semibold"
                    >
                      <Edit3 className="w-4 h-4" /> rhwp 에디터
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setContent('');
                      setCurrentFile(null);
                      setTitle('');
                      setPassword('');
                      setUploadStatus('idle');
                      setPublishResult(null);
                    }}
                    className="text-gray-400 hover:text-gray-300 text-sm"
                  >
                    새로 만들기
                  </button>
                </div>
              </div>
            )}

            {uploadStatus === 'error' && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-center">
                <p className="text-red-400 text-sm">업로드에 실패했습니다. 다시 시도해주세요.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <p className="text-gray-600 text-xs mt-8">htmldrop clone · 파일은 {ttlDays}일 후 자동 삭제됩니다</p>
    </div>
  );
}

export default App;
