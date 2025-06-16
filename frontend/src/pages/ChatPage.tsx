import { useState, useEffect, useRef } from "react";
import useChatStore from "../store/chatStore";
import { chatService } from "../services/chatService";
import { FiSend, FiUser, FiGitlab } from "react-icons/fi";

const ChatPage = () => {
  const { messages, addMessage, isLoading, setLoading } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSendMessage = async () => {
    if (inputValue.trim() === '') return;

    const userMessage = {
      id: Date.now().toString(),
      text: inputValue,
      sender: 'user' as const,
      timestamp: new Date(),
    };
    addMessage(userMessage);
    const currentInputValue = inputValue;
    setInputValue('');
    setLoading(true);

    try {
      const botMessage = await chatService.sendMessage(currentInputValue);
      addMessage(botMessage);
    } catch (error) {
      console.error("Failed to send message:", error);
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: 'Sorry, I encountered an error. Please try again.',
        sender: 'bot' as const,
        timestamp: new Date(),
      };
      addMessage(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-100 dark:bg-gray-900 rounded-lg shadow-md">
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-6 space-y-6">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-end gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : 'justify-start'}`}>
            <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white ${msg.sender === 'user' ? 'bg-blue-500' : 'bg-gray-500'}`}>
              {msg.sender === 'user' ? <FiUser size={20} /> : <FiGitlab size={20} />}
            </div>
            <div className={`p-3 rounded-lg shadow-md max-w-lg ${msg.sender === 'user' ? 'bg-blue-100 dark:bg-blue-800 rounded-br-none' : 'bg-white dark:bg-gray-700 rounded-bl-none'}`}>
              <p className="text-gray-800 dark:text-gray-200">{msg.text}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 text-right">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-end gap-3 justify-start">
             <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-white bg-gray-500">
              <FiGitlab size={20} />
            </div>
            <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow-md rounded-bl-none flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse mr-2"></span>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-75 mr-2"></span>
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse delay-150"></span>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
        <div className="flex items-center gap-3">
          <input 
            type="text" 
            placeholder="Type your message..." 
            className="flex-1 p-3 border-2 border-transparent rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white transition"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
          />
          <button 
            className="bg-blue-500 text-white p-3 rounded-lg hover:bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center"
            onClick={handleSendMessage}
            disabled={isLoading || !inputValue.trim()}
          >
            <FiSend size={20} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatPage; 