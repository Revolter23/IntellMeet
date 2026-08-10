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

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card } from "@/components/ui/card"

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
      const res = await api.get('/meetings/history');
      const meetings = res.data.meetings || [];
      const meetingsWithActions = meetings.filter((m: any) => m.actionItems && m.actionItems.length > 0);
      setMeetingsList(meetingsWithActions);

      if (meetingsWithActions.length > 0) {
        setSelectedMeetingId(meetingsWithActions[0]._id);
        if (meetingsWithActions[0].actionItems.length > 0) {
          setSelectedActionItemId(meetingsWithActions[0].actionItems[0]._id);
        }
      }
    } catch (err) {
      console.error("Error fetching meetings for action items import:", err);
    }
  };

  const handleImportActionItemSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMeetingId || !selectedActionItemId || !board) return;

    const selectedMtg = meetingsList.find(m => m._id === selectedMeetingId);
    const selectedItem = selectedMtg?.actionItems?.find((ai: any) => ai._id === selectedActionItemId);

    if (!selectedItem) return;

    setActionLoading(true);
    try {
      const assignees = actionItemAssigneeId ? [actionItemAssigneeId] : [];
      await createTask({
        boardId: board._id,
        columnId: actionItemColumnId,
        title: `[Meeting Action] ${selectedItem.task}`,
        description: `Extracted from meeting: ${selectedMtg.title}. ${selectedItem.assigneeName ? `Original assignee: ${selectedItem.assigneeName}` : ''}`,
        priority: actionItemPriority,
        assignees: assignees
      });

      setShowImportModal(false);
    } catch (err) {
      console.error("Error importing action item:", err);
    } finally {
      setActionLoading(false);
    }
  };

  useEffect(() => {
    if (activeWorkspace?._id) {
      fetchBoard(activeWorkspace._id);
    }
  }, [activeWorkspace?._id, fetchBoard]);

  useEffect(() => {
    if (!board?._id) return;

    socket = io('http://localhost:3000', {
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socket.on('connect', () => {
      socket?.emit('join:board', board._id);
    });

    socket.on('task:created', (newTask: Task) => {
      handleRealtimeTaskCreated(newTask);
    });

    socket.on('task:moved', (data: { taskId: string; columnId: string; position: number }) => {
      handleRealtimeTaskMoved({
        taskId: data.taskId,
        destinationColumnId: data.columnId,
        newPosition: data.position
      });
    });

    socket.on('task:deleted', (data: { taskId: string }) => {
      handleRealtimeTaskDeleted(data.taskId);
    });

    return () => {
      if (socket) {
        socket.emit('leave:board', board._id);
        socket.disconnect();
        socket = null;
      }
    };
  }, [board?._id, handleRealtimeTaskCreated, handleRealtimeTaskMoved, handleRealtimeTaskDeleted]);

  const handleDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination || !board?._id) return;

    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      return;
    }

    const columnId = destination.droppableId;
    const newPosition = destination.index;

    moveTaskOptimistic(draggableId, columnId, newPosition);

    try {
      await syncMoveTask(draggableId, columnId, newPosition, board._id);
      if (socket && board._id) {
        socket.emit('task:moved', {
          boardId: board._id,
          taskId: draggableId,
          columnId,
          position: newPosition,
        });
      }
    } catch (error) {
      console.error("Failed to move task:", error);
    }
  };

  const handleCreateBoardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBoardTitle.trim() || !activeWorkspace?._id) return;

    setActionLoading(true);
    try {
      await createBoard(activeWorkspace._id, newBoardTitle.trim(), newBoardDesc.trim());
      setNewBoardTitle('');
      setNewBoardDesc('');
      setShowBoardModal(false);
    } catch (err) {
      console.error("Error creating board:", err);
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteBoard = async () => {
    if (!board?._id) return;
    if (confirm(`Are you sure you want to delete the board "${board.title}"? All tasks inside will be deleted.`)) {
      try {
        await deleteBoard(board._id);
      } catch (err) {
        console.error("Error deleting board:", err);
      }
    }
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
      });

      setTaskTitle('');
      setTaskDesc('');
      setShowTaskModal(false);
    } catch (error) {
      console.error("Failed to create task:", error);
    } finally {
      setActionLoading(false);
    }
  };

  const columns = [
    { id: 'col-todo', title: 'To Do', color: 'var(--board-todo)' },
    { id: 'col-in-progress', title: 'In Progress', color: 'var(--board-in-progress)' },
    { id: 'col-review', title: 'Under Review', color: 'var(--board-review)' },
    { id: 'col-done', title: 'Completed', color: 'var(--board-done)' }
  ];

  const filteredTasks = tasks.filter((t) => {
    const matchesSearch = searchQuery === '' || 
      t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesPriority = priorityFilter === 'ALL' || t.priority === priorityFilter;

    return matchesSearch && matchesPriority;
  });

  const currentUserRole = activeWorkspace?.members.find(m => (typeof m.user === 'object' && m.user ? m.user._id === user?.id : m.user === user?.id))?.role;
  const isAdmin = currentUserRole === 'WORKSPACE_ADMIN' || currentUserRole === 'WORKSPACE_OWNER' || user?.systemRole === 'SUPER_ADMIN';
  const canManageBoards = isAdmin || currentUserRole === 'MEMBER';

  if (!activeWorkspace) {
    return (
      <Card className="p-8 text-center bg-bg-surface border border-border-default rounded-2xl space-y-3 shadow-md gap-0">
        <h3 className="text-xl font-bold text-text-primary">No Active Workspace Selected</h3>
        <p className="text-sm text-text-muted">Please select or create a team workspace first to access the Kanban Project Board.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <Card className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-bg-surface border border-border-default p-6 rounded-2xl shadow-md gap-0">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-brand-emerald/10 border border-brand-emerald/20 flex items-center justify-center text-brand-emerald">
              📋
            </div>
            <h1 className="text-2xl font-bold text-text-primary tracking-tight">Project Dashboard</h1>
          </div>
          <p className="text-sm text-text-muted">Kanban style project board for workspace <span className="font-semibold text-text-primary">{activeWorkspace.name}</span>.</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Board Selector */}
          {boards.length > 0 && (
            <select
              value={board?._id || ''}
              onChange={(e) => selectBoard(e.target.value)}
              className="bg-bg-input border border-border-default text-text-primary text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-border-brand font-medium"
            >
              {boards.map((b) => (
                <option key={b._id} value={b._id}>
                  📌 {b.title}
                </option>
              ))}
            </select>
          )}

          {canManageBoards && (
            <Button
              variant="outline"
              onClick={() => setShowBoardModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 bg-bg-surface-hover hover:bg-bg-surface border border-border-default text-brand-emerald font-medium text-sm rounded-xl transition-all cursor-pointer"
            >
              <PlusIcon />
              New Board
            </Button>
          )}

          <Button
            variant="outline"
            onClick={openImportModal}
            className="flex items-center gap-2 px-3.5 py-2 bg-brand-primary/10 hover:bg-brand-primary/20 border border-border-brand/20 text-text-brand font-medium text-sm rounded-xl transition-all cursor-pointer"
            title="Import an AI action item from recent meetings into this Kanban board"
          >
            ⚡ Import Action Item
          </Button>

          <Button
            onClick={() => {
              setTargetColumnId('col-todo');
              setShowTaskModal(true);
            }}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary hover:from-brand-primary-hover hover:to-brand-secondary text-text-inverse font-medium text-sm rounded-xl shadow-lg shadow-brand-primary/20 transition-all cursor-pointer"
          >
            <PlusIcon />
            Add Task Card
          </Button>
        </div>
      </Card>

      {/* Toolbar: Search, Filters & Delete Board */}
      <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-bg-surface/60 p-4 rounded-2xl border border-border-default backdrop-blur-xl">
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full md:w-auto">
          {/* Search bar using Shadcn Input */}
          <div className="relative w-full sm:w-64">
            <span className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none text-text-muted">
              <SearchIcon className="h-4 w-4" />
            </span>
            <Input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-1.5 bg-bg-input border-border-default rounded-xl text-xs text-text-primary placeholder:text-text-subtle focus-visible:border-border-brand"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="w-full sm:w-auto px-3 py-1.5 bg-bg-input border border-border-default rounded-xl text-xs text-text-secondary focus:outline-none focus:border-border-brand"
          >
            <option value="ALL">All Priorities</option>
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        {/* Active Board Meta & Delete Button */}
        <div className="flex items-center gap-4 text-xs text-text-muted w-full md:w-auto justify-between md:justify-end">
          <span>Active Board: <strong className="text-text-primary">{board?.title || 'Main Board'}</strong></span>
          {isAdmin && boards.length > 1 && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleDeleteBoard}
              className="p-1.5 text-text-muted hover:text-status-danger hover:bg-bg-surface-hover rounded-lg transition-colors cursor-pointer"
              title="Delete current Project Board"
            >
              <TrashIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="p-12 text-center text-text-muted">Loading project board...</div>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 sm:gap-6 overflow-x-auto pb-6 min-h-[550px] scroll-smooth snap-x sm:snap-none -mx-4 px-4 sm:mx-0 sm:px-0">
            {columns.map((col) => {
              const columnTasks = filteredTasks
                .filter((t) => t.columnId === col.id)
                .sort((a, b) => a.position - b.position);

              return (
                <div
                  key={col.id}
                  className="w-72 sm:w-80 flex-shrink-0 snap-center bg-bg-surface border border-border-default rounded-2xl p-4 backdrop-blur-xl flex flex-col shadow-sm"
                >
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-border-subtle">
                    <div className="flex items-center gap-2.5">
                      <span className="w-3 h-3 rounded-full" style={{ backgroundColor: col.color }} />
                      <h3 className="font-bold text-sm text-text-primary">{col.title}</h3>
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-bg-surface-hover text-text-muted">
                        {columnTasks.length}
                      </span>
                    </div>

                    <Button
                      variant="ghost"
                      size="icon-xs"
                      onClick={() => {
                        setTargetColumnId(col.id);
                        setShowTaskModal(true);
                      }}
                      className="p-1 text-text-muted hover:text-text-primary hover:bg-bg-surface-hover rounded-lg transition-colors cursor-pointer"
                      title="Add task to column"
                    >
                      <PlusIcon className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Task Droppable Column */}
                  <Droppable droppableId={col.id}>
                    {(provided: any, snapshot: any) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex-1 overflow-y-auto space-y-3 p-1 rounded-xl transition-colors min-h-[400px] ${
                          snapshot.isDraggingOver ? 'bg-brand-primary/10 border border-border-brand/30' : ''
                        }`}
                      >
                        {columnTasks.map((task, index) => (
                          <Draggable key={task._id} draggableId={task._id} index={index}>
                            {(provided: any, snapshot: any) => (
                              <Card
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`group bg-bg-app border border-border-default p-4 rounded-xl shadow-md transition-all gap-0 ${
                                  snapshot.isDragging ? 'border-border-brand shadow-brand scale-105 z-50' : 'hover:border-border-strong'
                                }`}
                              >
                                <div className="flex items-start justify-between gap-2 mb-2">
                                  <h4 className="font-semibold text-sm text-text-primary group-hover:text-text-brand transition-colors">
                                    {task.title}
                                  </h4>
                                  <Button
                                    variant="ghost"
                                    size="icon-xs"
                                    onClick={() => deleteTask(task._id)}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-text-muted hover:text-status-danger transition-all cursor-pointer"
                                    title="Delete task"
                                  >
                                    <TrashIcon className="h-3.5 w-3.5" />
                                  </Button>
                                </div>

                                {task.description && (
                                  <p className="text-xs text-text-muted line-clamp-2 leading-relaxed mb-3">
                                    {task.description}
                                  </p>
                                )}

                                <div className="flex items-center justify-between pt-2 border-t border-border-subtle text-xs">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                                    task.priority === 'URGENT' ? 'bg-status-danger/10 text-status-danger border border-status-danger/20' :
                                    task.priority === 'HIGH' ? 'bg-status-warning/10 text-status-warning border border-status-warning/20' :
                                    task.priority === 'MEDIUM' ? 'bg-brand-primary/10 text-text-brand border border-border-brand/20' :
                                    'bg-bg-surface-hover text-text-muted'
                                  }`}>
                                    {task.priority}
                                  </span>

                                  <div className="flex items-center gap-1">
                                    {task.assignees && task.assignees.length > 0 && task.assignees.map((a) => (
                                      a.avatar ? (
                                        <img key={a._id} src={a.avatar} alt={a.name} className="h-5 w-5 rounded-full object-cover border border-border-default" />
                                      ) : (
                                        <div key={a._id} className="h-5 w-5 rounded-full bg-brand-primary/20 text-text-brand text-[10px] font-bold flex items-center justify-center border border-border-brand/30">
                                          {a.name ? a.name[0].toUpperCase() : 'U'}
                                        </div>
                                      )
                                    ))}
                                  </div>
                                </div>
                              </Card>
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
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="bg-bg-modal border border-border-default rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl gap-0">
            <h3 className="text-lg font-bold text-text-primary">Create Project Dashboard</h3>
            <form onSubmit={handleCreateBoardSubmit} className="space-y-4">
              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-1">Board Title</Label>
                <Input
                  type="text"
                  required
                  placeholder="e.g. Sprint 12 Kanban"
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border-border-default rounded-xl text-sm text-text-primary focus-visible:border-border-brand"
                />
              </div>

              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-1">Description (Optional)</Label>
                <textarea
                  rows={2}
                  placeholder="Board purpose, goals, or milestone notes..."
                  value={newBoardDesc}
                  onChange={(e) => setNewBoardDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowBoardModal(false)}
                  className="px-4 py-2 bg-bg-surface-hover text-text-secondary text-xs font-medium rounded-xl hover:bg-bg-surface cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary text-text-inverse text-xs font-medium rounded-xl hover:opacity-90 cursor-pointer"
                >
                  {actionLoading ? 'Creating...' : 'Create Board'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Create Task Card */}
      {showTaskModal && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="bg-bg-modal border border-border-default rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl gap-0">
            <h3 className="text-lg font-bold text-text-primary">Create Kanban Task</h3>
            <form onSubmit={handleCreateTaskSubmit} className="space-y-4">
              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-1">Task Title</Label>
                <Input
                  type="text"
                  required
                  placeholder="Task title..."
                  value={taskTitle}
                  onChange={(e) => setTaskTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border-border-default rounded-xl text-sm text-text-primary focus-visible:border-border-brand"
                />
              </div>

              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-1">Target Column</Label>
                <select
                  value={targetColumnId}
                  onChange={(e) => setTargetColumnId(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
                >
                  {columns.map((c) => (
                    <option key={c.id} value={c.id}>{c.title}</option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-1">Priority</Label>
                <select
                  value={taskPriority}
                  onChange={(e) => setTaskPriority(e.target.value as any)}
                  className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div>
                <Label className="block text-xs font-semibold text-text-muted mb-1">Description</Label>
                <textarea
                  rows={3}
                  placeholder="Add details, acceptance criteria..."
                  value={taskDesc}
                  onChange={(e) => setTaskDesc(e.target.value)}
                  className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowTaskModal(false)}
                  className="px-4 py-2 bg-bg-surface-hover text-text-secondary text-xs font-medium rounded-xl hover:bg-bg-surface cursor-pointer"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary text-text-inverse text-xs font-medium rounded-xl hover:opacity-90 cursor-pointer"
                >
                  {actionLoading ? 'Creating...' : 'Create Card'}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Modal: Import Action Item as Kanban Task */}
      {showImportModal && (
        <div className="fixed inset-0 bg-bg-overlay backdrop-blur-md z-50 flex items-center justify-center p-4">
          <Card className="bg-bg-modal border border-border-default rounded-2xl p-6 max-w-md w-full space-y-4 shadow-2xl gap-0">
            <div className="flex items-center justify-between border-b border-border-subtle pb-3">
              <h3 className="text-base font-bold text-text-primary flex items-center gap-2">
                ⚡ Import Action Item from Meeting
              </h3>
              <Button
                variant="ghost"
                size="icon-xs"
                onClick={() => setShowImportModal(false)}
                className="text-text-muted hover:text-text-primary text-sm font-bold cursor-pointer"
              >
                ✕
              </Button>
            </div>

            {meetingsList.length === 0 ? (
              <p className="text-xs text-text-muted py-4 text-center">
                No recent meetings with extracted action items found.
              </p>
            ) : (
              <form onSubmit={handleImportActionItemSubmit} className="space-y-4">
                <div>
                  <Label className="block text-xs font-semibold text-text-muted mb-1">Select Meeting</Label>
                  <select
                    value={selectedMeetingId}
                    onChange={(e) => {
                      setSelectedMeetingId(e.target.value);
                      const m = meetingsList.find(item => item._id === e.target.value);
                      if (m && m.actionItems && m.actionItems.length > 0) {
                        setSelectedActionItemId(m.actionItems[0]._id);
                      }
                    }}
                    className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
                  >
                    {meetingsList.map((m) => (
                      <option key={m._id} value={m._id}>
                        {m.title} ({m.actionItems?.length || 0} items)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <Label className="block text-xs font-semibold text-text-muted mb-1">Select Action Item</Label>
                  <select
                    value={selectedActionItemId}
                    onChange={(e) => setSelectedActionItemId(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
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
                  <Label className="block text-xs font-semibold text-text-muted mb-1">Assign to Workspace Member</Label>
                  <select
                    value={actionItemAssigneeId}
                    onChange={(e) => setActionItemAssigneeId(e.target.value)}
                    className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
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
                    <Label className="block text-xs font-semibold text-text-muted mb-1">Target Column</Label>
                    <select
                      value={actionItemColumnId}
                      onChange={(e) => setActionItemColumnId(e.target.value)}
                      className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
                    >
                      {columns.map((c) => (
                        <option key={c.id} value={c.id}>{c.title}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="block text-xs font-semibold text-text-muted mb-1">Priority</Label>
                    <select
                      value={actionItemPriority}
                      onChange={(e) => setActionItemPriority(e.target.value as any)}
                      className="w-full px-3 py-2 bg-bg-input border border-border-default rounded-xl text-sm text-text-primary focus:outline-none focus:border-border-brand"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowImportModal(false)}
                    className="px-4 py-2 bg-bg-surface-hover text-text-secondary text-xs font-medium rounded-xl hover:bg-bg-surface cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={actionLoading}
                    className="px-4 py-2 bg-gradient-to-r from-brand-primary to-brand-secondary text-text-inverse text-xs font-medium rounded-xl hover:opacity-90 cursor-pointer"
                  >
                    {actionLoading ? 'Importing...' : 'Import & Assign Task'}
                  </Button>
                </div>
              </form>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}
