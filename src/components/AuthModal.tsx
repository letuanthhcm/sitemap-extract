import React, { useState } from 'react';
import { X, Mail, Lock, User, AlertCircle, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultMode?: 'login' | 'register';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  defaultMode = 'login',
}) => {
  const { loginWithEmail, registerWithEmail, loginWithGoogle } = useAuth();
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const resetForm = () => {
    setEmail('');
    setPassword('');
    setDisplayName('');
    setError(null);
  };

  const handleModeSwitch = (newMode: 'login' | 'register') => {
    setMode(newMode);
    setError(null);
  };

  const getFriendlyError = (code: string) => {
    switch (code) {
      case 'auth/invalid-credential':
      case 'auth/wrong-password':
      case 'auth/user-not-found':
        return 'Email hoặc mật khẩu không chính xác. Vui lòng thử lại.';
      case 'auth/email-already-in-use':
        return 'Email này đã được đăng ký tài khoản. Bạn vui lòng chuyển sang Đăng nhập.';
      case 'auth/weak-password':
        return 'Mật khẩu quá ngắn. Vui lòng đặt tối thiểu 6 ký tự.';
      case 'auth/invalid-email':
        return 'Địa chỉ email không hợp lệ.';
      case 'auth/popup-closed-by-user':
        return 'Cửa sổ đăng nhập Google đã bị đóng.';
      default:
        return 'Đã xảy ra lỗi. Vui lòng thử lại sau.';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Vui lòng điền đầy đủ Email và Mật khẩu.');
      return;
    }

    if (password.length < 6) {
      setError('Mật khẩu tối thiểu phải từ 6 ký tự trở lên.');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'login') {
        await loginWithEmail(email.trim(), password);
      } else {
        await registerWithEmail(email.trim(), password, displayName.trim());
      }
      resetForm();
      onClose();
    } catch (err: any) {
      console.error('Auth error:', err);
      setError(getFriendlyError(err?.code || ''));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setLoading(true);
    try {
      await loginWithGoogle();
      resetForm();
      onClose();
    } catch (err: any) {
      console.error('Google Sign In error:', err);
      setError(getFriendlyError(err?.code || ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div
        className="fixed inset-0"
        onClick={() => {
          if (!loading) onClose();
        }}
      />

      <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl z-10 overflow-hidden">
        {/* Header with tabs */}
        <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
          <div className="flex gap-2 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-xl text-xs font-semibold">
            <button
              type="button"
              onClick={() => handleModeSwitch('login')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                mode === 'login'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => handleModeSwitch('register')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                mode === 'register'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-xs'
                  : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
              }`}
            >
              Đăng ký tài khoản
            </button>
          </div>

          <button
            onClick={onClose}
            disabled={loading}
            className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-bold text-zinc-900 dark:text-white">
              {mode === 'login' ? 'Đăng nhập hệ thống' : 'Tạo tài khoản mới'}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
              {mode === 'login'
                ? 'Đăng nhập để sử dụng tính năng trích xuất sitemap và tỉa từ khóa SEO'
                : 'Đăng ký nhanh tài khoản để bắt đầu sử dụng và quản lý'}
            </p>
          </div>

          {/* Google Sign In Button */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2.5 py-2.5 px-4 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-750 text-zinc-700 dark:text-zinc-200 text-sm font-medium rounded-xl transition-colors shadow-2xs disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Tiếp tục với Google / Gmail</span>
          </button>

          <div className="relative flex items-center justify-center">
            <div className="border-t border-zinc-200 dark:border-zinc-800 w-full" />
            <span className="bg-white dark:bg-zinc-900 px-3 text-[11px] uppercase tracking-wider text-zinc-400">
              {mode === 'login' ? 'hoặc Tài khoản & Mật khẩu' : 'hoặc Đăng ký qua Email'}
            </span>
          </div>

          {error && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl flex items-start gap-2 text-xs text-rose-700 dark:text-rose-300 animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  Tên hiển thị
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-3 w-4 h-4 text-zinc-400" />
                  <input
                    type="text"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    placeholder="Ví dụ: Tuấn Lê"
                    className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  {mode === 'login' ? 'Email hoặc Tên đăng nhập (Username)' : 'Địa chỉ Email'}
                </label>
                {mode === 'login' && (
                  <span className="text-[10px] text-indigo-600 dark:text-indigo-400">Admin cấp hoặc Gmail</span>
                )}
              </div>
              <div className="relative flex items-center">
                <Mail className="absolute left-3 w-4 h-4 text-zinc-400" />
                <input
                  type={mode === 'login' ? 'text' : 'email'}
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={mode === 'login' ? 'vidu@gmail.com hoặc username' : 'name@company.com'}
                  autoCapitalize="none"
                  autoCorrect="off"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Mật khẩu
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3 w-4 h-4 text-zinc-400" />
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-colors disabled:opacity-50 shadow-xs"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang xử lý...</span>
                </>
              ) : (
                <>
                  <span>{mode === 'login' ? 'Đăng nhập ngay' : 'Đăng ký tài khoản'}</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            {mode === 'login' ? (
              <button
                type="button"
                onClick={() => handleModeSwitch('register')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Chưa có tài khoản? <span className="font-semibold">Đăng ký tại đây</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleModeSwitch('login')}
                className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                Đã có tài khoản? <span className="font-semibold">Đăng nhập</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
