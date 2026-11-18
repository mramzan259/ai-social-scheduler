'use client';

import { useState, useEffect } from 'react';

interface Post {
  id: string;
  caption: string;
  scheduledTime: string;
  platform: string;
  email: string;
  createdAt: string;
  driveFileId?: string;
}

export default function Home() {
  const [prompt, setPrompt] = useState('');
  const [captions, setCaptions] = useState<string[]>([]);
  const [selectedCaption, setSelectedCaption] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [platform, setPlatform] = useState('Instagram');
  const [email, setEmail] = useState('');
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem('ai-social-posts');
    if (saved) setPosts(JSON.parse(saved));
  }, []);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const generateCaptions = async () => {
    if (!prompt.trim()) return showToast('Enter a prompt first!', 'error');
    setLoading(true);
    setCaptions([]);
    setSelectedCaption('');
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, platform }),
      });
      const data = await res.json();
      if (data.captions) setCaptions(data.captions);
      else showToast(data.error || 'Generation failed', 'error');
    } catch {
      showToast('API error!', 'error');
    }
    setLoading(false);
  };

  const savePost = async () => {
    if (!selectedCaption) return showToast('Select a caption first!', 'error');
    if (!scheduledTime) return showToast('Pick a scheduled time!', 'error');
    if (!email) return showToast('Enter your email!', 'error');
    setSaving(true);
    try {
      const res = await fetch('/api/save-drive', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caption: selectedCaption, scheduledTime, platform, email }),
      });
      const data = await res.json();
      const newPost: Post = {
        id: Date.now().toString(),
        caption: selectedCaption,
        scheduledTime,
        platform,
        email,
        createdAt: new Date().toISOString(),
        driveFileId: data.fileId,
      };
      const updated = [newPost, ...posts];
      setPosts(updated);
      localStorage.setItem('ai-social-posts', JSON.stringify(updated));
      setSelectedCaption('');
      setScheduledTime('');
      showToast('✅ Saved to Drive & email sent!');
    } catch {
      showToast('Save failed!', 'error');
    }
    setSaving(false);
  };

  const deletePost = (id: string) => {
    const updated = posts.filter((p) => p.id !== id);
    setPosts(updated);
    localStorage.setItem('ai-social-posts', JSON.stringify(updated));
    showToast('Post deleted');
  };

  const saveEdit = (id: string) => {
    const updated = posts.map((p) => (p.id === id ? { ...p, caption: editText } : p));
    setPosts(updated);
    localStorage.setItem('ai-social-posts', JSON.stringify(updated));
    setEditingId(null);
    showToast('Post updated');
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-purple-950 via-indigo-900 to-blue-900 text-white p-4 md:p-8">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-xl shadow-2xl font-semibold text-sm transition-all ${toast.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-4xl md:text-5xl font-black bg-gradient-to-r from-pink-400 via-purple-400 to-cyan-400 bg-clip-text text-transparent">
          ✨ AI Social Scheduler
        </h1>
        <p className="text-indigo-300 mt-2 text-lg">Generate · Schedule · Notify</p>
      </div>

      <div className="max-w-5xl mx-auto space-y-8">

        {/* Section 1: Caption Generator */}
        <section className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-xl">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">🤖 AI Caption Generator</h2>
          <div className="flex flex-col md:flex-row gap-3 mb-4">
            <select
              value={platform}
              onChange={(e) => setPlatform(e.target.value)}
              className="bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400 w-full md:w-48"
            >
              {['Instagram', 'Twitter/X', 'LinkedIn', 'Facebook', 'TikTok'].map((p) => (
                <option key={p} value={p} className="text-black">{p}</option>
              ))}
            </select>
            <input
              type="text"
              placeholder="Describe your post... e.g. 'morning coffee vibes'"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && generateCaptions()}
              className="flex-1 bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-purple-400"
            />
            <button
              onClick={generateCaptions}
              disabled={loading}
              className="bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 disabled:opacity-50 rounded-xl px-6 py-3 font-bold transition-all shadow-lg"
            >
              {loading ? '⏳ Generating...' : '⚡ Generate'}
            </button>
          </div>

          {captions.length > 0 && (
            <div className="space-y-3">
              <p className="text-indigo-300 font-semibold">Pick a caption:</p>
              {captions.map((cap, i) => (
                <div
                  key={i}
                  onClick={() => setSelectedCaption(cap)}
                  className={`cursor-pointer rounded-xl p-4 border-2 transition-all ${selectedCaption === cap ? 'border-pink-400 bg-pink-500/20' : 'border-white/20 bg-white/5 hover:bg-white/10'}`}
                >
                  <span className="text-xs text-indigo-300 font-bold mr-2">Option {i + 1}</span>
                  <p className="text-sm mt-1 leading-relaxed">{cap}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Section 2: Scheduler */}
        <section className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-xl">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">📅 Schedule & Save to Drive</h2>
          {selectedCaption && (
            <div className="bg-purple-500/20 border border-purple-400/30 rounded-xl p-3 mb-4 text-sm">
              <span className="text-purple-300 font-semibold">Selected: </span>{selectedCaption.slice(0, 100)}...
            </div>
          )}
          <div className="grid md:grid-cols-3 gap-3">
            <input
              type="datetime-local"
              value={scheduledTime}
              onChange={(e) => setScheduledTime(e.target.value)}
              className="bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-400 col-span-1"
            />
            <input
              type="email"
              placeholder="your@email.com (for notifications)"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-white/20 border border-white/30 rounded-xl px-4 py-3 text-white placeholder-indigo-300 focus:outline-none focus:ring-2 focus:ring-purple-400 col-span-1"
            />
            <button
              onClick={savePost}
              disabled={saving}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:opacity-50 rounded-xl px-6 py-3 font-bold transition-all shadow-lg col-span-1"
            >
              {saving ? '💾 Saving...' : '💾 Save & Notify'}
            </button>
          </div>
        </section>

        {/* Section 3: Feed Preview */}
        <section className="bg-white/10 backdrop-blur-md rounded-3xl p-6 border border-white/20 shadow-xl">
          <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
            📋 Scheduled Posts
            <span className="text-sm font-normal bg-purple-500/30 px-3 py-1 rounded-full">{posts.length} posts</span>
          </h2>
          {posts.length === 0 ? (
            <p className="text-indigo-300 text-center py-8">No posts yet. Generate and schedule one above! 👆</p>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <div key={post.id} className="bg-white/5 border border-white/10 rounded-xl p-4">
                  <div className="flex justify-between items-start gap-3">
                    <div className="flex-1">
                      <div className="flex gap-2 mb-2 flex-wrap">
                        <span className="text-xs bg-purple-500/40 px-2 py-1 rounded-full">{post.platform}</span>
                        <span className="text-xs bg-blue-500/40 px-2 py-1 rounded-full">📅 {new Date(post.scheduledTime).toLocaleString()}</span>
                        <span className="text-xs bg-green-500/40 px-2 py-1 rounded-full">✉️ {post.email}</span>
                        {post.driveFileId && <span className="text-xs bg-yellow-500/40 px-2 py-1 rounded-full">📁 Drive Saved</span>}
                      </div>
                      {editingId === post.id ? (
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full bg-white/20 border border-white/30 rounded-lg p-2 text-sm text-white mt-1 focus:outline-none focus:ring-2 focus:ring-purple-400"
                          rows={3}
                        />
                      ) : (
                        <p className="text-sm text-indigo-100 leading-relaxed">{post.caption}</p>
                      )}
                    </div>
                    <div className="flex flex-col gap-2 shrink-0">
                      {editingId === post.id ? (
                        <>
                          <button onClick={() => saveEdit(post.id)} className="text-xs bg-green-500 hover:bg-green-600 px-3 py-1 rounded-lg font-semibold">Save</button>
                          <button onClick={() => setEditingId(null)} className="text-xs bg-gray-500 hover:bg-gray-600 px-3 py-1 rounded-lg font-semibold">Cancel</button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => { setEditingId(post.id); setEditText(post.caption); }} className="text-xs bg-blue-500 hover:bg-blue-600 px-3 py-1 rounded-lg font-semibold">✏️ Edit</button>
                          <button onClick={() => deletePost(post.id)} className="text-xs bg-red-500 hover:bg-red-600 px-3 py-1 rounded-lg font-semibold">🗑️ Delete</button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      <footer className="text-center mt-10 text-indigo-400 text-sm">
        Built with ❤️ using Next.js + Gemini AI
      </footer>
    </main>
  );
}
