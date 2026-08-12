import { create } from 'zustand';
import { api } from '../lib/api';

export type WorkspaceRole = 'WORKSPACE_OWNER' | 'WORKSPACE_ADMIN' | 'MEMBER' | 'GUEST';

export interface UserProfile {
  _id: string;
  name?: string;
  email: string;
  avatar?: string;
  systemRole?: string;
}

export interface WorkspaceMember {
  _id: string;
  user: UserProfile;
  role: WorkspaceRole;
  customPermissions: string[];
  joinedAt: string;
}

export interface Workspace {
  _id: string;
  name: string;
  description?: string;
  owner: {
    _id: string;
    name?: string;
    email: string;
    avatar?: string;
  };
  members: WorkspaceMember[];
  createdAt: string;
  updatedAt: string;
}

interface WorkspaceState {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  isLoading: boolean;
  userRoleInActiveWorkspace: WorkspaceRole | null;
  fetchWorkspaces: () => Promise<void>;
  setActiveWorkspace: (workspace: Workspace | null) => void;
  createWorkspace: (name: string, description?: string) => Promise<Workspace | null>;
  addMember: (workspaceId: string, email: string, role: WorkspaceRole, customPermissions: string[]) => Promise<void>;
  updateMemberPermissions: (workspaceId: string, memberUserId: string, role: WorkspaceRole, customPermissions: string[]) => Promise<void>;
  removeMember: (workspaceId: string, memberUserId: string) => Promise<void>;
}

export const useWorkspaceStore = create<WorkspaceState>((set, get) => ({
  workspaces: [],
  activeWorkspace: null,
  isLoading: false,
  userRoleInActiveWorkspace: null,

  fetchWorkspaces: async () => {
    set({ isLoading: true });
    try {
      const response = await api.get('/api/workspaces');
      const workspaces: Workspace[] = response.data;
      
      let active = get().activeWorkspace;
      if (workspaces.length > 0) {
        if (!active || !workspaces.find(w => w._id === active!._id)) {
          active = workspaces[0];
        }
      } else {
        active = null;
      }

      set({ workspaces, activeWorkspace: active, isLoading: false });
    } catch (error) {
      console.error("Error fetching workspaces:", error);
      set({ isLoading: false });
    }
  },

  setActiveWorkspace: (workspace) => {
    set({ activeWorkspace: workspace });
  },

  createWorkspace: async (name, description) => {
    try {
      const response = await api.post('/api/workspaces', { name, description });
      const newWs: Workspace = response.data.workspace;
      
      const currentList = get().workspaces;
      set({ 
        workspaces: [newWs, ...currentList],
        activeWorkspace: newWs
      });
      return newWs;
    } catch (error) {
      console.error("Error creating workspace:", error);
      throw error;
    }
  },

  addMember: async (workspaceId, email, role, customPermissions) => {
    try {
      const response = await api.post(`/api/workspaces/${workspaceId}/members`, {
        email,
        role,
        customPermissions
      });
      const updatedWs: Workspace = response.data.workspace;
      set((state) => ({
        workspaces: state.workspaces.map(w => w._id === workspaceId ? updatedWs : w),
        activeWorkspace: state.activeWorkspace?._id === workspaceId ? updatedWs : state.activeWorkspace
      }));
    } catch (error) {
      console.error("Error adding workspace member:", error);
      throw error;
    }
  },

  updateMemberPermissions: async (workspaceId, memberUserId, role, customPermissions) => {
    try {
      const response = await api.put(`/api/workspaces/${workspaceId}/members/${memberUserId}`, {
        role,
        customPermissions
      });
      const updatedWs: Workspace = response.data.workspace;
      set((state) => ({
        workspaces: state.workspaces.map(w => w._id === workspaceId ? updatedWs : w),
        activeWorkspace: state.activeWorkspace?._id === workspaceId ? updatedWs : state.activeWorkspace
      }));
    } catch (error) {
      console.error("Error updating member permissions:", error);
      throw error;
    }
  },

  removeMember: async (workspaceId, memberUserId) => {
    try {
      const response = await api.delete(`/api/workspaces/${workspaceId}/members/${memberUserId}`);
      const updatedWs: Workspace = response.data.workspace;
      set((state) => ({
        workspaces: state.workspaces.map(w => w._id === workspaceId ? updatedWs : w),
        activeWorkspace: state.activeWorkspace?._id === workspaceId ? updatedWs : state.activeWorkspace
      }));
    } catch (error) {
      console.error("Error removing member from workspace:", error);
      throw error;
    }
  }
}));
