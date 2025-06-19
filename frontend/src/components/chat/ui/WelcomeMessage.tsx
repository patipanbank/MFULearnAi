import React from 'react';

const WelcomeMessage: React.FC = () => {
  const examplePrompts = [
    "Explain quantum computing in simple terms",
    "What are the best Thai food dishes to try?",
    "Write a short story about a robot who discovers music",
    "Give me some ideas for a weekend trip near Chiang Rai",
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full text-center text-gray-500 dark:text-gray-400">
      <div className="max-w-md mx-auto">
        <img 
          src="/mfu_logo_chatbot.PNG" 
          alt="Logo" 
          className="w-24 h-24 mx-auto mb-4 rounded-full"
        />
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-200 mb-2">
          Welcome to MFU Learn AI
        </h1>
        <p className="mb-8">
          You can start a conversation here or try one of the examples below.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left">
          {examplePrompts.map((prompt, index) => (
            <div 
              key={index}
              className="p-4 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 cursor-pointer transition-colors"
              onClick={() => {
                // This is a bit of a hack to set the input value in another component
                // A better solution would be to use a shared state management (like Zustand)
                const chatInput = document.querySelector('textarea');
                if (chatInput) {
                  chatInput.value = prompt;
                  // Dispatch an event to notify the input has changed
                  chatInput.dispatchEvent(new Event('input', { bubbles: true }));
                }
              }}
            >
              <p className="font-semibold text-sm text-gray-700 dark:text-gray-300">{prompt}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WelcomeMessage;