import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { ShieldIcon, UsersIcon, VideoIcon, DatabaseIcon } from '../lib/icons';

interface SystemUser {
  _id: string;
  name?: string;
  email: string;
  avatar?: string;
  systemRole: 'SUPER_ADMIN' | 'PLATFORM_ADMIN' | 'MEDIA_MANAGER' | 'PLATFORM_USER';
  createdAt: string;
}

interface AdminStats {
  totalUsers: number;
  totalWorkspaces: number;
  totalMeetings: number;
  roleDistribution: { _id: string; count: number }[];
}

export default function AdminPanel() {
  const { user } = useAuthStore();
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);

  const fetchAdminData = async () => {
    setLoading(true);
    setError('');
    try {
      const [usersRes, statsRes] = await Promise.all([
        api.get('/api/admin/users'),
        api.get('/api/admin/stats')
      ]);
      setUsers(usersRes.data);
      setStats(statsRes.data);
    } catch (err: any) {
      console.error("Fetch admin error:", err);
      setError(err.response?.data?.message || 'Failed to load admin management panel');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminData();
  }, []);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setUpdatingUserId(userId);
    try {
      await api.put(`/api/admin/users/${userId}/role`, { systemRole: newRole });
      setUsers(users.map(u => u._id === userId ? { ...u, systemRole: newRole as any } : u));
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update system role');
    } finally {
      setUpdatingUserId(null);
    }
  };

  if (user?.systemRole !== 'SUPER_ADMIN') {
    return (
      <div className="p-8 text-center bg-slate-900/50 border border-slate-800 rounded-2xl">
        <h2 className="text-xl font-bold text-rose-400 mb-2">Access Denied</h2>
        <p className="text-slate-400">Only Global System Super Admins have access to the platform management panel.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400">
              <ShieldIcon />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">System Admin Panel</h1>
          </div>
          <p className="text-sm text-slate-400">Global platform oversight, RBAC system role administration, and storage policies.</p>
        </div>
        <button
          onClick={fetchAdminData}
          className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-sm font-medium rounded-xl transition-all"
        >
          Refresh Data
        </button>
      </div>

      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Metrics Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900 backdrop-blur-xl flex items-center gap-4">
            <div className="p-3 rounded-xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              <UsersIcon />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-extrabold text-white mt-0.5">{stats.totalUsers}</h3>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900 backdrop-blur-xl flex items-center gap-4">
            <div className="p-3 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20">
              <DatabaseIcon />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Active Workspaces</p>
              <h3 className="text-2xl font-extrabold text-white mt-0.5">{stats.totalWorkspaces}</h3>
            </div>
          </div>

          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900 backdrop-blur-xl flex items-center gap-4">
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <VideoIcon />
            </div>
            <div>
              <p className="text-xs text-slate-500 font-semibold uppercase tracking-wider">Total Meetings</p>
              <h3 className="text-2xl font-extrabold text-white mt-0.5">{stats.totalMeetings}</h3>
            </div>
          </div>
        </div>
      )}

      {/* Global User Management Table */}
      <div className="bg-slate-900/40 border border-slate-900 rounded-2xl overflow-hidden backdrop-blur-xl">
        <div className="p-6 border-b border-slate-900 flex items-center justify-between">
          <h2 className="font-bold text-base text-white">Global User RBAC Management</h2>
          <span className="text-xs text-slate-500">{users.length} registered users</span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-slate-500">Loading system users...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950/60 text-xs text-slate-500 uppercase tracking-wider border-b border-slate-900">
                <tr>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Email</th>
                  <th className="px-6 py-4">Global System Role</th>
                  <th className="px-6 py-4">Joined Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900">
                {users.map((u) => (
                  <tr key={u._id} className="hover:bg-slate-900/30 transition-colors">
                    <td className="px-6 py-4 flex items-center gap-3">
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="h-8 w-8 rounded-lg object-cover" />
                      ) : (
                        <div className="h-8 w-8 rounded-lg bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 font-bold text-xs">
                          {u.name ? u.name[0].toUpperCase() : u.email[0].toUpperCase()}
                        </div>
                      )}
                      <span className="font-medium text-slate-200">{u.name || 'User'}</span>
                    </td>
                    <td className="px-6 py-4 text-slate-400">{u.email}</td>
                    <td className="px-6 py-4">
                      <select
                        value={u.systemRole}
                        disabled={updatingUserId === u._id}
                        onChange={(e) => handleRoleChange(u._id, e.target.value)}
                        className="bg-slate-950 border border-slate-800 text-slate-200 text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 transition-colors"
                      >
                        <option value="SUPER_ADMIN">System Super Admin</option>
                        <option value="PLATFORM_ADMIN">Platform Admin</option>
                        <option value="MEDIA_MANAGER">Compliance and Media Manager</option>
                        <option value="PLATFORM_USER">Platform User</option>
                      </select>
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-xs">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
