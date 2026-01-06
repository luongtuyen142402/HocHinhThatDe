
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, GeometryData } from '../types';
import { Send, MessageSquare, X, BrainCircuit, Lightbulb, Camera, Image as ImageIcon } from 'lucide-react';

interface ChatInterfaceProps {
  messages: ChatMessage[];
  onSendMessage: (text: string, image?: string) => void;
  isLoading: boolean;
  isVoiceEnabled: boolean;
  toggleVoice: () => void;
  geometryData: GeometryData | null;
  currentStepIndex: number;
  setCurrentStepIndex: (index: number) => void;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({
  messages,
  onSendMessage,
  isLoading,
  geometryData,
}) => {
  const [input, setInput] = useState("");
  const [activeTab, setActiveTab] = useState<'chat' | 'solution' | 'reasoning'>('chat');
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (activeTab === 'chat') {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, activeTab]);

  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (let i = 0; i < items.length; i++) {
      if (items[i].type.indexOf('image') !== -1) {
        const blob = items[i].getAsFile();
        if (blob) {
          const reader = new FileReader();
          reader.onload = (event) => setSelectedImage(event.target?.result as string);
          reader.readAsDataURL(blob);
        }
      }
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setSelectedImage(reader.result as string);
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const handleSend = () => {
    if (!input.trim() && !selectedImage) return;
    onSendMessage(input.trim(), selectedImage || undefined);
    setInput("");
    setSelectedImage(null);
  };

  useEffect(() => {
    if (geometryData?.reasoning?.length) setActiveTab('reasoning');
    else if (geometryData?.mathSolution) setActiveTab('solution');
  }, [geometryData]);

  return (
    <div className="flex flex-col h-full bg-white text-slate-800" onPaste={handlePaste}>
      {/* Tiny Tabs */}
      <div className="flex border-b border-slate-100 bg-slate-50">
        <button onClick={() => setActiveTab('chat')} className={`flex-1 py-1.5 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${activeTab === 'chat' ? 'text-blue-600 bg-white border-b-2 border-blue-600' : 'text-slate-400'}`}><MessageSquare size={12}/> CHAT</button>
        <button onClick={() => setActiveTab('reasoning')} disabled={!geometryData?.reasoning?.length} className={`flex-1 py-1.5 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${activeTab === 'reasoning' ? 'text-amber-600 bg-white border-b-2 border-amber-600' : 'text-slate-300 disabled:opacity-50'}`}><Lightbulb size={12}/> GỢI Ý</button>
        <button onClick={() => setActiveTab('solution')} disabled={!geometryData?.mathSolution} className={`flex-1 py-1.5 text-[10px] font-bold flex items-center justify-center gap-1 transition-colors ${activeTab === 'solution' ? 'text-emerald-600 bg-white border-b-2 border-emerald-600' : 'text-slate-300 disabled:opacity-50'}`}><BrainCircuit size={12}/> GIẢI</button>
      </div>

      <div className="flex-1 overflow-hidden relative flex flex-col">
        {activeTab === 'chat' && (
          <>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-hide bg-slate-50/20">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[90%] rounded-xl p-2.5 text-xs shadow-sm ${msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200'}`}>
                    {msg.text}
                  </div>
                </div>
              ))}
              {isLoading && <div className="text-[10px] text-slate-400 animate-pulse ml-1">Đang xử lý...</div>}
              <div ref={messagesEndRef} />
            </div>

            <div className="p-2 border-t bg-white">
              {selectedImage && (
                <div className="mb-2 relative inline-block">
                  <img src={selectedImage} alt="Preview" className="h-14 rounded-md border object-cover" />
                  <button onClick={() => setSelectedImage(null)} className="absolute -top-1.5 -right-1.5 bg-red-500 text-white rounded-full p-0.5 shadow-md"><X size={10} /></button>
                </div>
              )}
              
              <div className="flex items-center gap-1.5">
                <button onClick={() => cameraInputRef.current?.click()} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"><Camera size={18}/></button>
                <input type="file" ref={cameraInputRef} className="hidden" accept="image/*" capture="environment" onChange={handleFileSelect} />
                
                <button onClick={() => fileInputRef.current?.click()} className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors"><ImageIcon size={18}/></button>
                <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleFileSelect} />

                <input 
                  type="text" 
                  value={input} 
                  onChange={(e) => setInput(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
                  placeholder="Nhập câu hỏi..." 
                  className="flex-1 px-3 py-1.5 text-xs rounded-lg border border-slate-200 bg-slate-50 outline-none focus:border-blue-400"
                  disabled={isLoading}
                />

                <button onClick={handleSend} disabled={isLoading || (!input.trim() && !selectedImage)} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-30 transition-all active:scale-90">
                   <Send size={16} />
                </button>
              </div>
            </div>
          </>
        )}

        {activeTab === 'reasoning' && (
          <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-slate-50">
            {geometryData?.reasoning?.map((step, idx) => (
              <div key={idx} className="p-2 bg-white rounded-lg border border-slate-100 shadow-sm">
                <div className="text-[9px] font-bold text-amber-600 mb-0.5 uppercase">Bước {idx+1}</div>
                <div className="text-xs font-semibold text-slate-700 leading-tight">{step.question}</div>
                <div className="text-[10px] text-slate-500 mt-1 bg-amber-50/50 p-1 rounded">💡 {step.answer}</div>
              </div>
            ))}
          </div>
        )}

        {activeTab === 'solution' && (
          <div className="flex-1 overflow-y-auto p-3 bg-slate-50">
            <div className="bg-white rounded-lg p-3 border shadow-sm text-xs leading-relaxed text-slate-700 whitespace-pre-line">
              {geometryData?.mathSolution}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatInterface;
