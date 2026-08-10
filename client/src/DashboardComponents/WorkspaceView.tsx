import { useEffect, useState } from 'react';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import type { WorkspaceRole } from '../store/useWorkspaceStore';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router';
import { UsersIcon, SettingsIcon, PlusIcon, TrashIcon } from '../lib/icons';

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

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
      alert(err.response?.data?.message || 'Failed to update permissions');
    } finally {
      setActionLoading(false);
    }
  };

  const togglePermission = (key: string, list: string[], setList: (l: string[]) => void) => {
    if (list.includes(key)) {
      setList(list.filter(k => k !== key));
    } else {
      setList([...list, key]);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-surface border border-border-default p-6 rounded-2xl shadow-md gap-0">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-primary/10 border border-border-brand/20 flex items-center justify-center text-text-brand">
              <UsersIcon />
            </div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Team Workspace Hub</h1>
          </div>
          <p className="text-sm text-text-muted">Collaborate with team members, configure RBAC capabilities, and manage projects.</p>
        </div>

        <div className="flex items-center gap-3">
          {workspaces.length > 0 && (
            <select
              value={activeWorkspace?._id || ''}
              onChange={(e) => {
                const target = workspaces.find(w => w._id === e.target.value);
                if (target) setActiveWorkspace(target);
              }}
              className="bg-bg-input border border-border-default text-text-primary text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-border-brand"
            >
              {workspaces.map((w) => (
                <option key={w._id} value={w._id}>
                  {w.name} ({w.owner._id === user?.id ? 'Owner' : 'Member'})
                </option>
              ))}
            </select>
          )}

          <Button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-text-inverse font-medium text-sm rounded-xl shadow-lg shadow-brand-primary/20 transition-all cursor-pointer"
          >
            <PlusIcon />
            New Workspace
          </Button>
        </div>
      </Card>

      {/* No Workspace Prompt */}
      {workspaces.length === 0 && !isLoading && (
        <Card className="p-12 text-center bg-bg-surface border border-border-default rounded-2xl max-w-xl mx-auto space-y-4 shadow-md gap-0">
          <div className="h-14 w-14 rounded-2xl bg-brand-primary/10 border border-border-brand/20 text-text-brand flex items-center justify-center mx-auto text-2xl">
            🏢
          </div>
          <h2 className="text-xl font-bold text-text-primary">No Team Workspace Found</h2>
          <p className="text-sm text-text-muted leading-relaxed">
            Create a workspace to start collaborating on meetings, managing Kanban project boards, and setting up team RBAC roles.
          </p>
          <Button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2.5 bg-gradient-to-r from-brand-primary to-brand-secondary text-text-inverse font-medium text-sm rounded-xl shadow-lg shadow-brand-primary/20 transition-all cursor-pointer"
          >
            Create Your First Workspace
          </Button>
        </Card>
      )}

      {/* Active Workspace View */}
      {activeWorkspace && (
        <div className="space-y-8">
          {/* Workspace Details Banner */}
          <Card className="p-6 rounded-2xl bg-bg-surface border border-border-default shadow-md flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-extrabold text-text-primary">{activeWorkspace.name}</h2>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider ${
                  isOwner ? 'bg-brand-primary/10 text-text-brand border border-border-brand/20' :
                  isAdmin ? 'bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20' :
                  isGuest ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' :
                  'bg-status-success/10 text-status-success border border-status-success/20'
                }`}>
                  Role: {isOwner ? 'Workspace Owner' : isAdmin ? 'Workspace Admin' : isGuest ? 'Guest (Restricted)' : 'Member'}
                </span>
              </div>
              <p className="text-xs text-text-muted mt-1">{activeWorkspace.description || 'No description provided.'}</p>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                onClick={() => navigate('/workspace/board')}
                className="px-4 py-2 bg-bg-surface-hover hover:bg-bg-app border border-border-default text-text-primary text-sm font-medium rounded-xl transition-all cursor-pointer"
              >
                Open Project Board 📋
              </Button>

              {isAdmin && (
                <Button
                  onClick={() => setShowInviteModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-text-inverse font-medium text-sm rounded-xl transition-all cursor-pointer shadow-md"
                >
                  <PlusIcon />
                  Invite Member
                </Button>
              )}
            </div>
          </Card>

          {/* Member List & RBAC Capabilities */}
          <Card className="bg-bg-surface border border-border-default rounded-2xl overflow-hidden shadow-md gap-0 p-0">
            <CardHeader className="p-6 border-b border-border-subtle flex flex-row items-center justify-between">
              <CardTitle className="font-bold text-base text-text-primary">Team Members & Permissions</CardTitle>
              <span className="text-xs text-text-muted">{activeWorkspace.members.length} members</span>
            </CardHeader>

            <CardContent className="divide-y divide-border-subtle p-0">
              {activeWorkspace.members.map((m) => {
                const memberUser = m.user;
                const memberIsOwner = activeWorkspace.owner._id === memberUser._id || m.role === 'WORKSPACE_OWNER';

                return (
                  <div key={m._id} className="p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 hover:bg-bg-surface-hover/50 transition-colors">
                    <div className="flex items-center gap-4">
                      {memberUser.avatar ? (
                        <img src={memberUser.avatar} alt={memberUser.name} className="h-10 w-10 rounded-xl object-cover border border-border-subtle" />
                      ) : (
                        <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-brand-primary/20 to-brand-secondary/20 border border-border-brand/20 flex items-center justify-center font-bold text-text-brand text-sm">
                          {memberUser.name ? memberUser.name[0].toUpperCase() : memberUser.email[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-text-primary">{memberUser.name || 'User'}</span>
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                            memberIsOwner ? 'bg-brand-primary/10 text-text-brand border border-border-brand/20' :
                            m.role === 'WORKSPACE_ADMIN' ? 'bg-brand-secondary/10 text-brand-secondary border border-brand-secondary/20' :
                            m.role === 'GUEST' ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' :
                            'bg-bg-surface-hover text-text-secondary'
                          }`}>
                            {m.role.replace('WORKSPACE_', '')}
                          </span>
                        </div>
                        <p className="text-xs text-text-muted mt-0.5">{memberUser.email}</p>
                      </div>
                    </div>

                    {/* Active Permission Capabilities */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      {memberIsOwner ? (
                        <span className="text-xs text-text-brand font-medium bg-brand-primary/10 border border-border-brand/20 px-2.5 py-1 rounded-lg">
                          Full Owner Access
                        </span>
                      ) : m.customPermissions && m.customPermissions.length > 0 ? (
                        m.customPermissions.map((perm) => (
                          <span key={perm} className="text-[11px] font-semibold text-text-secondary bg-bg-surface-hover border border-border-subtle px-2 py-0.5 rounded-md">
                            {perm.replace('_', ' ')}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-text-muted italic">No custom capabilities assigned</span>
                      )}

                      {isOwner && !memberIsOwner && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setEditingMember({ ...m, role: m.role, customPermissions: m.customPermissions || [] })}
                          className="ml-3 p-1.5 text-text-muted hover:text-text-brand hover:bg-bg-surface-hover rounded-lg transition-colors cursor-pointer text-xs"
                          title="Edit Permissions"
                        >
                          <SettingsIcon />
                        </Button>
                      )}

                      {isAdmin && !memberIsOwner && (
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={async () => {
                            if (confirm(`Remove ${memberUser.name || memberUser.email} from workspace?`)) {
                              try {
                                await removeMember(activeWorkspace._id, memberUser._id);
                              } catch (err: any) {
                                alert(err.response?.data?.message || 'Failed to remove member');
                              }
                            }
                          }}
                          className="p-1.5 text-text-muted hover:text-status-danger hover:bg-bg-surface-hover rounded-lg transition-colors cursor-pointer text-xs ml-1"
                          title="Remove Member"
                        >
                          <TrashIcon />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Modal: Create Workspace */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="bg-bg-modal border border-border-default rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl gap-0">
            <h3 className="text-lg font-bold text-text-primary">Create Team Workspace</h3>
            {errorMsg && <p className="text-xs text-status-danger bg-status-danger/10 p-2.5 rounded-xl border border-status-danger/20">{errorMsg}</p>}
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-1">Workspace Name</Label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Engineering Team"
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border-border-default rounded-xl text-sm text-text-primary focus-visible:border-border-brand"
                />
              </div>
              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-1">Description (Optional)</Label>
                <textarea
                  rows={2}
                  placeholder="What does this workspace focus on?"
                  value={wsDesc}
                  onChange={(e) => setWsDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
                />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 bg-bg-surface-hover text-text-secondary text-xs font-medium rounded-xl hover:bg-bg-surface cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary text-text-inverse text-xs font-medium rounded-xl hover:opacity-90 cursor-pointer"
                >
                  {actionLoading ? 'Creating...' : 'Create Workspace'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Invite Member */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="bg-bg-modal border border-border-default rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl gap-0">
            <h3 className="text-lg font-bold text-text-primary">Invite Team Member</h3>
            {errorMsg && <p className="text-xs text-status-danger bg-status-danger/10 p-2.5 rounded-xl border border-status-danger/20">{errorMsg}</p>}
            <form onSubmit={handleInviteSubmit} className="space-y-4">
              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-1">User Email Address</Label>
                <Input
                  type="email"
                  required
                  placeholder="colleague@company.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border-border-default rounded-xl text-sm text-text-primary focus-visible:border-border-brand"
                />
              </div>
              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-1">Workspace Role</Label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as WorkspaceRole)}
                  className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
                >
                  <option value="WORKSPACE_ADMIN">Workspace Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="GUEST">Guest (Restricted View)</option>
                </select>
              </div>

              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-2">Permission Capabilities</Label>
                <div className="space-y-2">
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedPermissions.includes(p.key)}
                        onChange={() => togglePermission(p.key, selectedPermissions, setSelectedPermissions)}
                        className="rounded border-border-default bg-bg-input text-brand-primary focus:ring-0"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowInviteModal(false)}
                  className="px-4 py-2 bg-bg-surface-hover text-text-secondary text-xs font-medium rounded-xl hover:bg-bg-surface cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-text-inverse text-xs font-medium rounded-xl transition-all cursor-pointer"
                >
                  {actionLoading ? 'Inviting...' : 'Add Member'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Edit Member Permissions */}
      {editingMember && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="bg-bg-modal border border-border-default rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl gap-0">
            <h3 className="text-lg font-bold text-text-primary">Edit Member Permissions</h3>
            <form onSubmit={handleUpdatePermissionsSubmit} className="space-y-4">
              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-1">Role Tier</Label>
                <select
                  value={editingMember.role}
                  onChange={(e) => setEditingMember({ ...editingMember, role: e.target.value as WorkspaceRole })}
                  className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
                >
                  <option value="WORKSPACE_OWNER">Workspace Owner</option>
                  <option value="WORKSPACE_ADMIN">Workspace Admin</option>
                  <option value="MEMBER">Member</option>
                  <option value="GUEST">Guest (Restricted)</option>
                </select>
              </div>

              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-2">Custom Capabilities</Label>
                <div className="space-y-2">
                  {ALL_PERMISSIONS.map((p) => (
                    <label key={p.key} className="flex items-center gap-2.5 text-xs text-text-secondary cursor-pointer">
                      <input
                        type="checkbox"
                        checked={editingMember.customPermissions.includes(p.key)}
                        onChange={() => {
                          const list = editingMember.customPermissions;
                          const next = list.includes(p.key) ? list.filter((k: string) => k !== p.key) : [...list, p.key];
                          setEditingMember({ ...editingMember, customPermissions: next });
                        }}
                        className="rounded border-border-default bg-bg-input text-brand-primary focus:ring-0"
                      />
                      {p.label}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingMember(null)}
                  className="px-4 py-2 bg-bg-surface-hover text-text-secondary text-xs font-medium rounded-xl hover:bg-bg-surface cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-text-inverse text-xs font-medium rounded-xl transition-all cursor-pointer"
                >
                  Save Changes
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
