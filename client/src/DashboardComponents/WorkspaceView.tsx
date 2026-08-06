import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import type { WorkspaceRole } from '../store/useWorkspaceStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router';
import { UsersIcon, SettingsIcon, PlusIcon, TrashIcon } from '../lib/icons';

const ALL_PERMISSIONS = [
  { key: 'CREATE_MEETING', label: 'Create Meetings' },
  { key: 'CREATE_TASK', label: 'Create Kanban Tasks' },
  { key: 'MANAGE_BOARDS', label: 'Manage Project Boards' },
  { key: 'INVITE_MEMBERS', label: 'Invite Workspace Members' },
  { key: 'DELETE_TASKS', label: 'Delete Tasks' }
];

export default function WorkspaceView() {
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const { 
    workspaces, 
    activeWorkspace, 
    fetchWorkspaces, 
    setActiveWorkspace, 
    createWorkspace, 
    addMember,
    updateMemberPermissions,
    removeMember,
    isLoading 
  } = useWorkspaceStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [editingMember, setEditingMember] = useState<any | null>(null);

  const [wsName, setWsName] = useState('');
  const [wsDesc, setWsDesc] = useState('');

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<WorkspaceRole>('MEMBER');
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([
    'CREATE_MEETING', 'CREATE_TASK'
  ]);

  const [errorMsg, setErrorMsg] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    fetchWorkspaces();
  }, []);

  // Determine current user's role in active workspace
  const currentUserMember = activeWorkspace?.members.find(
    m => (typeof m.user === 'object' && m.user ? m.user._id === user?.id : m.user === user?.id)
  );
  const isOwner = activeWorkspace?.owner._id === user?.id || currentUserMember?.role === 'WORKSPACE_OWNER';
  const isAdmin = isOwner || currentUserMember?.role === 'WORKSPACE_ADMIN';
  const isGuest = currentUserMember?.role === 'GUEST';

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wsName.trim()) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await createWorkspace(wsName.trim(), wsDesc.trim());
      setShowCreateModal(false);
      setWsName('');
      setWsDesc('');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to create workspace');
    } finally {
      setActionLoading(false);
    }
  };

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeWorkspace) return;
    setActionLoading(true);
    setErrorMsg('');
    try {
      await addMember(activeWorkspace._id, inviteEmail.trim(), inviteRole, selectedPermissions);
      setShowInviteModal(false);
      setInviteEmail('');
      setInviteRole('MEMBER');
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to add team member');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUpdatePermissionsSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember || !activeWorkspace) return;
    setActionLoading(true);
    try {
      await updateMemberPermissions(
        activeWorkspace._id,
        editingMember.user._id,
        editingMember.role,
        editingMember.customPermissions
      );
      setEditingMember(null);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to update member permissions');
    } finally {
      setActionLoading(false);
    }
  };

  const togglePermission = (key: string, list: string[], setList: (v: string[]) => void) => {
    if (list.includes(key)) {
      setList(list.filter(k => k !== key));
    } else {
      setList([...list, key]);
    }
  };

  return (
    <div className="space-y-8">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-violet-600/10 border border-violet-500/20 text-violet-400">
              <UsersIcon />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Team Workspace</h1>
          </div>
          <p className="text-sm text-slate-400">Collaborate with team members, configure RBAC capabilities, and manage projects.</p>
        </div>

        <div className="flex items-center gap-3">
          {workspaces.length > 0 && (
            <select
              value={activeWorkspace?._id || ''}
              onChange={(e) => {
                const target = workspaces.find(w => w._id === e.target.value);
                if (target) setActiveWorkspace(target);
              }}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-indigo-500"
            >
              {workspaces.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name} ({w.owner._id === user?.id ? 'Owner' : 'Member'})
                </option>
              ))}
            </select>
          )}

          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <PlusIcon />
            New Workspace
          </button>
        </div>
      </div>

      {/* No Workspace Prompt */}
      {workspaces.length === 0 && !isLoading && (
        <div className="p-12 text-center bg-slate-900/40 border border-slate-900 rounded-2xl backdrop-blur-xl max-w-xl mx-auto space-y-4">
          <div className="h-14 w-14 rounded-2xl bg-indigo-600/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto text-2xl">
            🏢
          </div>
          <h2 className="text-xl font-bold text-white">No Team Workspace Found</h2>
          <p className="text-sm text-slate-400 leading-relaxed">
            Create a workspace to start collaborating on meetings, managing Kanban project boards, and setting up team RBAC roles.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-violet-600 text-white font-medium text-sm rounded-xl shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            Create Your First Workspace
          </button>
        </div>
      )}

      {/* Active Workspace View */}
      {activeWorkspace && (
        <div className="space-y-8">
          {/* Workspace Details Banner */}
          <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-900 backdrop-blur-xl flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold text-white">{activeWorkspace.name}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isOwner ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                  isAdmin ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                  isGuest ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                  'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                }`}>
                  Role: {isOwner ? 'Workspace Owner' : isAdmin ? 'Workspace Admin' : isGuest ? 'Guest (Restricted)' : 'Member'}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">{activeWorkspace.description || 'No description provided.'}</p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/workspace/board')}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-sm font-medium rounded-xl transition-all cursor-pointer"
              >
                Open Project Board 📋
              </button>

              {isAdmin && (
                <button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium text-sm rounded-xl transition-all cursor-pointer"
                >
                  <PlusIcon />
                  Invite Member
                </button>
              )}
            </div>
          </div>

          {/* Member List & RBAC Capabilities */}
          <div className="bg-slate-900/40 border border-slate-900 rounded-2xl overflow-hidden backdrop-blur-xl">
            <div className="p-6 border-b border-slate-900 flex items-center justify-between">
              <h3 className="font-bold text-base text-white">Team Members & Permissions</h3>
              <span className="text-xs text-slate-500">{activeWorkspace.members.length} members</span>
            </div>

            <div className="divide-y divide-slate-900">
              {activeWorkspace.members.map((m) => {
                const memberUser = m.user;
                const memberIsOwner = activeWorkspace.owner._id === memberUser._id || m.role === 'WORKSPACE_OWNER';

                return (
                  <div key={m._id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-slate-900/30 transition-colors">
                    <div className="flex items-center gap-4">
                      {memberUser.avatar ? (
                        <img src={memberUser.avatar} alt={memberUser.name} className="h-10 w-10 rounded-xl object-cover" />
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-violet-500/20 border border-indigo-500/20 flex items-center justify-center font-bold text-indigo-300 text-sm">
                          {memberUser.name ? memberUser.name[0].toUpperCase() : memberUser.email[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-200">{memberUser.name || 'User'}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            memberIsOwner ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                            m.role === 'WORKSPACE_ADMIN' ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20' :
                            m.role === 'GUEST' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                            'bg-slate-800 text-slate-300'
                          }`}>
                            {m.role.replace('WORKSPACE_', '')}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 mt-0.5">{memberUser.email}</p>
                      </div>
                    </div>

                    {/* Active Permission Capabilities */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {memberIsOwner ? (
                        <span className="text-xs text-indigo-400 font-medium bg-indigo-500/10 border border-indigo-500/20 px-2.5 py-1 rounded-lg">
                          Full Owner Access
                        </span>
                      ) : m.customPermissions && m.customPermissions.length > 0 ? (
                        m.customPermissions.map((perm) => (
                          <span key={perm} className="text-[11px] font-semibold text-slate-300 bg-slate-800/80 border border-slate-700/50 px-2 py-0.5 rounded-md">
                            {perm.replace('_', ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500 italic">No custom capabilities assigned</span>
                      )}

                      {isOwner && !memberIsOwner && (
                        <button
                          onClick={() => setEditingMember({ ...m, role: m.role, customPermissions: m.customPermissions || [] })}
                          className="ml-3 p-1.5 text-slate-400 hover:text-indigo-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer text-xs"
                          title="Edit Permissions"
                        >
                          <SettingsIcon />
                        </button>
                      )}

                      {isAdmin && !memberIsOwner && (
                        <button
                          onClick={async () => {
                            if (confirm(`Remove ${memberUser.name || memberUser.email} from workspace?`)) {
                              try {
                                await removeMember(activeWorkspace._id, memberUser._id);
                              } catch (err: any) {
                                alert(err.response?.data?.message || 'Failed to remove member');
                              }
                            }
                          }}
                          className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer text-xs ml-1"
                          title="Remove Member"
                        >
                          <TrashIcon />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create Workspace */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Create Team Workspace</h3>
            {errorMsg && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">{errorMsg}</p>}
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Workspace Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Engineering Team"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="What does this workspace focus on?"
                  value={wsDesc}
                  onChange={(e) => setWsDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-medium rounded-xl hover:opacity-90"
                >
                  {actionLoading ? 'Creating...' : 'Create Workspace'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Invite Member */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Invite Team Member</h3>
            {errorMsg && <p className="text-xs text-rose-400 bg-rose-500/10 p-2.5 rounded-xl border border-rose-500/20">{errorMsg}</p>}
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">User Email Address</label>
                <input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Workspace Role</label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="WORKSPACE_ADMIN">Workspace Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="GUEST">Guest (Restricted View)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Permission Capabilities</label>
                <div className="space-y-2">
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(p.key)}
                        onChange={() => togglePermission(p.key, selectedPermissions, setSelectedPermissions)}
                        className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-xl hover:bg-indigo-500"
                >
                  {actionLoading ? 'Inviting...' : 'Add Member'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Edit Member Permissions */}
      {editingMember && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Edit Member Permissions</h3>
            <form onSubmit={handleUpdatePermissionsSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Role Tier</label>
                <select
                  value={editingMember.role}
                  onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value as WorkspaceRole })}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="WORKSPACE_OWNER">Workspace Owner</option>
                  <option value="WORKSPACE_ADMIN">Workspace Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="GUEST">Guest (Restricted)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-2">Custom Capabilities</label>
                <div className="space-y-2">
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingMember.customPermissions.includes(p.key)}
                        onChange={() => {
                          const list = editingMember.customPermissions;
                          const next = list.includes(p.key) ? list.filter((k: string) => k !== p.key) : [...list, p.key];
                          setEditingMember({ ...editingMember, customPermissions: next });
                        }}
                        className="rounded border-slate-800 bg-slate-950 text-indigo-600 focus:ring-0"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-indigo-600 text-white text-xs font-medium rounded-xl hover:bg-indigo-500"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
