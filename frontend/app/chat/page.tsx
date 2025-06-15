import React, { useState, useRef, useEffect } from 'react';
import RoleGuard from '../../src/components/guards/RoleGuard';
import { useAuth } from '../../src/context/AuthContext';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp?: string | Date;
  isComplete?: boolean;
}

const WS_URL = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:5001/ws';

function useChatWebSocket({ token, chatId, onMessage, onError, onChatCreated }: {
  token: string;
  chatId?: string;
  onMessage: (msg: Message, type: string) => void;
  onError: (err: string) => void;
  onChatCreated: (chatId: string) => void;
}) {
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    let url = `${WS_URL}?token=${token}`;
    if (chatId) url += `&chat=${chatId}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'content') {
          onMessage({ id: Date.now() + '', role: 'assistant', content: data.content }, 'content');
        } else if (data.type === 'complete') {
          onMessage({ id: Date.now() + '', role: 'assistant', content: '', isComplete: true }, 'complete');
        } else if (data.type === 'chat_created') {
          onChatCreated(data.chatId);
        } else if (data.type === 'error') {
          onError(data.error || 'Unknown error');
        }
      } catch (e) {
        onError('Invalid message from server');
      }
    };
    ws.onerror = () => onError('WebSocket error');
    ws.onclose = () => {};
    return () => { ws.close(); };
  }, [token, chatId]);

  const send = (payload: any) => {
    wsRef.current?.send(JSON.stringify(payload));
  };

  return { send };
}

export default function ChatPage() {
  const { token } = useAuth();
  const [messages, setMessages] = useState<Message[]>([{
    id: 'welcome',
    role: 'assistant',
    content: 'Welcome! How can I help you today?'
  }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [chatId, setChatId] = useState<string | undefined>(undefined);
  const inputRef = useRef<HTMLInputElement>(null);

  const { send } = useChatWebSocket({
    token: token || '',
    chatId,
    onMessage: (msg, type) => {
      if (type === 'content') {
        setMessages((msgs) => {
          // Stream content: append or update last assistant message
          if (msgs[msgs.length - 1]?.role === 'assistant' && !msgs[msgs.length - 1]?.isComplete) {
            const last = msgs[msgs.length - 1];
            return [...msgs.slice(0, -1), { ...last, content: last.content + msg.content }];
          } else {
            return [...msgs, { ...msg, content: msg.content }];
          }
        });
      } else if (type === 'complete') {
        setMessages((msgs) => {
          if (msgs[msgs.length - 1]?.role === 'assistant') {
            return msgs.map((m, i) => i === msgs.length - 1 ? { ...m, isComplete: true } : m);
          }
          return msgs;
        });
        setLoading(false);
      }
    },
    onError: (err) => {
      setError(err);
      setLoading(false);
    },
    onChatCreated: (id) => {
      setChatId(id);
    }
  });

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !token) return;
    const userMsg: Message = { id: Date.now() + '', role: 'user', content: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);
    send({
      messages: [...messages, userMsg],
      modelId: 'default', // TODO: allow user to select model
      chatId,
    });
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
          {error && (
            <div className="text-red-500 text-xs mt-2">{error}</div>
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