import { useEffect, useState } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import type { DropResult } from '@hello-pangea/dnd';
import { useBoardStore } from '../store/useBoardStore';
import type { Task } from '../store/useBoardStore';
import { useWorkspaceStore } from '../store/useWorkspaceStore';
import { useAuthStore } from '../store/useAuthStore';
import { io, Socket } from 'socket.io-client';
import { api } from '../lib/api';
import { PlusIcon, TrashIcon, SearchIcon } from '../lib/icons';

let socket: Socket | null = null;

export default function ProjectBoardView() {
  const { user } = useAuthStore();
  const { activeWorkspace } = useWorkspaceStore();
  const { 
    boards,
    board, 
    tasks, 
    fetchBoard, 
    selectBoard,
    createBoard,
    deleteBoard,
    createTask, 
    moveTaskOptimistic, 
    syncMoveTask, 
    deleteTask,
    handleRealtimeTaskCreated,
    handleRealtimeTaskMoved,
    handleRealtimeTaskDeleted,
    isLoading 
  } = useBoardStore();

  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showBoardModal, setShowBoardModal] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDesc, setTaskDesc] = useState('');
  const [taskPriority, setTaskPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('MEDIUM');
  const [targetColumnId, setTargetColumnId] = useState('col-todo');

  const [newBoardTitle, setNewBoardTitle] = useState('');
  const [newBoardDesc, setNewBoardDesc] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');

  // Action item import modal states
  const [showImportModal, setShowImportModal] = useState(false);
  const [meetingsList, setMeetingsList] = useState<any[]>([]);
  const [selectedMeetingId, setSelectedMeetingId] = useState('');
  const [selectedActionItemId, setSelectedActionItemId] = useState('');
  const [actionItemAssigneeId, setActionItemAssigneeId] = useState('');
  const [actionItemPriority, setActionItemPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'>('HIGH');
  const [actionItemColumnId, setActionItemColumnId] = useState('col-todo');

  const [actionLoading, setActionLoading] = useState(false);

  const openImportModal = async () => {
    setShowImportModal(true);
    try {
      const res = await api.get('/meetings');
      const meetingsData = res.data.meetings || res.data || [];
      const meetingsWithActions = meetingsData.filter((m: any) => m.actionItems && m.actionItems.length > 0);
      setMeetingsList(meetingsWithActions);
      if (meetingsWithActions.length > 0) {
        setSelectedMeetingId(meetingsWithActions[0]._id);
        if (meetingsWithActions[0].actionItems.length > 0) {
          setSelectedActionItemId(meetingsWithActions[0].actionItems[0]._id);
        }
      }
    } catch (err) {
      console.error("Error fetching meetings for import:", err);
    }
  };

  const handleImportActionItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace || !board || !selectedMeetingId || !selectedActionItemId) return;

    const targetMeeting = meetingsList.find(m => m._id === selectedMeetingId);
    const targetItem = targetMeeting?.actionItems?.find((ai: any) => ai._id === selectedActionItemId);
    if (!targetItem) return;

    setActionLoading(true);
    try {
      await api.post('/api/boards/tasks/from-action-item', {
        workspaceId: activeWorkspace._id,
        boardId: board._id,
        columnId: actionItemColumnId,
        title: targetItem.task,
        description: `Imported from meeting: ${targetMeeting.title}`,
        priority: actionItemPriority,
        assigneeId: actionItemAssigneeId || undefined,
        meetingId: selectedMeetingId,
        actionItemId: selectedActionItemId
      });

      setShowImportModal(false);
      fetchBoard(activeWorkspace._id, board._id);
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to import action item as task card');
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (activeWorkspace) {
      fetchBoard(activeWorkspace._id);
    }
  }, [activeWorkspace?._id]);

  useEffect(() => {
    if (!board?._id) return;

    if (!socket) {
      socket = io('http://localhost:3000', { withCredentials: true });
    }

    socket.emit('join:board', board._id);

    socket.on('task:created', (newTask: Task) => {
      handleRealtimeTaskCreated(newTask);
    });

    socket.on('task:moved', (data: any) => {
      handleRealtimeTaskMoved(data);
    });

    socket.on('task:deleted', ({ taskId }: { taskId: string }) => {
      handleRealtimeTaskDeleted(taskId);
    });

    return () => {
      if (socket && board?._id) {
        socket.emit('leave:board', board._id);
        socket.off('task:created');
        socket.off('task:moved');
        socket.off('task:deleted');
      }
    };
  }, [board?._id]);

  const currentUserMember = activeWorkspace?.members.find(
    m => (typeof m.user === 'object' && m.user ? m.user._id === user?.id : m.user === user?.id)
  );
  const isOwner = activeWorkspace?.owner._id === user?.id || currentUserMember?.role === 'WORKSPACE_OWNER';
  const isAdmin = isOwner || currentUserMember?.role === 'WORKSPACE_ADMIN';
  const canManageBoards = isAdmin || currentUserMember?.customPermissions?.includes('MANAGE_BOARDS');

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;
    if (!destination || !board?._id) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    moveTaskOptimistic(draggableId, destination.droppableId, destination.index);
    syncMoveTask(draggableId, destination.droppableId, destination.index, board._id);
  };

  const handleCreateTaskSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim() || !board?._id) return;

    setActionLoading(true);
    try {
      await createTask({
        boardId: board._id,
        columnId: targetColumnId,
        title: taskTitle.trim(),
        description: taskDesc.trim(),
        priority: taskPriority,
        assignees: user ? [{ _id: user.id, email: user.email, name: user.name, avatar: user.avatar }] : []
      });
      setShowTaskModal(false);
      setTaskTitle('');
      setTaskDesc('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create task card');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateBoardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardTitle.trim() || !activeWorkspace) return;

    setActionLoading(true);
    try {
      await createBoard(activeWorkspace._id, newBoardTitle.trim(), newBoardDesc.trim());
      setShowBoardModal(false);
      setNewBoardTitle('');
      setNewBoardDesc('');
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to create Project Dashboard');
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBoard = async () => {
    if (!board?._id) return;
    if (confirm(`Are you sure you want to delete project board "${board.title}"?`)) {
      try {
        await deleteBoard(board._id);
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to delete Project Dashboard');
      }
    }
  };

  if (!activeWorkspace) {
    return (
      <div className="p-12 text-center bg-slate-900/40 border border-slate-900 rounded-2xl backdrop-blur-xl">
        <h2 className="text-xl font-bold text-white mb-2">No Active Workspace</h2>
        <p className="text-sm text-slate-400">Please select or create a team workspace first to access Kanban project dashboards.</p>
      </div>
    );
  }

  const columns = board?.columns || [
    { id: 'col-todo', title: 'To Do', position: 0, color: '#6366f1' },
    { id: 'col-in-progress', title: 'In Progress', position: 1, color: '#d97706' },
    { id: 'col-review', title: 'Under Review', position: 2, color: '#a855f7' },
    { id: 'col-done', title: 'Done', position: 3, color: '#10b981' }
  ];

  // Task filtering
  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = !searchQuery || t.title.toLowerCase().includes(searchQuery.toLowerCase()) || (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;
    return matchesSearch && matchesPriority;
  });

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-900 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-xl bg-emerald-600/10 border border-emerald-500/20 text-emerald-400">
              📋
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Project Dashboard</h1>
          </div>
          <p className="text-sm text-slate-400">Kanban style project board for workspace <span className="font-semibold text-slate-200">{activeWorkspace.name}</span>.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Board Selector */}
          {boards.length > 0 && (
            <select
              value={board?._id || ''}
              onChange={(e) => selectBoard(e.target.value)}
              className="bg-slate-900 border border-slate-800 text-slate-200 text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-emerald-500 font-medium"
            >
              {boards.map((b) => (
                <option key={b._id} value={b._id}>
                  📌 {b.title}
                </option>
              ))}
            </select>
          )}

          {canManageBoards && (
            <button
              onClick={() => setShowBoardModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 text-emerald-400 font-medium text-sm rounded-xl transition-all cursor-pointer"
            >
              <PlusIcon />
              New Board
            </button>
          )}

          <button
            onClick={openImportModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-400 font-medium text-sm rounded-xl transition-all cursor-pointer"
            title="Import an AI action item from recent meetings into this Kanban board"
          >
            ⚡ Import Action Item
          </button>

          <button
            onClick={() => {
              setTargetColumnId('col-todo');
              setShowTaskModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-medium text-sm rounded-xl shadow-lg shadow-emerald-600/20 transition-all cursor-pointer"
          >
            <PlusIcon />
            Add Task Card
          </button>
        </div>
      </div>

      {/* Toolbar: Search, Filters & Delete Board */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-slate-900/40 p-4 rounded-2xl border border-slate-900 backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search bar */}
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-slate-500">
              <SearchIcon className="h-4 w-4" />
            </span>
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        {/* Active Board Meta & Delete Button */}
        <div className="flex items-center gap-4 text-xs text-slate-400 w-full md:w-auto justify-between md:justify-end">
          <span>Active Board: <strong className="text-slate-200">{board?.title || 'Main Board'}</strong></span>
          {isAdmin && boards.length > 1 && (
            <button
              onClick={handleDeleteBoard}
              className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
              title="Delete current Project Board"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-slate-500">Loading project board...</div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-6 overflow-x-auto pb-6 min-h-[550px]">
            {columns.map((col) => {
              const columnTasks = filteredTasks
                .filter((t) => t.columnId === col.id)
                .sort((a, b) => a.position - b.position);

              return (
                <div
                  key={col.id}
                  className="w-80 flex-shrink-0 bg-slate-900/40 border border-slate-900 rounded-2xl p-4 backdrop-blur-xl flex flex-col"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/60">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
                      <h3 className="font-bold text-sm text-slate-200">{col.title}</h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-slate-800 text-slate-400">
                        {columnTasks.length}
                      </span>
                    </div>

                    <button
                      onClick={() => {
                        setTargetColumnId(col.id);
                        setShowTaskModal(true);
                      }}
                      className="p-1 text-slate-500 hover:text-slate-200 transition-colors cursor-pointer"
                      title="Add task to column"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Task Droppable Column */}
                  <Droppable droppableId={col.id}>
                    {(provided: any, snapshot: any) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto space-y-3 p-1 rounded-xl transition-colors min-h-[400px] ${
                          snapshot.isDraggingOver ? 'bg-indigo-950/20 border border-indigo-500/20' : ''
                        }`}
                      >
                        {columnTasks.map((task, index) => (
                          <Draggable key={task._id} draggableId={task._id} index={index}>
                            {(provided: any, snapshot: any) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`group bg-slate-900/90 border border-slate-850 p-4 rounded-xl shadow-lg transition-all ${
                                  snapshot.isDragging ? 'border-indigo-500 shadow-indigo-500/10 scale-105 z-50' : 'hover:border-slate-700'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h4 className="font-semibold text-sm text-slate-200 group-hover:text-indigo-300 transition-colors">
                                    {task.title}
                                  </h4>
                                  <button
                                    onClick={() => deleteTask(task._id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-slate-500 hover:text-rose-400 transition-all cursor-pointer"
                                    title="Delete task"
                                  >
                                    <TrashIcon className="h-3.5 w-3.5" />
                                  </button>
                                </div>

                                {task.description && (
                                  <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed mb-3">
                                    {task.description}
                                  </p>
                                )}

                                <div className="flex items-center justify-between pt-2 border-t border-slate-850 text-xs">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    task.priority === 'URGENT' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                                    task.priority === 'HIGH' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20' :
                                    task.priority === 'MEDIUM' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' :
                                    'bg-slate-800 text-slate-400'
                                  }`}>
                                    {task.priority}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    {task.assignees && task.assignees.length > 0 && task.assignees.map((a) => (
                                      a.avatar ? (
                                        <img key={a._id} src={a.avatar} alt={a.name} className="h-5 w-5 rounded-full object-cover border border-slate-700" />
                                      ) : (
                                        <div key={a._id} className="h-5 w-5 rounded-full bg-indigo-600/30 text-indigo-300 text-[10px] font-bold flex items-center justify-center border border-indigo-500/30">
                                          {a.name ? a.name[0].toUpperCase() : 'U'}
                                        </div>
                                      )
                                    ))}
                                  </div>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Modal: Create New Project Dashboard */}
      {showBoardModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Create Project Dashboard</h3>
            <form onSubmit={handleCreateBoardSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Board Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sprint 12 Kanban"
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description (Optional)</label>
                <textarea
                  rows={2}
                  placeholder="Board purpose, goals, or milestone notes..."
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowBoardModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-xs font-medium rounded-xl hover:opacity-90 cursor-pointer"
                >
                  {actionLoading ? 'Creating...' : 'Create Board'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Create Task Card */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <h3 className="text-lg font-bold text-white">Create Kanban Task</h3>
            <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Task Title</label>
                <input
                  type="text"
                  required
                  placeholder="Task title..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Target Column</label>
                <select
                  value={targetColumnId}
                  onChange={(e) => setTargetColumnId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-400 mb-1">Description</label>
                <textarea
                  rows={3}
                  placeholder="Add details, acceptance criteria..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-medium rounded-xl hover:opacity-90 cursor-pointer"
                >
                  {actionLoading ? 'Creating...' : 'Create Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Import Action Item as Kanban Task */}
      {showImportModal && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                ⚡ Import Action Item from Meeting
              </h3>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-500 hover:text-slate-300 text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {meetingsList.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                No recent meetings with extracted action items found.
              </p>
            ) : (
              <form onSubmit={handleImportActionItemSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Select Meeting</label>
                  <select
                    value={selectedMeetingId}
                    onChange={(e) => {
                      setSelectedMeetingId(e.target.value);
                      const m = meetingsList.find(item => item._id === e.target.value);
                      if (m && m.actionItems && m.actionItems.length > 0) {
                        setSelectedActionItemId(m.actionItems[0]._id);
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {meetingsList.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.title} ({m.actionItems?.length || 0} items)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Select Action Item</label>
                  <select
                    value={selectedActionItemId}
                    onChange={(e) => setSelectedActionItemId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    {meetingsList
                      .find((m) => m._id === selectedMeetingId)
                      ?.actionItems?.map((ai: any) => (
                        <option key={ai._id} value={ai._id}>
                          {ai.task} {ai.status === 'completed' ? '✓ (Completed)' : ''}
                        </option>
                      ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-400 mb-1">Assign to Workspace Member</label>
                  <select
                    value={actionItemAssigneeId}
                    onChange={(e) => setActionItemAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="">Unassigned (Open task)</option>
                    {activeWorkspace?.members.map((m) => {
                      const u = m.user;
                      if (!u) return null;
                      return (
                        <option key={u._id} value={u._id}>
                          {u.name || u.email} ({m.role ? m.role.replace('WORKSPACE_', '') : 'Member'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Target Column</label>
                    <select
                      value={actionItemColumnId}
                      onChange={(e) => setActionItemColumnId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-400 mb-1">Priority</label>
                    <select
                      value={actionItemPriority}
                      onChange={(e) => setActionItemPriority(e.target.value as any)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:border-indigo-500"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-slate-800 text-slate-300 text-xs font-medium rounded-xl hover:bg-slate-700 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-xs font-medium rounded-xl hover:opacity-90 cursor-pointer"
                  >
                    {actionLoading ? 'Importing...' : 'Import & Assign Task'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
