import React, { useState, useRef } from 'react';
import RoleGuard from '@/components/guards/RoleGuard';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: 'Welcome! How can I help you today?'
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now() + '', role: 'user', content: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput('');
    setLoading(true);
    // Simulate assistant reply (replace with API/WebSocket call)
    setTimeout(() => {
      setMessages((msgs) => [...msgs, {
        id: Date.now() + 'a',
        role: 'assistant',
        content: `Echo: ${userMsg.content}`
      }]);
      setLoading(false);
    }, 1000);
    inputRef.current?.focus();
  };

  return (
    <RoleGuard allowed={['Students', 'Staffs', 'Admin', 'SuperAdmin']}>
      <div className="max-w-2xl mx-auto flex flex-col h-[80vh] border rounded shadow bg-white">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`max-w-[80%] px-4 py-2 rounded-lg text-sm ${
                msg.role === 'user'
                  ? 'ml-auto bg-blue-100 text-blue-900'
                  : 'mr-auto bg-gray-100 text-gray-800'
              }`}
            >
              {msg.content}
            </div>
          ))}
          {loading && (
            <div className="mr-auto bg-gray-100 text-gray-400 px-4 py-2 rounded-lg text-sm animate-pulse">
              ...
            </div>
          )}
        </div>
        <form onSubmit={handleSend} className="flex gap-2 p-4 border-t">
          <input
            ref={inputRef}
            className="flex-1 border rounded px-3 py-2"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message..."
            disabled={loading}
            autoFocus
          />
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50"
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </RoleGuard>
  );
} 