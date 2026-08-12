import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuthStore } from '../store/useAuthStore';
import { ShieldIcon, UsersIcon, VideoIcon, DatabaseIcon } from '../lib/icons';

import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

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
      <Card className="p-8 text-center bg-bg-surface border border-border-default rounded-2xl shadow-md gap-0">
        <h2 className="text-xl font-bold text-status-danger mb-2">Access Denied</h2>
        <p className="text-text-muted">Only Global System Super Admins have access to the platform management panel.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border-subtle pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-brand-primary/10 border border-border-brand/20 text-text-brand">
              <ShieldIcon />
            </div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">System Admin Panel</h1>
          </div>
          <p className="text-sm text-text-muted">Global platform oversight, RBAC system role administration, and storage policies.</p>
        </div>
        <Button
          variant="outline"
          onClick={fetchAdminData}
          className="px-4 py-2 bg-bg-surface hover:bg-bg-surface-hover border border-border-default text-text-primary text-sm font-medium rounded-xl transition-all cursor-pointer"
        >
          Refresh Data
        </Button>
      </div>

      {error && (
        <div className="p-4 bg-status-danger/10 border border-status-danger/20 text-status-danger text-sm rounded-xl">
          {error}
        </div>
      )}

      {/* Metrics Grid */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          <Card className="p-6 rounded-2xl bg-bg-surface border border-border-default flex flex-row items-center gap-4 shadow-sm">
            <div className="p-3 rounded-xl bg-brand-primary/10 text-text-brand border border-border-brand/20 shrink-0">
              <UsersIcon />
            </div>
            <div>
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Total Users</p>
              <h3 className="text-2xl font-extrabold text-text-primary mt-0.5">{stats.totalUsers}</h3>
            </div>
          </Card>

          <Card className="p-6 rounded-2xl bg-bg-surface border border-border-default flex flex-row items-center gap-4 shadow-sm">
            <div className="p-3 rounded-xl bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20 shrink-0">
              <DatabaseIcon />
            </div>
            <div>
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Active Workspaces</p>
              <h3 className="text-2xl font-extrabold text-text-primary mt-0.5">{stats.totalWorkspaces}</h3>
            </div>
          </Card>

          <Card className="p-6 rounded-2xl bg-bg-surface border border-border-default flex flex-row items-center gap-4 shadow-sm">
            <div className="p-3 rounded-xl bg-status-success/10 text-status-success border border-status-success/20 shrink-0">
              <VideoIcon />
            </div>
            <div>
              <p className="text-xs text-text-muted font-semibold uppercase tracking-wider">Total Meetings</p>
              <h3 className="text-2xl font-extrabold text-text-primary mt-0.5">{stats.totalMeetings}</h3>
            </div>
          </Card>
        </div>
      )}

      {/* Global User Management Table */}
      <Card className="bg-bg-surface border border-border-default rounded-2xl overflow-hidden shadow-md gap-0 p-0">
        <CardHeader className="p-6 border-b border-border-subtle flex flex-row items-center justify-between">
          <CardTitle className="font-bold text-base text-text-primary">Global User RBAC Management</CardTitle>
          <span className="text-xs text-text-muted">{users.length} registered users</span>
        </CardHeader>

        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-text-muted">Loading system users...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm text-text-secondary">
                <thead className="bg-bg-surface-hover/50 text-xs text-text-muted uppercase tracking-wider border-b border-border-subtle">
                  <tr>
                    <th className="px-6 py-4">User</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Global System Role</th>
                    <th className="px-6 py-4">Joined Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-subtle">
                  {users.map((u) => (
                    <tr key={u._id} className="hover:bg-bg-surface-hover/40 transition-colors">
                      <td className="px-6 py-4 flex items-center gap-3">
                        {u.avatar ? (
                          <img src={u.avatar} alt={u.name} className="h-8 w-8 rounded-lg object-cover border border-border-subtle" />
                        ) : (
                          <div className="h-8 w-8 rounded-lg bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center text-text-brand font-bold text-xs">
                            {u.name ? u.name[0].toUpperCase() : u.email[0].toUpperCase()}
                          </div>
                        )}
                        <span className="font-medium text-text-primary">{u.name || 'User'}</span>
                      </td>
                      <td className="px-6 py-4 text-text-muted">{u.email}</td>
                      <td className="px-6 py-4">
                        <select
                          value={u.systemRole}
                          disabled={updatingUserId === u._id}
                          onChange={(e) => handleRoleChange(u._id, e.target.value)}
                          className="bg-bg-input border border-border-default text-text-primary text-xs rounded-xl px-3 py-1.5 focus:outline-none focus:border-border-brand transition-colors"
                        >
                          <option value="SUPER_ADMIN">System Super Admin</option>
                          <option value="PLATFORM_ADMIN">Platform Admin</option>
                          <option value="MEDIA_MANAGER">Compliance and Media Manager</option>
                          <option value="PLATFORM_USER">Platform User</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 text-text-muted text-xs">
                        {new Date(u.createdAt).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
