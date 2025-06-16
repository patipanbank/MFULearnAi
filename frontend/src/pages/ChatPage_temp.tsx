const ChatPage = () => {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4">
        {/* Chat messages will go here */}
        <div className="flex items-start gap-4 mb-4">
          <div className="w-10 h-10 rounded-full bg-gray-500"></div>
          <div className="bg-white p-3 rounded-lg shadow">
            <p>Hello! How can I help you today?</p>
          </div>
        </div>
        <div className="flex items-start gap-4 mb-4 flex-row-reverse">
          <div className="w-10 h-10 rounded-full bg-blue-500"></div>
          <div className="bg-blue-100 p-3 rounded-lg shadow">
            <p>I have a question about the university.</p>
          </div>
        </div>
      </div>
      <div className="p-4 bg-white border-t">
        <div className="flex items-center gap-4">
          <input type="text" placeholder="Type your message..." className="flex-1 p-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
          <button className="bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600">Send</button>
        </div>
      </div>
    </div>
  )
}

export default ChatPage; 