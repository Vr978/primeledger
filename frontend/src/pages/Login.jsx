import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { login } from '../services/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { loginUser } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await login(email, password);
      loginUser(res.data.token, { name: res.data.username, refreshToken: res.data.refreshToken });
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex flex-col items-center justify-center px-8 bg-white">
        <div className="w-full max-w-sm">
          <div className="text-center mb-8">
            <img src="/assets/Vista/colored-logo.svg" alt="PrimeLedger" className="h-84 mx-auto mb-4 drop-shadow-lg" />
            <p className="text-gray-400 mt-2">Welcome back! Please enter your details.</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-4 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none"
                placeholder="Enter your email"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:ring-2 focus:ring-red-400 focus:border-transparent outline-none"
                placeholder="••••••••••"
                required
              />
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" className="w-4 h-4 rounded border-gray-300 text-red-500 focus:ring-red-400" />
                <span className="text-gray-600">Remember me</span>
              </label>
              <span className="text-gray-400">Forgot password</span>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-red-500 to-red-400 text-white py-3.5 px-4 rounded-xl hover:from-red-600 hover:to-red-500 transition-all font-semibold disabled:opacity-50 shadow-lg shadow-red-200"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center mt-8 text-sm text-gray-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-red-500 hover:text-red-600 font-semibold">
              Sign up for free!
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50 p-12">
        <img src="/assets/login.png" alt="Welcome" className="max-w-full max-h-[80vh] object-contain" />
      </div>
    </div>
  );
}
