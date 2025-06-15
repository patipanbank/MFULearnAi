import { Link, useLocation } from 'react-router-dom';

const navItems = [
  { href: '/', label: 'Dashboard', emoji: '🏠' },
  { href: '/chat', label: 'Chat', emoji: '💬' },
  { href: '/models', label: 'Models', emoji: '🧠' },
  { href: '/collections', label: 'Collections', emoji: '📚' },
  { href: '/departments', label: 'Departments', emoji: '🏢' },
  { href: '/admins', label: 'Admins', emoji: '🛡️' },
  { href: '/system-prompt', label: 'System Prompt', emoji: '⚙️' },
  { href: '/statistics', label: 'Statistics', emoji: '📊' },
  { href: '/help', label: 'Help', emoji: '❓' },
  { href: '/login', label: 'Login', emoji: '🔑' },
];

export default function Sidebar() {
  const location = useLocation();
  const pathname = location.pathname;
  return (
    <aside className="w-60 h-screen bg-white border-r flex flex-col py-6 px-4 shadow-sm
      hidden sm:flex fixed sm:static z-40">
      <div className="mb-8 text-2xl font-bold text-center">MFULearnAi</div>
      <nav className="flex flex-col gap-2">
        {navItems.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            className={`flex items-center gap-2 px-3 py-2 rounded transition-colors font-medium text-gray-700 hover:bg-gray-100 hover:text-blue-600 ${
              pathname === item.href ? 'bg-blue-100 text-blue-700' : ''
            }`}
          >
            <span>{item.emoji}</span>
            {item.label}
          </Link>
        ))}
      </nav>
    </aside>
  );
} 