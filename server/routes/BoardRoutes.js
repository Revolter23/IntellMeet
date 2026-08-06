import express from 'express';
import { Board } from '../models/BoardModel.js';
import { Task } from '../models/TaskModel.js';
import { Workspace, WORKSPACE_PERMISSIONS } from '../models/WorkspaceModel.js';
import { User } from '../models/UserModel.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspacePermission } from '../middleware/rbac.js';

const router = express.Router();

// Get all project boards for a Workspace (auto-creates default board if none exists)
router.get('/workspace/:workspaceId', authenticateToken, async (req, res) => {
    try {
        const workspace = await Workspace.findById(req.params.workspaceId);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const isMember = workspace.members.some(m => m.user.toString() === req.user.id) || workspace.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: 'Access denied to workspace boards' });
        }

        let boards = await Board.find({ workspace: req.params.workspaceId }).sort({ createdAt: 1 });
        if (boards.length === 0) {
            // Auto-create initial default board if it doesn't exist yet
            const defaultBoard = new Board({
                workspace: req.params.workspaceId,
                title: `${workspace.name} Main Board`,
                description: 'Main Kanban project dashboard for your team tasks',
                columns: [
                    { id: 'col-todo', title: 'To Do', position: 0, color: '#6366f1' },
                    { id: 'col-in-progress', title: 'In Progress', position: 1, color: '#d97706' },
                    { id: 'col-review', title: 'Under Review', position: 2, color: '#a855f7' },
                    { id: 'col-done', title: 'Done', position: 3, color: '#10b981' }
                ]
            });
            await defaultBoard.save();
            boards = [defaultBoard];
        }

        const selectedBoardId = req.query.boardId || boards[0]._id;
        const selectedBoard = boards.find(b => b._id.toString() === selectedBoardId.toString()) || boards[0];

        const tasks = await Task.find({ board: selectedBoard._id })
            .populate('assignees', 'name email avatar')
            .sort({ position: 1 });

        res.json({ boards, board: selectedBoard, tasks });
    } catch (error) {
        console.error("Get boards error:", error);
        res.status(500).json({ message: 'Error fetching project boards' });
    }
});

// Create a new Project Dashboard (Kanban style) (Requires MANAGE_BOARDS permission or WORKSPACE_OWNER / WORKSPACE_ADMIN)
router.post('/',
    authenticateToken,
    requireWorkspacePermission(WORKSPACE_PERMISSIONS.MANAGE_BOARDS, ['WORKSPACE_OWNER', 'WORKSPACE_ADMIN']),
    async (req, res) => {
        try {
            const { workspaceId, title, description, columns } = req.body;
            if (!workspaceId || !title) {
                return res.status(400).json({ message: 'workspaceId and title are required' });
            }

            const defaultColumns = [
                { id: 'col-todo', title: 'To Do', position: 0, color: '#6366f1' },
                { id: 'col-in-progress', title: 'In Progress', position: 1, color: '#d97706' },
                { id: 'col-review', title: 'Under Review', position: 2, color: '#a855f7' },
                { id: 'col-done', title: 'Done', position: 3, color: '#10b981' }
            ];

            const board = new Board({
                workspace: workspaceId,
                title,
                description: description || '',
                columns: columns && columns.length > 0 ? columns : defaultColumns
            });

            await board.save();

            res.status(201).json(board);
        } catch (error) {
            console.error("Create project board error:", error);
            res.status(500).json({ message: 'Error creating project dashboard' });
        }
    }
);

// Get specific project board details with tasks
router.get('/:boardId', authenticateToken, async (req, res) => {
    try {
        const board = await Board.findById(req.params.boardId);
        if (!board) {
            return res.status(404).json({ message: 'Project board not found' });
        }

        const workspace = await Workspace.findById(board.workspace);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const isMember = workspace.members.some(m => m.user.toString() === req.user.id) || workspace.owner.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: 'Access denied to project board' });
        }

        const tasks = await Task.find({ board: board._id })
            .populate('assignees', 'name email avatar')
            .sort({ position: 1 });

        res.json({ board, tasks });
    } catch (error) {
        console.error("Get board details error:", error);
        res.status(500).json({ message: 'Error fetching board details' });
    }
});

// Delete a Project Dashboard (Requires WORKSPACE_OWNER or WORKSPACE_ADMIN)
router.delete('/:boardId', authenticateToken, async (req, res) => {
    try {
        const board = await Board.findById(req.params.boardId);
        if (!board) {
            return res.status(404).json({ message: 'Project board not found' });
        }

        const workspace = await Workspace.findById(board.workspace);
        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const isOwner = workspace.owner.toString() === req.user.id;
        const member = workspace.members.find(m => m.user.toString() === req.user.id);
        const isAdmin = isOwner || member?.role === 'WORKSPACE_ADMIN' || member?.role === 'WORKSPACE_OWNER';

        if (!isAdmin) {
            return res.status(403).json({ message: 'Forbidden: Only workspace owners and admins can delete project dashboards' });
        }

        // Delete board and all tasks associated with it
        await Task.deleteMany({ board: board._id });
        await Board.findByIdAndDelete(board._id);

        res.json({ message: 'Project dashboard deleted successfully', boardId: board._id });
    } catch (error) {
        console.error("Delete board error:", error);
        res.status(500).json({ message: 'Error deleting project dashboard' });
    }
});

// Create a new Task card in board
router.post('/tasks',
    authenticateToken,
    requireWorkspacePermission(WORKSPACE_PERMISSIONS.CREATE_TASK, ['WORKSPACE_OWNER', 'WORKSPACE_ADMIN', 'MEMBER']),
    async (req, res) => {
        try {
            const { boardId, columnId, title, description, priority, assignees, dueDate, labels } = req.body;
            if (!boardId || !columnId || !title) {
                return res.status(400).json({ message: 'boardId, columnId, and title are required' });
            }

            const highestPosTask = await Task.findOne({ board: boardId, columnId }).sort({ position: -1 });
            const newPosition = highestPosTask ? highestPosTask.position + 1 : 0;

            const task = new Task({
                board: boardId,
                columnId,
                title,
                description,
                priority: priority || 'MEDIUM',
                assignees: assignees || [],
                dueDate,
                labels: labels || [],
                position: newPosition
            });

            await task.save();
            const populatedTask = await Task.findById(task._id).populate('assignees', 'name email avatar');

            // Socket.io broadcast to live board subscribers
            const io = req.app.get('io');
            if (io) {
                io.to(`board:${boardId}`).emit('task:created', populatedTask);
            }

            res.status(201).json(populatedTask);
        } catch (error) {
            console.error("Create task error:", error);
            res.status(500).json({ message: 'Error creating task' });
        }
    }
);

// Create task card directly from an Action Item and assign to workspace members
router.post('/tasks/from-action-item',
    authenticateToken,
    requireWorkspacePermission(WORKSPACE_PERMISSIONS.CREATE_TASK, ['WORKSPACE_OWNER', 'WORKSPACE_ADMIN', 'MEMBER']),
    async (req, res) => {
        try {
            const { workspaceId, boardId, columnId, title, description, priority, assigneeId, meetingId, actionItemId, dueDate } = req.body;
            if (!boardId || !columnId || !title) {
                return res.status(400).json({ message: 'boardId, columnId, and title are required' });
            }

            const board = await Board.findById(boardId);
            if (!board) {
                return res.status(404).json({ message: 'Target project board not found' });
            }

            const highestPosTask = await Task.findOne({ board: boardId, columnId }).sort({ position: -1 });
            const newPosition = highestPosTask ? highestPosTask.position + 1 : 0;

            const assignees = [];
            if (assigneeId) {
                const assigneeUser = await User.findById(assigneeId);
                if (assigneeUser) {
                    assignees.push(assigneeUser._id);
                }
            }

            const task = new Task({
                board: boardId,
                columnId,
                title,
                description: description || '',
                priority: priority || 'HIGH',
                assignees,
                dueDate,
                position: newPosition
            });

            await task.save();

            // Update meeting action item status if meetingId & actionItemId provided
            if (meetingId && actionItemId) {
                try {
                    const { Meeting } = await import('../models/MeetingModel.js');
                    const meeting = await Meeting.findById(meetingId);
                    if (meeting && meeting.actionItems) {
                        const targetItem = meeting.actionItems.id(actionItemId);
                        if (targetItem) {
                            if (assigneeId) targetItem.assignee = assigneeId;
                            targetItem.status = 'completed';
                            await meeting.save();
                        }
                    }
                } catch (mErr) {
                    console.error("Error updating meeting action item status:", mErr);
                }
            }

            const populatedTask = await Task.findById(task._id).populate('assignees', 'name email avatar');

            const io = req.app.get('io');
            if (io) {
                io.to(`board:${boardId}`).emit('task:created', populatedTask);

                // Dispatch notification for assigned user and parse @mentions
                const { createNotification, parseAndNotifyMentions } = await import('../services/notificationService.js');
                if (assigneeId && assigneeId.toString() !== req.user.id) {
                    await createNotification(io, {
                        userId: assigneeId,
                        title: '⚡ Action Item Task Assigned',
                        message: `${req.user.name || req.user.email} assigned you a task: "${title}"`,
                        type: 'action_item',
                        link: '/workspace/board'
                    });
                }

                await parseAndNotifyMentions(io, {
                    text: `${title} ${description || ''}`,
                    senderUser: req.user,
                    contextTitle: 'Workspace Task',
                    link: '/workspace/board',
                    type: 'mention'
                });
            }

            res.status(201).json({
                message: 'Action item converted to Kanban task successfully',
                task: populatedTask
            });
        } catch (error) {
            console.error("Create task from action item error:", error);
            res.status(500).json({ message: 'Error converting action item to task' });
        }
    }
);

// Drag & Drop / Move Task across columns
router.put('/tasks/:taskId/move', authenticateToken, async (req, res) => {
    try {
        const { taskId } = req.params;
        const { destinationColumnId, newPosition, boardId } = req.body;

        const task = await Task.findById(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        task.columnId = destinationColumnId;
        task.position = newPosition;
        await task.save();

        const updatedTask = await Task.findById(taskId).populate('assignees', 'name email avatar');

        // Socket.io broadcast task move
        const io = req.app.get('io');
        if (io) {
            io.to(`board:${boardId}`).emit('task:moved', {
                taskId,
                destinationColumnId,
                newPosition,
                task: updatedTask
            });
        }

        res.json(updatedTask);
    } catch (error) {
        console.error("Move task error:", error);
        res.status(500).json({ message: 'Error moving task' });
    }
});

// Delete Task card
router.delete('/tasks/:taskId',
    authenticateToken,
    requireWorkspacePermission(WORKSPACE_PERMISSIONS.DELETE_TASKS, ['WORKSPACE_OWNER', 'WORKSPACE_ADMIN', 'MEMBER']),
    async (req, res) => {
        try {
            const task = await Task.findByIdAndDelete(req.params.taskId);
            if (!task) {
                return res.status(404).json({ message: 'Task not found' });
            }

            const io = req.app.get('io');
            if (io) {
                io.to(`board:${task.board}`).emit('task:deleted', { taskId: req.params.taskId });
            }

            res.json({ message: 'Task deleted successfully', taskId: req.params.taskId });
        } catch (error) {
            console.error("Delete task error:", error);
            res.status(500).json({ message: 'Error deleting task' });
        }
    }
);

export default router;
