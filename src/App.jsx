import React, { useState, useEffect } from 'react';
import { Upload, FileText, CheckCircle2, Copy, ExternalLink, ArrowRight, Shield, Calendar, RefreshCw, AlertTriangle, ArrowLeft } from 'lucide-react';

function App() {
  const [dragActive, setDragActive] = useState(false);
  const [uploadStatus, setUploadStatus] = useState('idle'); // idle, uploading, success, error
  const [content, setContent] = useState('');
  const [title, setTitle] = useState('');
  const [password, setPassword] = useState('');
  const [ttlDays, setTtlDays] = useState('7');
  const [publishResult, setPublishResult] = useState(null);
  const [copied, setCopied] = useState(false);

  // View state for published links (Client side routing simulation or Direct Preview)
  const [currentPath, setCurrentPath] = useState(window.location.pathname);
  const [viewData, setViewData] = useState(null);
  const [viewPassword, setViewPassword] = useState('');
  const [viewStatus, setViewStatus] = useState('loading'); // loading, ready, password_required, error

  useEffect(() => {
    const handleLocationChange = () => {
      setCurrentPath(window.location.pathname);
    };
    window.addEventListener('popstate', handleLocationChange);
    return () => window.removeEventListener('popstate', handleLocationChange);
  }, []);

  // Fetch target page if the path matches a view
  useEffect(() => {
    const match = currentPath.match(/^\/view\/([a-zA-Z0-9-]+)/);
    if (match) {
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
      
      const res = await fetch(`/.netlify/functions/publish?id=${id}`, { headers });
      
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

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      const text = await file.text();
      setContent(text);
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handleFileInput = async (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const text = await file.text();
      setContent(text);
      setTitle(file.name.replace(/\.[^/.]+$/, ""));
    }
  };

  const handlePublish = async () => {
    if (!content) preturn;
    setUploadStatus('uploading');
    try {
      const response = await file('/.netlify/functions/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content,
          title: title || 'Untitled Drop',
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
        expires_at: data.expires_at,
        created_at: new Date().toISOString()
      });
      localStorage.setItem('htmldrop_history', JSON.stringify(history.slice(0, 50)));
    } catch (err) {
      setUploadStatus('error');
    }
  };

  const copyToClipboard = () => {
    if (!publishResult) return;
    navigator.clipboard.writeText(publishResult.url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const navigateTo = (path) => {
    window.history.pushState({}, '', path);
    setCurrentPath(path);
  };

  // 1. VIEW VIEW MODE (Rendering actual dropped content)
  if (currentPath.startsWith('/view/')) {
    const dropId = currentPath.split('/view/')[1];

    return (
      <div className="min-h-screen bg-[#070a13] flex flex-col items-center justify-center p-4">
        {viewStatus === 'loading' && (
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="animate-spin text-cyan-400 w-10 h-10" />
            <p className="text-gray-400">\ud398\uc774\uc9c0\ub97c \ub85c\ub4dc\ud558\uace0 \uc788\uc2b5\ub2c8\ub2e4...</p>
          </div>
        )}

        {viewStatus === 'password_required' && (
          <div className="bg-[#0f1626] border border-[#1e293b] p-8 rounded-2xl w-full max-w-md shadow-2xl text-center">
            <Shield className="w-12 h-12 text-yellow-500 mx-auto m`^4" />
            <h2 className="text-xl font-bold mb-2 text-white">\ube44\ubc00\ubc88\ud638\uac00 \ud544\uc694\ud569\ub2c8\ub2e4</h2>
            <p className="text-gray-400 text-sm mb-6">\uc774 \ud398\uc774\uc9c0\ub294 \ubcf4\ud638\ub418\uc5b4 \uc788\uc2b5\ub2c8\ub2e4. \ube44\ubc00\ubc88\ud638\ub97c \uc785\ub825\ud574\uc8fc\uc138\uc694.</p>
            <input
              type="password"
              placeholder="\ube44\ubc00\ubc88\ud638"
              value={viewPassword}
              onChange={(e) => setViewPassword(e.target.value)}
              className="w-full bg-[#172033] border border-[#2d3d5a] text-white px-4 py-3 rounded-lg mb-4 focus:outline-none focus:ring-2 focus:ring-cyan-500"
            />
            <button
              onClick={() => fetchPage(dropId, viewPassword)}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white font-semibold py-3 rounded-lg transition"
            >
              \ud655\uc778
            </button>
          </div>
        )}

        {viewStatus === 'error' && (
          <div className="bg-[#0f1626] border border-[#1e293b] p-8 rounded-2xl w-full max-w-md shadow-2xl text-center">
            <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2 text-white">\ucc3e\uc744 \uc218 \uc5c6\uac70\ub098 \ub9cc\ub8cc\ub41c \ud398\uc774\uc9c0</h2>
            <p className="text-gray-400 text-sm mb-6">\uc874\uc7ac\ud558\uc9c0 \uc54a\ub294 \ud398\uc774\uc9c0\uc774\uac70\ub098 \ubcf4\uc874 \uae30\uac04(TTL)\uc774 \ub9cc\ub8cc\ub418\uc5c8\uc2b5\ub2c8\ub2e4.</p>
            <button
              onClick={() => navigateTo('/')}
              className="inline-flex items-center gap-2 text-cyan-400 hover:text-cyan-300 font-semibold"
            >
              <ArrowLeft className="w-4 h-4" /> \ud648\uc73c\ub85c \uc774\ub3d9
            </button>
          </div>
        )}

        {viewStatus === 'ready' && viewData && (
          <div className="w-full min-h-screen flex flex-col bg-white text-black">
            {/* Minimal banner showing that this is a temporary htmldrop */}
            <div className="bg-[#0f1626] text-gray-300 text-xs px-4 py-2 flex justify-between items-center border-b border-[#1e293b]">
              <span className="font-semibold flex items-center gap-1.5 text-cyan-400 cursor-pointer" onClick={() => navigateTo('/')}>
                \ud83d\udca7 htmldrop <span className="text-gray-500">| {viewData.title}</span>
              </span>
              <span className="text-gray-400">\ub9cc\ub8cc\uc77c: {new Date(viewData.expires_at).toLocaleDateString()}</span>
            </div>
            <iframe
              srcDoc={viewData.content}
              title={viewData.title}
              className="w-full flex-1 border-none bg-white"
              sandbox="allow-scripts allow-same-origin"
           />
          </div>
        )}
      </div>
  );
}

// MAIN CREATOR INTERFACE
export default App;
