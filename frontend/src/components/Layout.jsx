import { Outlet, Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Layout() {
  const { user, logoutUser } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();

  const navItems = [
    { path: '/', label: 'Dashboard', icon: '/assets/dashboard-5-svgrepo-com.svg' },
    { path: '/transactions', label: 'Transactions', icon: '/assets/ecommerce-shop-transaction-svgrepo-com.svg' },
  ];

  const isActive = (path) => location.pathname === path;

  const redFilter = 'invert(36%) sepia(93%) saturate(7471%) hue-rotate(349deg) brightness(91%) contrast(90%)';
  const grayFilter = theme === 'dark'
    ? 'invert(70%) sepia(0%) saturate(0%) brightness(80%)'
    : 'invert(50%) sepia(0%) saturate(0%) brightness(60%)';

  return (
    <div className={`min-h-screen flex ${theme === 'dark' ? 'bg-[#0a0a12] text-white' : 'bg-gray-50 text-gray-900'}`}>
      {/* Sidebar */}
      <aside className={`w-64 border-r fixed h-full flex flex-col ${theme === 'dark' ? 'bg-[#0e0e1e] border-gray-800' : 'bg-white border-gray-200'}`}>
        {/* Logo */}
        <div className={`p-6 border-b flex justify-center ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center justify-center">
            <img src="/assets/Vista/transparent-logo.svg" alt="PrimeLedger" className="h-44 drop-shadow-md" />
          </div>
        </div>

        {/* Nav Items */}
        <nav className="flex-1 p-4 space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                isActive(item.path)
                  ? 'bg-red-500/10 text-red-500 border-l-4 border-red-500'
                  : theme === 'dark'
                    ? 'text-gray-400 hover:text-white hover:bg-white/5'
                    : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'
              }`}
            >
              <img src={item.icon} alt={item.label} className="w-5 h-5" style={{ filter: isActive(item.path) ? redFilter : grayFilter }} />
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>

        {/* Theme Toggle */}
        <div className="px-4 pb-2">
          <button
            onClick={toggleTheme}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all ${theme === 'dark' ? 'text-gray-400 hover:text-white hover:bg-white/5' : 'text-gray-500 hover:text-gray-900 hover:bg-gray-100'}`}
          >
            <img src="/assets/mode-light-svgrepo-com.svg" alt="Theme" className="w-5 h-5" style={{ filter: grayFilter }} />
            <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
          </button>
        </div>

        {/* User & Logout */}
        <div className={`p-4 border-t ${theme === 'dark' ? 'border-gray-800' : 'border-gray-200'}`}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
            <div>
              <p className="text-sm font-medium">{user?.name || 'User'}</p>
              <p className={`text-xs ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>Digital Wallet</p>
            </div>
          </div>
          <button onClick={logoutUser} className="w-full text-left text-sm text-red-500 hover:text-red-400 px-2 py-1">
            ← Logout
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 ml-64">
        {/* Top Bar */}
        <header className={`h-16 border-b flex items-center justify-between px-8 ${theme === 'dark' ? 'bg-[#0e0e1e] border-gray-800' : 'bg-white border-gray-200'}`}>
          <h1 className="text-xl font-semibold">
            {navItems.find(n => isActive(n.path))?.label || 'Dashboard'}
          </h1>
          <div className="flex items-center gap-3">
            <span className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>{user?.name}</span>
            <div className="w-9 h-9 bg-gradient-to-br from-red-500 to-red-400 rounded-full flex items-center justify-center text-white text-xs font-bold">
              {user?.name?.charAt(0).toUpperCase() || 'U'}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
