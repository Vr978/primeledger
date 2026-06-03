import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="max-w-2xl">
      <div className={`rounded-2xl border p-6 mb-6 ${theme === 'dark' ? 'bg-[#1a1a2e] border-gray-800' : 'bg-white border-gray-200'}`}>
        <h3 className="font-semibold text-lg mb-4">Appearance</h3>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src="/assets/mode-light-svgrepo-com.svg"
              alt="Theme"
              className="w-5 h-5"
              style={{ filter: theme === 'dark' ? 'invert(70%) brightness(80%)' : 'invert(50%) brightness(60%)' }}
            />
            <div>
              <p className="font-medium">Theme</p>
              <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>Switch between light and dark mode</p>
            </div>
          </div>
          <button
            onClick={toggleTheme}
            className={`relative inline-flex h-7 w-12 flex-shrink-0 items-center rounded-full transition-colors ${theme === 'dark' ? 'bg-red-500' : 'bg-gray-300'}`}
          >
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform ${theme === 'dark' ? 'translate-x-6' : 'translate-x-1'}`}></span>
          </button>
        </div>
        <p className={`text-sm mt-3 ${theme === 'dark' ? 'text-gray-500' : 'text-gray-400'}`}>
          Currently: {theme === 'dark' ? '🌙 Dark Mode' : '☀️ Light Mode'}
        </p>
      </div>

      <div className={`rounded-2xl border p-6 ${theme === 'dark' ? 'bg-[#1a1a2e] border-gray-800' : 'bg-white border-gray-200'}`}>
        <h3 className="font-semibold text-lg mb-4">Profile</h3>
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Username</span>
            <span className="font-medium">{user?.username}</span>
          </div>
          <div className="flex justify-between">
            <span className={theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}>Role</span>
            <span className="font-medium">Member</span>
          </div>
        </div>
      </div>

      <div className={`rounded-2xl border p-6 mt-6 ${theme === 'dark' ? 'bg-[#1a1a2e] border-gray-800' : 'bg-white border-gray-200'}`}>
        <h3 className="font-semibold text-lg mb-2">About PrimeLedger</h3>
        <p className={`text-sm ${theme === 'dark' ? 'text-gray-400' : 'text-gray-500'}`}>
          Distributed banking platform built with Spring Boot microservices, deployed on AWS (ECS Fargate, Aurora, Kinesis). 
          Features include transactional outbox pattern, idempotency keys, and real-time data pipeline to S3/Athena.
        </p>
        <p className={`text-xs mt-3 ${theme === 'dark' ? 'text-gray-600' : 'text-gray-400'}`}>
          Demo account for transfers: PL-2026-000001
        </p>
      </div>
    </div>
  );
}
