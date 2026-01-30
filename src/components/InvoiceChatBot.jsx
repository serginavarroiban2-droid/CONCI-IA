import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, Send, X, Loader2, Bot, User } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = (supabaseUrl && supabaseAnonKey)
    ? createClient(supabaseUrl, supabaseAnonKey)
    : null;

export default function InvoiceChatBot() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', content: 'Hola! Soc el teu assistent de factures. En què et puc ajudar avui? Per exemple, em pots preguntar: "Quin és el preu del formatge de l\'última factura de Guissona?"' }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async () => {
        const queryText = input.trim();
        if (!queryText || loading || !supabase) return;

        const userMessage = { role: 'user', content: queryText };
        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setLoading(true);

        try {
            const { data, error } = await supabase.functions.invoke('chat-invoices', {
                body: { query: queryText }
            });

            if (error) {
                console.error('Invoke Error:', error);
                throw error;
            }

            const assistantMessage = { role: 'assistant', content: data.answer || "Ho sento, no he pogut generar una resposta." };
            setMessages(prev => [...prev, assistantMessage]);
        } catch (err) {
            console.error('Chat Error Detail:', err);
            const errorMessage = err.message || "Error desconegut";
            setMessages(prev => [...prev, { role: 'assistant', content: `Ho sento, s'ha produït un error de sistema: ${errorMessage}. Torna-ho a provar.` }]);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="mb-4 w-80 sm:w-96 bg-slate-800 rounded-2xl shadow-2xl border border-slate-700 flex flex-col overflow-hidden animate-in slide-in-from-bottom-5 duration-300">
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white flex justify-between items-center shadow-md">
                        <div className="flex items-center gap-2">
                            <Bot className="w-5 h-5" />
                            <h3 className="font-bold text-sm tracking-wide">Assistent de Factures</h3>
                        </div>
                        <button onClick={() => setIsOpen(false)} className="hover:bg-white/20 p-1 rounded-full transition-colors">
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Messages */}
                    <div className="flex-1 p-4 h-80 overflow-y-auto flex flex-col gap-4 bg-slate-900/50">
                        {messages.map((msg, i) => (
                            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                <div className={`flex gap-2 max-w-[85%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${msg.role === 'user' ? 'bg-indigo-600' : 'bg-slate-700'}`}>
                                        {msg.role === 'user' ? <User className="w-4 h-4 text-white" /> : <Bot className="w-4 h-4 text-indigo-400" />}
                                    </div>
                                    <div className={`p-3 rounded-2xl text-sm shadow-sm ${msg.role === 'user'
                                        ? 'bg-indigo-600 text-white rounded-tr-none'
                                        : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-tl-none'
                                        }`}>
                                        {msg.content}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="flex gap-2 items-center bg-slate-800 p-3 rounded-2xl rounded-tl-none border border-slate-700 shadow-sm">
                                    <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
                                    <span className="text-xs text-slate-400">Analitzant factures...</span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input */}
                    <div className="p-4 bg-slate-800 border-t border-slate-700">
                        <div className="relative">
                            <input
                                type="text"
                                value={input}
                                onChange={e => setInput(e.target.value)}
                                onKeyDown={e => e.key === 'Enter' && handleSend()}
                                placeholder="Pregunta alguna cosa..."
                                className="w-full bg-slate-900 text-slate-200 text-sm pl-4 pr-10 py-3 rounded-xl border border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all placeholder-slate-500"
                            />
                            <button
                                onClick={handleSend}
                                disabled={!input.trim() || loading}
                                className={`absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-all ${!input.trim() || loading ? 'text-slate-600' : 'text-indigo-400 hover:bg-indigo-500/10'
                                    }`}
                            >
                                <Send className="w-4 h-4" />
                            </button>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-2 text-center uppercase tracking-widest font-bold opacity-50">Empoderat per Gemini 2.0</p>
                    </div>
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`p-4 rounded-full shadow-2xl transition-all duration-300 transform hover:scale-110 active:scale-95 ${isOpen ? 'bg-slate-700 text-white rotate-90' : 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white'
                    }`}
            >
                {isOpen ? <X className="w-6 h-6" /> : <MessageSquare className="w-6 h-6" />}
            </button>
        </div>
    );
}
