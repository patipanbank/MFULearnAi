const Sidebar = () => {
  return (
    <div className="w-64 bg-white dark:bg-gray-800 shadow-md">
      <div className="p-4 text-2xl font-bold text-gray-800 dark:text-white">
        MFULearnAI
      </div>
      <nav className="mt-5">
        <a href="/" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">Home</a>
        <a href="/chat" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">Chat</a>
        <a href="/admin" className="block py-2.5 px-4 rounded transition duration-200 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200">Admin</a>
      </nav>
    </div>
  )
}

export default Sidebar; 