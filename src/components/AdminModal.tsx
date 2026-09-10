import React, { useState, useEffect } from 'react';
import {
  X,
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  Clock,
  Search,
  RefreshCw,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  UserPlus,
  Key,
  Eye,
  EyeOff,
  Sparkles,
  Copy,
  Check,
  Shield,
  Lock,
  Mail,
  User,
} from 'lucide-react';
import {
  collection,
  onSnapshot,
  doc,
  updateDoc,
  deleteDoc,
  setDoc,
  query,
  orderBy,
} from 'firebase/firestore';
import { initializeApp, deleteApp } from 'firebase/app';
import {
  getAuth,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
} from 'firebase/auth';
import { db, firebaseConfig } from '../lib/firebase';
import { AppUser, UserRole, UserStatus } from '../types';
import { useAuth } from '../context/AuthContext';
import { copyTextToClipboard } from '../utils/clipboard';

interface AdminModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const HARDCODED_ADMINS = ['tuan.le@robusltd.com', 'letuanthhcm@gmail.com'];
const isPrimaryAdmin = (email?: string) =>
  Boolean(email && HARDCODED_ADMINS.some((adm) => adm.toLowerCase() === email.toLowerCase()));

export const AdminModal: React.FC<AdminModalProps> = ({ isOpen, onClose }) => {
  const { firebaseUser } = useAuth();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [filterRole, setFilterRole] = useState<'all' | 'admin' | 'user'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | UserStatus>('all');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(
    null
  );

  // State for Admin Create User
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [newUsername, setNewUsername] = useState<string>('');
  const [newPassword, setNewPassword] = useState<string>('');
  const [newDisplayName, setNewDisplayName] = useState<string>('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [newStatus, setNewStatus] = useState<UserStatus>('active');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [isCreating, setIsCreating] = useState<boolean>(false);
  const [createdSuccessInfo, setCreatedSuccessInfo] = useState<{
    loginId: string;
    email: string;
    pass: string;
    displayName: string;
    role: string;
  } | null>(null);
  const [copiedInfo, setCopiedInfo] = useState<boolean>(false);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const usersQuery = query(collection(db, 'users'), orderBy('createdAt', 'desc'));

    const unsubscribe = onSnapshot(
      usersQuery,
      (snapshot) => {
        const list: AppUser[] = [];
        snapshot.forEach((docSnap) => {
          list.push(docSnap.data() as AppUser);
        });
        setUsers(list);
        setLoading(false);
      },
      (err) => {
        console.error('Error fetching users:', err);
        setFeedback({ type: 'error', message: 'Không thể tải danh sách người dùng: ' + err.message });
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [isOpen]);

  if (!isOpen) return null;

  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedback({ type, message });
    setTimeout(() => {
      setFeedback(null);
    }, 4000);
  };

  const handleUpdateRole = async (targetUser: AppUser, newRole: UserRole) => {
    if (isPrimaryAdmin(targetUser.email)) {
      showNotification('Không thể hạ quyền Admin cấp cao nhất.', 'error');
      return;
    }

    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, { role: newRole });
      showNotification(`Đã cập nhật quyền của ${targetUser.email} thành ${newRole === 'admin' ? 'Admin' : 'Thành viên'}.`);
    } catch (e: any) {
      showNotification('Lỗi khi cập nhật quyền: ' + e.message, 'error');
    }
  };

  const handleUpdateStatus = async (targetUser: AppUser, newStatus: UserStatus) => {
    if (isPrimaryAdmin(targetUser.email)) {
      showNotification('Không thể thay đổi trạng thái của Admin cấp cao nhất.', 'error');
      return;
    }

    try {
      const userRef = doc(db, 'users', targetUser.uid);
      await updateDoc(userRef, { status: newStatus });
      const statusLabel =
        newStatus === 'active'
          ? 'Kích hoạt'
          : newStatus === 'disabled'
          ? 'Tạm khóa'
          : 'Chờ duyệt';
      showNotification(`Đã chuyển trạng thái của ${targetUser.email} sang: ${statusLabel}.`);
    } catch (e: any) {
      showNotification('Lỗi khi cập nhật trạng thái: ' + e.message, 'error');
    }
  };

  const handleDeleteUser = async (targetUser: AppUser) => {
    if (isPrimaryAdmin(targetUser.email)) {
      showNotification('Không thể xóa tài khoản của Admin cấp cao nhất.', 'error');
      return;
    }

    if (targetUser.uid === firebaseUser?.uid) {
      showNotification('Không thể tự xóa tài khoản của chính bạn.', 'error');
      return;
    }

    const confirmed = window.confirm(`Bạn có chắc chắn muốn xóa bản ghi người dùng ${targetUser.email}?`);
    if (!confirmed) return;

    try {
      await deleteDoc(doc(db, 'users', targetUser.uid));
      showNotification(`Đã xóa người dùng ${targetUser.email}.`);
    } catch (e: any) {
      showNotification('Lỗi khi xóa người dùng: ' + e.message, 'error');
    }
  };

  const handleGenerateRandomPassword = () => {
    const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz';
    const numbers = '23456789';
    let pass = '';
    for (let i = 0; i < 5; i++) pass += letters.charAt(Math.floor(Math.random() * letters.length));
    for (let i = 0; i < 3; i++) pass += numbers.charAt(Math.floor(Math.random() * numbers.length));
    pass += '@#';
    setNewPassword(pass);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const rawIdent = newUsername.trim();
    if (!rawIdent) {
      showNotification('Vui lòng nhập Tên đăng nhập hoặc Email.', 'error');
      return;
    }
    if (!newPassword || newPassword.length < 6) {
      showNotification('Mật khẩu tối thiểu phải từ 6 ký tự.', 'error');
      return;
    }

    setIsCreating(true);
    const isEmail = rawIdent.includes('@');
    const finalEmail = isEmail ? rawIdent : `${rawIdent.toLowerCase()}@sitemap.local`;
    const finalDisplayName = newDisplayName.trim() || (isEmail ? rawIdent.split('@')[0] : rawIdent);

    const tempAppName = `admin_create_${Date.now()}`;
    const tempApp = initializeApp(firebaseConfig, tempAppName);
    const tempAuth = getAuth(tempApp);

    try {
      const userCred = await createUserWithEmailAndPassword(tempAuth, finalEmail, newPassword);
      const newUid = userCred.user.uid;

      try {
        await updateProfile(userCred.user, { displayName: finalDisplayName });
      } catch (e) {
        console.warn('Could not update secondary profile displayName:', e);
      }

      const newUserData: AppUser = {
        uid: newUid,
        email: finalEmail,
        username: !isEmail ? rawIdent : undefined,
        displayName: finalDisplayName,
        role: newRole,
        status: newStatus,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
        crawlsCount: 0,
        createdBy: firebaseUser?.email || 'admin',
      };

      await setDoc(doc(db, 'users', newUid), newUserData);

      await signOut(tempAuth);
      await deleteApp(tempApp);

      setCreatedSuccessInfo({
        loginId: rawIdent,
        email: finalEmail,
        pass: newPassword,
        displayName: finalDisplayName,
        role: newRole === 'admin' ? 'Quản trị viên (Admin)' : 'Thành viên (User)',
      });

      showNotification(`Tạo tài khoản "${rawIdent}" thành công!`);
      setNewUsername('');
      setNewPassword('');
      setNewDisplayName('');
      setNewRole('user');
      setNewStatus('active');
    } catch (err: any) {
      console.error('Error creating user by admin:', err);
      try {
        await deleteApp(tempApp);
      } catch (e) {}

      if (err?.code === 'auth/email-already-in-use') {
        showNotification('Tên đăng nhập / Email này đã tồn tại trong hệ thống. Vui lòng chọn tên khác.', 'error');
      } else if (err?.code === 'auth/invalid-email') {
        showNotification('Tên đăng nhập hoặc Email không hợp lệ.', 'error');
      } else if (err?.code === 'auth/weak-password') {
        showNotification('Mật khẩu quá yếu (yêu cầu tối thiểu 6 ký tự).', 'error');
      } else {
        showNotification('Lỗi khi tạo tài khoản: ' + (err?.message || 'Không xác định'), 'error');
      }
    } finally {
      setIsCreating(false);
    }
  };

  const handleCopyCredentials = async () => {
    if (!createdSuccessInfo) return;
    const text = `Thông tin tài khoản đăng nhập Sitemap Crawler:
- Tên đăng nhập: ${createdSuccessInfo.loginId}
- Mật khẩu: ${createdSuccessInfo.pass}
- Tên người dùng: ${createdSuccessInfo.displayName}
- Quyền hạn: ${createdSuccessInfo.role}
(Đăng nhập tại ô Tên đăng nhập / Email)`;
    await copyTextToClipboard(text);
    setCopiedInfo(true);
    setTimeout(() => setCopiedInfo(false), 2500);
  };

  // Filter users
  const filteredUsers = users.filter((u) => {
    const matchSearch =
      (u.email || '').toLowerCase().includes(search.toLowerCase()) ||
      (u.displayName || '').toLowerCase().includes(search.toLowerCase());
    const matchRole = filterRole === 'all' || u.role === filterRole;
    const matchStatus = filterStatus === 'all' || u.status === filterStatus;
    return matchSearch && matchRole && matchStatus;
  });

  const totalUsers = users.length;
  const activeUsers = users.filter((u) => u.status === 'active').length;
  const pendingUsers = users.filter((u) => u.status === 'pending').length;
  const disabledUsers = users.filter((u) => u.status === 'disabled').length;
  const totalCrawls = users.reduce((acc, curr) => acc + (curr.crawlsCount || 0), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="fixed inset-0" onClick={onClose} />

      <div className="relative w-full max-w-5xl max-h-[90vh] bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl z-10 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:px-6 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-zinc-900 dark:text-white flex items-center gap-2">
                <span>Quản trị Hệ thống & Người dùng</span>
                <span className="px-2 py-0.5 text-[10px] font-semibold bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 rounded-md">
                  Admin Control
                </span>
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Xem danh sách thành viên, phê duyệt quyền truy cập và phân quyền sử dụng
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Feedback Alert */}
        {feedback && (
          <div
            className={`mx-4 sm:mx-6 mt-3 p-3 rounded-xl text-xs flex items-center gap-2 ${
              feedback.type === 'success'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
            }`}
          >
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 shrink-0" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
        )}

        {/* Top Metric Cards */}
        <div className="p-4 sm:px-6 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
          <div className="p-3 bg-zinc-50 dark:bg-zinc-950/60 rounded-xl border border-zinc-200 dark:border-zinc-800">
            <div className="text-[11px] text-zinc-500 font-medium flex items-center gap-1">
              <Users className="w-3.5 h-3.5 text-indigo-500" />
              <span>Tổng thành viên</span>
            </div>
            <div className="text-xl font-bold text-zinc-900 dark:text-white mt-1">
              {totalUsers}
            </div>
          </div>

          <div className="p-3 bg-emerald-50/50 dark:bg-emerald-950/30 rounded-xl border border-emerald-200/60 dark:border-emerald-900/40">
            <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1">
              <UserCheck className="w-3.5 h-3.5" />
              <span>Đang hoạt động</span>
            </div>
            <div className="text-xl font-bold text-emerald-700 dark:text-emerald-300 mt-1">
              {activeUsers}
            </div>
          </div>

          <div className="p-3 bg-amber-50/50 dark:bg-amber-950/30 rounded-xl border border-amber-200/60 dark:border-amber-900/40">
            <div className="text-[11px] text-amber-700 dark:text-amber-400 font-medium flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              <span>Chờ duyệt / Khóa</span>
            </div>
            <div className="text-xl font-bold text-amber-700 dark:text-amber-300 mt-1">
              {pendingUsers + disabledUsers}
            </div>
          </div>

          <div className="p-3 bg-indigo-50/50 dark:bg-indigo-950/30 rounded-xl border border-indigo-200/60 dark:border-indigo-900/40">
            <div className="text-[11px] text-indigo-700 dark:text-indigo-400 font-medium flex items-center gap-1">
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Lượt trích xuất</span>
            </div>
            <div className="text-xl font-bold text-indigo-700 dark:text-indigo-300 mt-1">
              {totalCrawls}
            </div>
          </div>
        </div>

        {/* Filter Toolbar */}
        <div className="px-4 sm:px-6 pb-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-zinc-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo email hoặc tên hiển thị..."
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 focus:outline-none"
            >
              <option value="all">Mọi quyền (Tất cả)</option>
              <option value="admin">Chỉ Admin</option>
              <option value="user">Chỉ Thành viên</option>
            </select>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-2.5 py-1.5 text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 focus:outline-none"
            >
              <option value="all">Mọi trạng thái</option>
              <option value="active">Hoạt động (Active)</option>
              <option value="pending">Chờ duyệt (Pending)</option>
              <option value="disabled">Đã khóa (Disabled)</option>
            </select>

            <button
              type="button"
              onClick={() => {
                setShowCreateModal(true);
                setCreatedSuccessInfo(null);
              }}
              className="px-3 py-1.5 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5 transition-all shadow-2xs shrink-0 cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Tạo User & Pass</span>
            </button>
          </div>
        </div>

        {/* Users Table */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 pb-6">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center text-zinc-400 text-xs">
              <RefreshCw className="w-6 h-6 animate-spin mb-2 text-indigo-500" />
              <span>Đang tải danh sách người dùng...</span>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="py-12 text-center text-zinc-400 text-xs border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl">
              Không tìm thấy người dùng nào phù hợp với bộ lọc.
            </div>
          ) : (
            <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-zinc-50 dark:bg-zinc-950 text-zinc-500 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-800 font-semibold">
                    <th className="py-2.5 px-3">Người dùng</th>
                    <th className="py-2.5 px-3">Quyền hạn</th>
                    <th className="py-2.5 px-3">Trạng thái</th>
                    <th className="py-2.5 px-3 text-center">Lượt Crawl</th>
                    <th className="py-2.5 px-3 text-right">Thao tác Admin</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredUsers.map((u) => {
                    const isSuperAdmin = isPrimaryAdmin(u.email);
                    const isInternalAuth = u.email?.endsWith('@sitemap.local');

                    return (
                      <tr
                        key={u.uid}
                        className="hover:bg-zinc-50/70 dark:hover:bg-zinc-950/40 transition-colors"
                      >
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 font-bold flex items-center justify-center text-xs shrink-0">
                              {(u.displayName || u.email || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="font-semibold text-zinc-900 dark:text-white flex items-center gap-1.5 truncate">
                                <span>{u.displayName || 'Chưa đặt tên'}</span>
                                {isSuperAdmin && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.2 bg-amber-100 text-amber-800 dark:bg-amber-900/60 dark:text-amber-300 rounded">
                                    Super Admin
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                                {isInternalAuth ? (
                                  <>
                                    <span className="font-semibold text-indigo-600 dark:text-indigo-400">
                                      @{u.username || u.email.replace('@sitemap.local', '')}
                                    </span>
                                    <span className="px-1.5 py-0.2 text-[9px] font-medium bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200/60 dark:border-indigo-800 rounded">
                                      User/Pass
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="truncate">{u.email}</span>
                                    {u.email?.includes('@gmail.com') && (
                                      <span className="px-1.5 py-0.2 text-[9px] font-medium bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200/50 dark:border-red-900/40 rounded">
                                        Gmail
                                      </span>
                                    )}
                                  </>
                                )}
                              </div>
                              {u.createdAt && (
                                <div className="text-[10px] text-zinc-400 mt-0.5">
                                  Tham gia: {new Date(u.createdAt).toLocaleDateString('vi-VN')}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Role Column */}
                        <td className="py-3 px-3">
                          {isSuperAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                              <ShieldCheck className="w-3 h-3" />
                              Admin
                            </span>
                          ) : (
                            <select
                              value={u.role || 'user'}
                              onChange={(e) =>
                                handleUpdateRole(u, e.target.value as UserRole)
                              }
                              className="px-2 py-1 text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg text-zinc-800 dark:text-zinc-200 focus:outline-none"
                            >
                              <option value="user">Thành viên</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                        </td>

                        {/* Status Column */}
                        <td className="py-3 px-3">
                          {isSuperAdmin ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                              <CheckCircle2 className="w-3 h-3" />
                              Hoạt động
                            </span>
                          ) : (
                            <select
                              value={u.status || 'active'}
                              onChange={(e) =>
                                handleUpdateStatus(u, e.target.value as UserStatus)
                              }
                              className={`px-2 py-1 text-[11px] font-semibold rounded-lg border focus:outline-none ${
                                u.status === 'active'
                                  ? 'bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                  : u.status === 'pending'
                                  ? 'bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
                                  : 'bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                              }`}
                            >
                              <option value="active">Hoạt động (Active)</option>
                              <option value="pending">Chờ duyệt (Pending)</option>
                              <option value="disabled">Khóa (Disabled)</option>
                            </select>
                          )}
                        </td>

                        {/* Crawl Count */}
                        <td className="py-3 px-3 text-center font-mono font-medium text-zinc-700 dark:text-zinc-300">
                          {u.crawlsCount || 0}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            {!isSuperAdmin && u.status !== 'active' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(u, 'active')}
                                title="Kích hoạt tài khoản ngay"
                                className="p-1 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors"
                              >
                                <UserCheck className="w-4 h-4" />
                              </button>
                            )}

                            {!isSuperAdmin && u.status === 'active' && (
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(u, 'disabled')}
                                title="Tạm khóa tài khoản này"
                                className="p-1 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950/60 rounded-lg transition-colors"
                              >
                                <UserX className="w-4 h-4" />
                              </button>
                            )}

                            {!isSuperAdmin && u.uid !== firebaseUser?.uid && (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                title="Xóa tài khoản"
                                className="p-1 text-zinc-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Create User & Pass Sub-Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div
              className="fixed inset-0"
              onClick={() => {
                if (!isCreating) setShowCreateModal(false);
              }}
            />

            <div className="relative w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 shadow-2xl z-10 overflow-hidden">
              <div className="flex items-center justify-between p-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center gap-2">
                  <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <UserPlus className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-zinc-900 dark:text-white">
                      Tạo tài khoản người dùng
                    </h3>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Cấp Username / Mật khẩu cho thành viên
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (!isCreating) setShowCreateModal(false);
                  }}
                  className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {createdSuccessInfo ? (
                <div className="p-5 space-y-4">
                  <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/80 rounded-xl flex items-start gap-2.5">
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                    <div>
                      <div className="text-xs font-bold text-emerald-900 dark:text-emerald-200">
                        Đã tạo tài khoản thành công!
                      </div>
                      <div className="text-[11px] text-emerald-700 dark:text-emerald-300 mt-0.5">
                        Tài khoản đã sẵn sàng hoạt động. Bạn có thể sao chép thông tin gửi cho người dùng.
                      </div>
                    </div>
                  </div>

                  {/* Credentials Box */}
                  <div className="p-3.5 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 font-medium">Tên đăng nhập:</span>
                      <span className="font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/60 px-2 py-0.5 rounded border border-indigo-200/60 dark:border-indigo-800">
                        {createdSuccessInfo.loginId}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 font-medium">Mật khẩu:</span>
                      <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 bg-zinc-200/70 dark:bg-zinc-800 px-2 py-0.5 rounded">
                        {createdSuccessInfo.pass}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 font-medium">Tên hiển thị:</span>
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">
                        {createdSuccessInfo.displayName}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-zinc-500 font-medium">Quyền hạn:</span>
                      <span className="font-semibold text-zinc-700 dark:text-zinc-300">
                        {createdSuccessInfo.role}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyCredentials}
                      className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-2xs cursor-pointer"
                    >
                      {copiedInfo ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>Đã sao chép vào bộ nhớ tạm!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Sao chép thông tin gửi cho User</span>
                        </>
                      )}
                    </button>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setCreatedSuccessInfo(null);
                        }}
                        className="flex-1 py-2 px-3 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-medium text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        Tạo tài khoản khác
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setShowCreateModal(false);
                          setCreatedSuccessInfo(null);
                        }}
                        className="flex-1 py-2 px-3 bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white font-medium text-xs rounded-xl transition-colors cursor-pointer"
                      >
                        Đóng
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleCreateUser} className="p-5 space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Tên đăng nhập hoặc Email <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <User className="absolute left-3 w-4 h-4 text-zinc-400" />
                      <input
                        type="text"
                        required
                        value={newUsername}
                        onChange={(e) => setNewUsername(e.target.value)}
                        placeholder="Ví dụ: nhanvien1 hoặc tuan@gmail.com"
                        className="w-full pl-9 pr-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>
                    <p className="text-[10.5px] text-zinc-500 dark:text-zinc-400 mt-1">
                      Nhập Username ngắn (vd: <code className="text-indigo-600 dark:text-indigo-400 font-semibold">nhanvien01</code>) hoặc Email. Người dùng sẽ đăng nhập bằng chính Username hoặc Email này.
                    </p>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                        Mật khẩu khởi tạo <span className="text-rose-500">*</span>
                      </label>
                      <button
                        type="button"
                        onClick={handleGenerateRandomPassword}
                        className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Tạo ngẫu nhiên</span>
                      </button>
                    </div>
                    <div className="relative flex items-center">
                      <Lock className="absolute left-3 w-4 h-4 text-zinc-400" />
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="Tối thiểu 6 ký tự"
                        className="w-full pl-9 pr-10 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                      Họ và tên / Tên hiển thị (Tùy chọn)
                    </label>
                    <input
                      type="text"
                      value={newDisplayName}
                      onChange={(e) => setNewDisplayName(e.target.value)}
                      placeholder="Ví dụ: Nguyễn Văn A"
                      className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Phân quyền
                      </label>
                      <select
                        value={newRole}
                        onChange={(e) => setNewRole(e.target.value as UserRole)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="user">Thành viên (User)</option>
                        <option value="admin">Quản trị viên (Admin)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                        Trạng thái ban đầu
                      </label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value as UserStatus)}
                        className="w-full px-3 py-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-300 dark:border-zinc-700 rounded-xl text-xs text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="active">Hoạt động ngay</option>
                        <option value="pending">Chờ duyệt</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
                    <button
                      type="button"
                      disabled={isCreating}
                      onClick={() => setShowCreateModal(false)}
                      className="px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      Hủy bỏ
                    </button>
                    <button
                      type="submit"
                      disabled={isCreating}
                      className="px-4 py-2 text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl flex items-center gap-1.5 transition-colors disabled:opacity-50 shadow-2xs cursor-pointer"
                    >
                      {isCreating ? (
                        <>
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          <span>Đang tạo...</span>
                        </>
                      ) : (
                        <>
                          <UserPlus className="w-3.5 h-3.5" />
                          <span>Tạo tài khoản ngay</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
