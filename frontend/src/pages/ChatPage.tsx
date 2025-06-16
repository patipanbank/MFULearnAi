import { useState, useEffect, useRef } from "react";
import useChatStore from "../store/chatStore";
import { chatService } from "../services/chatService";

const ChatPage = () => {
  const { messages, addMessage, isLoading, setLoading } = useChatStore();
  const [inputValue, setInputValue] = useState('');
  const chatContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages]);

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
      <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex items-start gap-3 ${msg.sender === 'user' ? 'flex-row-reverse' : ''}`}>
            <div className={`w-10 h-10 rounded-full ${msg.sender === 'user' ? 'bg-blue-500' : 'bg-gray-500'}`}></div>
            <div className={`p-3 rounded-lg shadow max-w-lg ${msg.sender === 'user' ? 'bg-blue-100 dark:bg-blue-800' : 'bg-white dark:bg-gray-700'}`}>
              <p className="text-gray-800 dark:text-gray-200">{msg.text}</p>
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-gray-500"></div>
            <div className="bg-white dark:bg-gray-700 p-3 rounded-lg shadow">
              <p className="text-gray-800 dark:text-gray-200">...</p>
            </div>
          </div>
        )}
      </div>
      <div className="p-4 bg-white dark:bg-gray-800 border-t dark:border-gray-700">
        <div className="flex items-center gap-4">
          <input 
            type="text" 
            placeholder="Type your message..." 
            className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
          />
          <button 
            className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 disabled:bg-blue-300"
            onClick={handleSendMessage}
            disabled={isLoading}
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChatPage; 