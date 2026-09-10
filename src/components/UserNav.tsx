import React, { useState } from 'react';
import {
  User,
  LogIn,
  UserPlus,
  LogOut,
  Shield,
  ChevronDown,
  Clock,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface UserNavProps {
  onOpenAuth: (mode: 'login' | 'register') => void;
  onOpenAdmin: () => void;
}

export const UserNav: React.FC<UserNavProps> = ({ onOpenAuth, onOpenAdmin }) => {
  const { firebaseUser, appUser, isAdmin, logout, loading } = useAuth();
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (loading) {
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 h-7 bg-zinc-200 dark:bg-zinc-800 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (!firebaseUser) {
    return (
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenAuth('login')}
          className="px-3 py-1.5 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:text-indigo-600 dark:hover:text-indigo-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center gap-1.5 transition-colors"
        >
          <LogIn className="w-3.5 h-3.5" />
          <span>Đăng nhập</span>
        </button>

        <button
          type="button"
          onClick={() => onOpenAuth('register')}
          className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs"
        >
          <UserPlus className="w-3.5 h-3.5" />
          <span>Đăng ký</span>
        </button>
      </div>
    );
  }

  const displayName =
    appUser?.displayName || firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User';
  const email = appUser?.email || firebaseUser.email || '';
  const status = appUser?.status || 'active';

  return (
    <div className="relative flex items-center gap-2">
      {/* Admin Panel Quick Button */}
      {isAdmin && (
        <button
          type="button"
          onClick={onOpenAdmin}
          title="Mở bảng điều khiển quản trị người dùng"
          className="px-2.5 py-1.5 text-xs font-semibold bg-indigo-50 dark:bg-indigo-950/70 hover:bg-indigo-100 dark:hover:bg-indigo-900/80 text-indigo-700 dark:text-indigo-300 border border-indigo-200/80 dark:border-indigo-800 rounded-lg flex items-center gap-1.5 transition-all shadow-2xs"
        >
          <Shield className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
          <span className="hidden sm:inline">Quản trị Admin</span>
        </button>
      )}

      {/* User Status Badge (if not active) */}
      {status === 'pending' && !isAdmin && (
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-amber-100 dark:bg-amber-950/80 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-800 rounded-md flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>Chờ duyệt</span>
        </span>
      )}
      {status === 'disabled' && !isAdmin && (
        <span className="px-2 py-0.5 text-[10px] font-semibold bg-rose-100 dark:bg-rose-950/80 text-rose-800 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-md flex items-center gap-1">
          <Ban className="w-3 h-3" />
          <span>Đã khóa</span>
        </span>
      )}

      {/* User Profile Dropdown Button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-2 p-1.5 pl-2 pr-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-xl transition-all shadow-2xs"
        >
          <div className="w-6 h-6 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <span className="text-xs font-semibold text-zinc-800 dark:text-zinc-200 max-w-[120px] truncate hidden md:inline">
            {displayName}
          </span>
          <ChevronDown
            className={`w-3 h-3 text-zinc-400 transition-transform ${
              dropdownOpen ? 'rotate-180' : ''
            }`}
          />
        </button>

        {dropdownOpen && (
          <>
            <div
              className="fixed inset-0 z-30"
              onClick={() => setDropdownOpen(false)}
            />
            <div className="absolute right-0 mt-1.5 w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl z-40 p-2 text-xs divide-y divide-zinc-100 dark:divide-zinc-800">
              <div className="px-2.5 py-2">
                <div className="font-semibold text-zinc-900 dark:text-white truncate">
                  {displayName}
                </div>
                <div className="text-[11px] text-zinc-400 truncate">{email}</div>
                <div className="mt-1.5 flex items-center gap-1.5">
                  {isAdmin ? (
                    <span className="px-1.5 py-0.5 text-[10px] font-bold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 rounded">
                      Admin Hệ Thống
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 rounded">
                      Thành viên
                    </span>
                  )}
                  {status === 'active' && (
                    <span className="px-1.5 py-0.5 text-[10px] font-medium bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 rounded flex items-center gap-0.5">
                      <CheckCircle2 className="w-2.5 h-2.5" />
                      Hoạt động
                    </span>
                  )}
                </div>
              </div>

              {isAdmin && (
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => {
                      setDropdownOpen(false);
                      onOpenAdmin();
                    }}
                    className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 flex items-center gap-2 font-medium"
                  >
                    <Shield className="w-3.5 h-3.5 text-indigo-500" />
                    <span>Quản trị người dùng</span>
                  </button>
                </div>
              )}

              <div className="pt-1">
                <button
                  type="button"
                  onClick={async () => {
                    setDropdownOpen(false);
                    await logout();
                  }}
                  className="w-full text-left px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/60 text-rose-600 dark:text-rose-400 flex items-center gap-2 font-medium transition-colors"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Đăng xuất</span>
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
