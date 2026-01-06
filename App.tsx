
import React, { useState, useEffect, useRef } from 'react';
import Canvas from './components/Canvas';
import ChatInterface from './components/ChatInterface';
import { GeometryData, ChatMessage, Project } from './types';
import { generateGeometry } from './services/geminiService';
import { 
  Menu, Plus, Calculator, X, 
  Triangle, MessageSquare, Minimize2, Trash2
} from 'lucide-react';

const DEFAULT_WELCOME_MSG: ChatMessage = {
  id: 'welcome',
  role: 'model',
  text: 'Chào em! Thầy là trợ lý Toán học. Em cần giúp gì về hình học không?',
  timestamp: Date.now()
};

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>(() => {
     try {
       const saved = localStorage.getItem('hinh-hoc-ai-projects');
       return saved ? JSON.parse(saved) : [];
     } catch (e) {
       return [];
     }
  });
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  // UI State
  const [isLoading, setIsLoading] = useState(false);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false); 
  
  // Position State
  const [bubblePos, setBubblePos] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 80 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartPos = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Compact Constants
  const CHAT_WIDTH = window.innerWidth < 768 ? 280 : 340;
  const CHAT_HEIGHT = 420;
  const BUBBLE_SIZE = 56;
  const MARGIN = 12;

  useEffect(() => {
    if (projects.length === 0) {
      createProject("Bài toán mới");
    } else if (!currentProjectId) {
      const mostRecent = [...projects].sort((a,b) => b.lastModified - a.lastModified)[0];
      setCurrentProjectId(mostRecent.id);
    }
    if (window.innerWidth > 1024) setIsSidebarOpen(true);
    adjustToWindowSize();
    window.addEventListener('resize', adjustToWindowSize);
    return () => window.removeEventListener('resize', adjustToWindowSize);
  }, []);

  const adjustToWindowSize = () => {
    setBubblePos(prev => ({
      x: Math.min(prev.x, window.innerWidth - BUBBLE_SIZE - MARGIN),
      y: Math.min(prev.y, window.innerHeight - BUBBLE_SIZE - MARGIN)
    }));
  };

  useEffect(() => {
    localStorage.setItem('hinh-hoc-ai-projects', JSON.stringify(projects));
  }, [projects]);

  const activeProject = projects.find(p => p.id === currentProjectId);
  const messages = activeProject?.messages || [DEFAULT_WELCOME_MSG];
  const geometryData = activeProject?.geometryData || null;
  const currentStepIndex = activeProject?.currentStepIndex || 0;

  const updateActiveProject = (updates: Partial<Project>) => {
    setProjects(prev => prev.map(p => 
      p.id === currentProjectId ? { ...p, ...updates, lastModified: Date.now() } : p
    ));
  };

  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    if ('button' in e && e.button !== 0) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    dragStartPos.current = { x: clientX - bubblePos.x, y: clientY - bubblePos.y };
    setIsDragging(true);
    hasMovedRef.current = false;
  };

  const handleDragMove = (e: MouseEvent | TouchEvent) => {
    if (!isDragging) return;
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
    
    let newX = clientX - dragStartPos.current.x;
    let newY = clientY - dragStartPos.current.y;

    if (Math.abs(newX - bubblePos.x) > 3 || Math.abs(newY - bubblePos.y) > 3) {
      hasMovedRef.current = true;
    }

    const minX = isChatOpen ? (CHAT_WIDTH - BUBBLE_SIZE + MARGIN) : MARGIN;
    const maxX = window.innerWidth - BUBBLE_SIZE - MARGIN;
    const minY = isChatOpen ? (CHAT_HEIGHT + MARGIN * 2) : MARGIN;
    const maxY = window.innerHeight - BUBBLE_SIZE - MARGIN;

    newX = Math.max(minX, Math.min(maxX, newX));
    newY = Math.max(minY, Math.min(maxY, newY));

    setBubblePos({ x: newX, y: newY });
  };

  const handleDragEnd = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleDragMove);
      window.addEventListener('mouseup', handleDragEnd);
      window.addEventListener('touchmove', handleDragMove);
      window.addEventListener('touchend', handleDragEnd);
    }
    return () => {
      window.removeEventListener('mousemove', handleDragMove);
      window.removeEventListener('mouseup', handleDragEnd);
      window.removeEventListener('touchmove', handleDragMove);
      window.removeEventListener('touchend', handleDragEnd);
    };
  }, [isDragging, isChatOpen]);

  const createProject = (nameInput?: string) => {
    const name = nameInput || `Bài toán ${projects.length + 1}`;
    const newProj: Project = {
      id: Date.now().toString(),
      name: name,
      subjectId: 'math', 
      messages: [{ ...DEFAULT_WELCOME_MSG, timestamp: Date.now() }],
      geometryData: null,
      currentStepIndex: 0,
      lastModified: Date.now()
    };
    setProjects(prev => [newProj, ...prev]);
    setCurrentProjectId(newProj.id);
  };

  const deleteProject = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (window.confirm("Xóa bài toán này?")) {
      const newProjects = projects.filter(p => p.id !== id);
      setProjects(newProjects);
      if (currentProjectId === id && newProjects.length > 0) setCurrentProjectId(newProjects[0].id);
    }
  };

  const handleSendMessage = async (text: string, image?: string) => {
    if (!currentProjectId) return;
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', text, timestamp: Date.now() };
    const updatedMessages = [...messages, userMsg];
    updateActiveProject({ messages: updatedMessages });
    setIsLoading(true);

    try {
      const data = await generateGeometry(text, messages.map(m=>m.text).join('\n'), image);
      const aiMsg: ChatMessage = { id: (Date.now()+1).toString(), role: 'model', text: data.message || "Xong!", timestamp: Date.now() };
      updateActiveProject({ messages: [...updatedMessages, aiMsg], geometryData: data, currentStepIndex: 0 });
    } catch (error) {
      updateActiveProject({ messages: [...updatedMessages, { id: Date.now().toString(), role: 'model', text: "Lỗi rồi em ạ.", timestamp: Date.now() }] });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex bg-slate-100 overflow-hidden font-sans">
      
      {/* Sidebar Navigation */}
      <div className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out md:relative md:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} flex flex-col shadow-xl md:shadow-none`}>
          <div className="p-4 border-b flex items-center justify-between bg-blue-50/30">
            <h1 className="text-lg font-bold text-blue-900 flex items-center gap-2">
              <Calculator size={20} className="text-blue-600" /> Toán THCS
            </h1>
            <button onClick={() => setIsSidebarOpen(false)} className="md:hidden text-slate-400"><X size={20} /></button>
          </div>

          <div className="p-3">
            <button onClick={() => createProject()} className="w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-md flex items-center justify-center gap-2 transition-all text-sm font-bold active:scale-95"><Plus size={16} /> Bài toán mới</button>
          </div>

          <div className="flex-1 overflow-y-auto px-2 space-y-1 scrollbar-hide">
            {projects.map((proj) => (
              <div
                key={proj.id}
                onClick={() => { setCurrentProjectId(proj.id); if (window.innerWidth < 768) setIsSidebarOpen(false); }}
                className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer border transition-all ${currentProjectId === proj.id ? 'bg-blue-50 border-blue-100' : 'hover:bg-slate-50 border-transparent'}`}
              >
                <Triangle size={14} className={currentProjectId === proj.id ? 'text-blue-600' : 'text-slate-400'} />
                <div className="flex-1 min-w-0">
                  <div className={`text-sm truncate ${currentProjectId === proj.id ? 'font-bold text-blue-900' : 'text-slate-600'}`}>{proj.name}</div>
                </div>
                <button onClick={(e) => deleteProject(proj.id, e)} className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-red-500 transition-opacity"><Trash2 size={12}/></button>
              </div>
            ))}
          </div>
      </div>

      {isSidebarOpen && <div className="fixed inset-0 bg-black/10 z-30 md:hidden backdrop-blur-[2px]" onClick={() => setIsSidebarOpen(false)} />}

      {/* Canvas Area */}
      <div className="flex-1 h-full relative z-0">
        <div className="absolute top-3 left-3 z-10 md:hidden">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 bg-white rounded-full shadow-md border border-slate-200 text-slate-600 active:scale-95"><Menu size={20} /></button>
        </div>

        <Canvas 
          key={currentProjectId}
          data={geometryData} 
          currentStepIndex={currentStepIndex}
          onDataUpdate={(newData) => updateActiveProject({ geometryData: newData })}
          onSpeak={(t) => { if(isVoiceEnabled) { window.speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(t); u.lang='vi-VN'; window.speechSynthesis.speak(u); } }}
        />

        {/* Floating Mini AI Assistant Container */}
        <div 
          className={`fixed z-50 flex flex-col items-end pointer-events-none transition-opacity ${isDragging ? 'opacity-80' : 'opacity-100'}`}
          style={{ 
            left: bubblePos.x, 
            top: bubblePos.y,
            transform: 'translateY(-100%)' 
          }}
        >
          {/* Compact Chat Window */}
          {isChatOpen && (
            <div 
              className="mb-3 bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in slide-in-from-bottom-5 pointer-events-auto origin-bottom-right"
              style={{ width: CHAT_WIDTH, height: CHAT_HEIGHT }}
            >
              {/* Compact Header */}
              <div 
                className="p-3 border-b bg-blue-600 text-white flex items-center justify-between cursor-move select-none"
                onMouseDown={handleDragStart}
                onTouchStart={handleDragStart}
              >
                <div className="flex items-center gap-2 font-bold text-sm pointer-events-none">
                  <MessageSquare size={16}/>
                  Gia sư AI
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setIsChatOpen(false); }} 
                  className="p-1 hover:bg-white/20 rounded-md transition-colors"
                >
                  <Minimize2 size={16}/>
                </button>
              </div>
              
              <div className="flex-1 overflow-hidden">
                <ChatInterface 
                  key={currentProjectId}
                  messages={messages}
                  onSendMessage={handleSendMessage}
                  isLoading={isLoading}
                  isVoiceEnabled={isVoiceEnabled}
                  toggleVoice={() => setIsVoiceEnabled(!isVoiceEnabled)}
                  geometryData={geometryData}
                  currentStepIndex={currentStepIndex}
                  setCurrentStepIndex={(idx) => updateActiveProject({ currentStepIndex: idx })}
                />
              </div>
            </div>
          )}

          {/* Assistant Bubble */}
          <div 
            className={`
              w-14 h-14 rounded-full shadow-xl flex items-center justify-center cursor-pointer pointer-events-auto transition-all active:scale-90
              transform translate-y-full
              ${isChatOpen ? 'bg-white border-2 border-blue-600 scale-90 opacity-40 hover:opacity-100' : 'bg-blue-600 hover:scale-105'}
            `}
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            onClick={(e) => { if (!hasMovedRef.current) setIsChatOpen(!isChatOpen); }}
          >
            {isChatOpen ? <X size={20} className="text-blue-600" /> : <div className="text-xl animate-bounce-subtle">🤖</div>}
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes bounce-subtle {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-3px); }
        }
        .animate-bounce-subtle {
          animation: bounce-subtle 3s infinite ease-in-out;
        }
      `}</style>
    </div>
  );
};

export default App;
