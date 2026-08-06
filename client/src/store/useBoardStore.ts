import { create } from 'zustand';
import { api } from '../lib/api';

export interface Column {
  id: string;
  title: string;
  position: number;
  color: string;
}

export interface Board {
  _id: string;
  workspace: string;
  title: string;
  description?: string;
  columns: Column[];
}

export interface Task {
  _id: string;
  board: string;
  columnId: string;
  title: string;
  description?: string;
  position: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignees: {
    _id: string;
    name?: string;
    email: string;
    avatar?: string;
  }[];
  dueDate?: string;
  labels?: { name: string; color: string }[];
  createdAt?: string;
}

interface BoardState {
  boards: Board[];
  board: Board | null;
  tasks: Task[];
  isLoading: boolean;
  fetchBoard: (workspaceId: string, boardId?: string) => Promise<void>;
  createBoard: (workspaceId: string, title: string, description?: string) => Promise<Board>;
  deleteBoard: (boardId: string) => Promise<void>;
  selectBoard: (boardId: string) => Promise<void>;
  createTask: (taskData: any) => Promise<void>;
  moveTaskOptimistic: (taskId: string, destinationColumnId: string, newPosition: number) => void;
  syncMoveTask: (taskId: string, destinationColumnId: string, newPosition: number, boardId: string) => Promise<void>;
  deleteTask: (taskId: string) => Promise<void>;
  handleRealtimeTaskCreated: (task: Task) => void;
  handleRealtimeTaskMoved: (data: { taskId: string; destinationColumnId: string; newPosition: number; task?: Task }) => void;
  handleRealtimeTaskDeleted: (taskId: string) => void;
}

export const useBoardStore = create<BoardState>((set, get) => ({
  boards: [],
  board: null,
  tasks: [],
  isLoading: false,

  fetchBoard: async (workspaceId: string, targetBoardId?: string) => {
    set({ isLoading: true });
    try {
      const url = targetBoardId 
        ? `/api/boards/workspace/${workspaceId}?boardId=${targetBoardId}`
        : `/api/boards/workspace/${workspaceId}`;
      const response = await api.get(url);
      set({
        boards: response.data.boards || [],
        board: response.data.board,
        tasks: response.data.tasks || [],
        isLoading: false
      });
    } catch (error) {
      console.error("Error fetching boards:", error);
      set({ isLoading: false });
    }
  },

  selectBoard: async (boardId: string) => {
    set({ isLoading: true });
    try {
      const response = await api.get(`/api/boards/${boardId}`);
      set({
        board: response.data.board,
        tasks: response.data.tasks || [],
        isLoading: false
      });
    } catch (error) {
      console.error("Error selecting board:", error);
      set({ isLoading: false });
    }
  },

  createBoard: async (workspaceId: string, title: string, description?: string) => {
    try {
      const response = await api.post('/api/boards', {
        workspaceId,
        title,
        description
      });
      const newBoard: Board = response.data;
      const currentBoards = get().boards;
      set({
        boards: [...currentBoards, newBoard],
        board: newBoard,
        tasks: []
      });
      return newBoard;
    } catch (error) {
      console.error("Error creating board:", error);
      throw error;
    }
  },

  deleteBoard: async (boardId: string) => {
    try {
      await api.delete(`/api/boards/${boardId}`);
      const remainingBoards = get().boards.filter(b => b._id !== boardId);
      const nextBoard = remainingBoards.length > 0 ? remainingBoards[0] : null;
      
      set({
        boards: remainingBoards,
        board: nextBoard,
        tasks: []
      });

      if (nextBoard) {
        await get().selectBoard(nextBoard._id);
      }
    } catch (error) {
      console.error("Error deleting board:", error);
      throw error;
    }
  },

  createTask: async (taskData: any) => {
    try {
      const response = await api.post('/api/boards/tasks', taskData);
      const newTask: Task = response.data;
      set((state) => ({
        tasks: [...state.tasks.filter(t => t._id !== newTask._id), newTask]
      }));
    } catch (error) {
      console.error("Error creating task:", error);
      throw error;
    }
  },

  moveTaskOptimistic: (taskId, destinationColumnId, newPosition) => {
    set((state) => {
      const cloned = [...state.tasks];
      const targetIdx = cloned.findIndex(t => t._id === taskId);
      if (targetIdx === -1) return state;

      const [movedTask] = cloned.splice(targetIdx, 1);
      movedTask.columnId = destinationColumnId;
      movedTask.position = newPosition;

      cloned.splice(newPosition, 0, movedTask);
      return { tasks: cloned };
    });
  },

  syncMoveTask: async (taskId, destinationColumnId, newPosition, boardId) => {
    try {
      await api.put(`/api/boards/tasks/${taskId}/move`, {
        destinationColumnId,
        newPosition,
        boardId
      });
    } catch (error) {
      console.error("Error syncing task move:", error);
    }
  },

  deleteTask: async (taskId) => {
    try {
      await api.delete(`/api/boards/tasks/${taskId}`);
      set((state) => ({
        tasks: state.tasks.filter(t => t._id !== taskId)
      }));
    } catch (error) {
      console.error("Error deleting task:", error);
      throw error;
    }
  },

  handleRealtimeTaskCreated: (newTask) => {
    set((state) => ({
      tasks: [...state.tasks.filter(t => t._id !== newTask._id), newTask]
    }));
  },

  handleRealtimeTaskMoved: ({ taskId, destinationColumnId, newPosition, task }) => {
    set((state) => {
      const cloned = [...state.tasks];
      const idx = cloned.findIndex(t => t._id === taskId);
      if (idx !== -1) {
        cloned[idx].columnId = destinationColumnId;
        cloned[idx].position = newPosition;
        if (task) cloned[idx] = task;
      }
      return { tasks: cloned };
    });
  },

  handleRealtimeTaskDeleted: (taskId) => {
    set((state) => ({
      tasks: state.tasks.filter(t => t._id !== taskId)
    }));
  }
}));
