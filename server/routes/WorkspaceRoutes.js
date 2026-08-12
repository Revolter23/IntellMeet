import express from 'express';
import { Workspace, WORKSPACE_PERMISSIONS } from '../models/WorkspaceModel.js';
import { Board } from '../models/BoardModel.js';
import { User } from '../models/UserModel.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireWorkspacePermission } from '../middleware/rbac.js';
import { createNotification } from '../services/notificationService.js';

const router = express.Router();

// Get all workspaces user belongs to or owns
router.get('/', authenticateToken, async (req, res) => {
    try {
        const workspaces = await Workspace.find({
            $or: [
                { owner: req.user.id },
                { 'members.user': req.user.id }
            ]
        })
        .populate('owner', 'name email avatar')
        .populate('members.user', 'name email avatar')
        .sort({ updatedAt: -1 });

        res.json(workspaces);
    } catch (error) {
        console.error("Get workspaces error:", error);
        res.status(500).json({ message: 'Error fetching workspaces' });
    }
});

// Create a new team workspace
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, description } = req.body;
        if (!name) {
            return res.status(400).json({ message: 'Workspace name is required' });
        }

        const workspace = new Workspace({
            name,
            description,
            owner: req.user.id,
            members: [{
                user: req.user.id,
                role: 'WORKSPACE_OWNER',
                customPermissions: Object.values(WORKSPACE_PERMISSIONS)
            }]
        });

        await workspace.save();

        // Auto-create a default Project Board for the team workspace
        const defaultBoard = new Board({
            workspace: workspace._id,
            title: `${name} Project Board`,
            description: 'Main Kanban project board for your team tasks',
            columns: [
                { id: 'col-todo', title: 'To Do', position: 0, color: '#6366f1' },
                { id: 'col-in-progress', title: 'In Progress', position: 1, color: '#d97706' },
                { id: 'col-review', title: 'Under Review', position: 2, color: '#a855f7' },
                { id: 'col-done', title: 'Done', position: 3, color: '#10b981' }
            ]
        });

        await defaultBoard.save();

        const populatedWorkspace = await Workspace.findById(workspace._id)
            .populate('owner', 'name email avatar')
            .populate('members.user', 'name email avatar');

        res.status(201).json({
            workspace: populatedWorkspace,
            board: defaultBoard
        });
    } catch (error) {
        console.error("Create workspace error:", error);
        res.status(500).json({ message: 'Error creating workspace' });
    }
});

// Get workspace details by ID
router.get('/:workspaceId', authenticateToken, async (req, res) => {
    try {
        const workspace = await Workspace.findById(req.params.workspaceId)
            .populate('owner', 'name email avatar')
            .populate('members.user', 'name email avatar systemRole');

        if (!workspace) {
            return res.status(404).json({ message: 'Workspace not found' });
        }

        const isMember = workspace.members.some(m => m.user._id.toString() === req.user.id) || workspace.owner._id.toString() === req.user.id;
        if (!isMember) {
            return res.status(403).json({ message: 'Access denied to workspace' });
        }

        res.json(workspace);
    } catch (error) {
        console.error("Get workspace details error:", error);
        res.status(500).json({ message: 'Error fetching workspace details' });
    }
});

// Invite / Add member to workspace (Requires WORKSPACE_OWNER or WORKSPACE_ADMIN or INVITE_MEMBERS permission)
router.post('/:workspaceId/members', 
    authenticateToken, 
    requireWorkspacePermission(WORKSPACE_PERMISSIONS.INVITE_MEMBERS, ['WORKSPACE_OWNER', 'WORKSPACE_ADMIN']),
    async (req, res) => {
        try {
            const { email, role, customPermissions } = req.body;
            const targetUser = await User.findOne({ email: email.toLowerCase() });

            if (!targetUser) {
                return res.status(404).json({ message: 'User with this email not found' });
            }

            const existingMember = req.workspace.members.find(m => m.user._id.toString() === targetUser.id);
            if (existingMember) {
                return res.status(409).json({ message: 'User is already a member of this workspace' });
            }

            const validRoles = ['WORKSPACE_OWNER', 'WORKSPACE_ADMIN', 'MEMBER', 'GUEST'];
            const assignedRole = validRoles.includes(role) ? role : 'MEMBER';

            req.workspace.members.push({
                user: targetUser._id,
                role: assignedRole,
                customPermissions: customPermissions || []
            });

            await req.workspace.save();

            // Create persistent notification and emit real-time socket notification to added user (non-blocking)
            try {
                const io = req.app.get('io');
                const inviterUser = await User.findById(req.user.id).select('name email');
                const inviterName = inviterUser?.name || inviterUser?.email || 'A team member';
                const readableRole = assignedRole.replace('WORKSPACE_', '');

                await createNotification(io, {
                    userId: targetUser._id,
                    title: '🏢 Added to Team Workspace',
                    message: `${inviterName} added you to the "${req.workspace.name}" workspace as ${readableRole}.`,
                    type: 'info',
                    link: '/workspace'
                });
            } catch (notifErr) {
                console.warn("Non-blocking notification dispatch warning:", notifErr?.message || notifErr);
            }

            const updatedWorkspace = await Workspace.findById(req.params.workspaceId)
                .populate('owner', 'name email avatar')
                .populate('members.user', 'name email avatar systemRole');

            res.json({ message: 'Member added successfully', workspace: updatedWorkspace });
        } catch (error) {
            console.error("Add workspace member error:", error);
            res.status(500).json({ message: 'Error adding workspace member' });
        }
    }
);

// Update member role and custom permissions (Requires WORKSPACE_OWNER)
router.put('/:workspaceId/members/:memberUserId',
    authenticateToken,
    requireWorkspacePermission(null, ['WORKSPACE_OWNER']),
    async (req, res) => {
        try {
            const { role, customPermissions } = req.body;
            const memberIndex = req.workspace.members.findIndex(
                m => m.user._id.toString() === req.params.memberUserId
            );

            if (memberIndex === -1) {
                return res.status(404).json({ message: 'Member not found in workspace' });
            }

            const oldRole = req.workspace.members[memberIndex].role;
            const roleChanged = role && role !== oldRole;
            const permissionsChanged = Boolean(customPermissions);

            if (role) req.workspace.members[memberIndex].role = role;
            if (customPermissions) req.workspace.members[memberIndex].customPermissions = customPermissions;

            await req.workspace.save();

            // Create notification for role/permissions update (non-blocking)
            try {
                const io = req.app.get('io');
                const updaterUser = await User.findById(req.user.id).select('name email');
                const updaterName = updaterUser?.name || updaterUser?.email || 'A team owner';

                let notifTitle = '🔒 Workspace Updated';
                let notifMessage = `${updaterName} updated your settings in "${req.workspace.name}".`;

                if (roleChanged && permissionsChanged) {
                    const readableRole = role.replace('WORKSPACE_', '');
                    notifTitle = '🎭 Role & Permissions Changed';
                    notifMessage = `${updaterName} changed your role to ${readableRole} and updated your capabilities in "${req.workspace.name}".`;
                } else if (roleChanged) {
                    const readableRole = role.replace('WORKSPACE_', '');
                    notifTitle = '🎭 Workspace Role Changed';
                    notifMessage = `${updaterName} changed your role to ${readableRole} in "${req.workspace.name}".`;
                } else if (permissionsChanged) {
                    notifTitle = '🔑 Permissions Updated';
                    notifMessage = `${updaterName} updated your custom capabilities in "${req.workspace.name}".`;
                }

                await createNotification(io, {
                    userId: req.params.memberUserId,
                    title: notifTitle,
                    message: notifMessage,
                    type: 'info',
                    link: '/workspace'
                });
            } catch (notifErr) {
                console.warn("Non-blocking notification dispatch warning:", notifErr?.message || notifErr);
            }

            const updatedWorkspace = await Workspace.findById(req.params.workspaceId)
                .populate('owner', 'name email avatar')
                .populate('members.user', 'name email avatar systemRole');

            res.json({ message: 'Member permissions updated', workspace: updatedWorkspace });
        } catch (error) {
            console.error("Update member permissions error:", error);
            res.status(500).json({ message: 'Error updating member permissions' });
        }
    }
);

// Remove member from workspace (Requires WORKSPACE_OWNER or WORKSPACE_ADMIN)
router.delete('/:workspaceId/members/:memberUserId',
    authenticateToken,
    requireWorkspacePermission(null, ['WORKSPACE_OWNER', 'WORKSPACE_ADMIN']),
    async (req, res) => {
        try {
            const { workspaceId, memberUserId } = req.params;

            // Cannot remove the workspace owner
            if (req.workspace.owner.toString() === memberUserId) {
                return res.status(400).json({ message: 'Cannot remove the workspace owner' });
            }

            req.workspace.members = req.workspace.members.filter(
                m => m.user._id.toString() !== memberUserId && m.user.toString() !== memberUserId
            );

            await req.workspace.save();

            // Create notification and emit socket event for removal from workspace (non-blocking)
            try {
                const io = req.app.get('io');
                const removerUser = await User.findById(req.user.id).select('name email');
                const removerName = removerUser?.name || removerUser?.email || 'A team administrator';

                await createNotification(io, {
                    userId: memberUserId,
                    title: '🚫 Removed from Team Workspace',
                    message: `${removerName} removed you from the "${req.workspace.name}" workspace.`,
                    type: 'warning',
                    link: '/workspace'
                });
            } catch (notifErr) {
                console.warn("Non-blocking notification dispatch warning:", notifErr?.message || notifErr);
            }

            const updatedWorkspace = await Workspace.findById(workspaceId)
                .populate('owner', 'name email avatar')
                .populate('members.user', 'name email avatar systemRole');

            res.json({ message: 'Member removed successfully', workspace: updatedWorkspace });
        } catch (error) {
            console.error("Remove workspace member error:", error);
            res.status(500).json({ message: 'Error removing member from workspace' });
        }
    }
);

export default router;
