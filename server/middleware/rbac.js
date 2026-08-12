import { Workspace } from '../models/WorkspaceModel.js';
import { Meeting } from '../models/MeetingModel.js';
import { Board } from '../models/BoardModel.js';

/**
 * Global Scope RBAC Guard
 * Checks user.systemRole against allowed system roles
 */
export const requireSystemRole = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user || !req.user.systemRole) {
            return res.status(401).json({ message: 'Unauthorized: User identity unverified' });
        }

        if (!allowedRoles.includes(req.user.systemRole)) {
            return res.status(403).json({ message: 'Forbidden: Insufficient system privileges' });
        }

        next();
    };
};

/**
 * Workspace Scope RBAC Guard with Capability Enforcement
 * Checks workspace role OR explicit custom permission
 */
export const requireWorkspacePermission = (requiredPermission, allowedRoles = ['WORKSPACE_OWNER', 'WORKSPACE_ADMIN']) => {
    return async (req, res, next) => {
        try {
            let workspaceId = req.params.workspaceId || req.body.workspaceId || req.query.workspaceId;
            if (!workspaceId && req.body.boardId) {
                const targetBoard = await Board.findById(req.body.boardId);
                if (targetBoard) {
                    workspaceId = targetBoard.workspace.toString();
                }
            }

            if (!workspaceId) {
                return res.status(400).json({ message: 'Workspace ID is required' });
            }

            const workspace = await Workspace.findById(workspaceId).populate('members.user', 'name email avatar systemRole');
            if (!workspace) {
                return res.status(404).json({ message: 'Workspace not found' });
            }

            const isOwner = workspace.owner.toString() === req.user.id;
            const member = workspace.members.find(m => (m.user._id ? m.user._id.toString() : m.user.toString()) === req.user.id);

            if (!isOwner && !member) {
                return res.status(403).json({ message: 'Access denied: You are not a member of this workspace' });
            }

            const effectiveRole = isOwner ? 'WORKSPACE_OWNER' : member.role;
            const hasRoleAccess = allowedRoles.includes(effectiveRole);
            const hasExplicitPermission = member?.customPermissions?.includes(requiredPermission);

            if (effectiveRole === 'WORKSPACE_OWNER' || hasRoleAccess || hasExplicitPermission) {
                req.workspace = workspace;
                req.workspaceMemberRole = effectiveRole;
                req.workspaceMemberPermissions = member?.customPermissions || [];
                return next();
            }

            return res.status(403).json({ message: 'Forbidden: Insufficient workspace permissions' });
        } catch (error) {
            console.error('Workspace RBAC error:', error);
            res.status(500).json({ message: 'Internal server error validating workspace permission' });
        }
    };
};

/**
 * Meeting Scope RBAC Guard
 * Checks participant meeting role (host, co-host, presenter, attendee)
 */
export const requireMeetingRole = (...allowedRoles) => {
    return async (req, res, next) => {
        try {
            const { meetingCode } = req.params;
            if (!meetingCode) {
                return res.status(400).json({ message: 'Meeting code is required' });
            }

            const meeting = await Meeting.findOne({ meetingCode });
            if (!meeting) {
                return res.status(404).json({ message: 'Meeting not found' });
            }

            const isHost = meeting.host.toString() === req.user.id;
            const participant = meeting.participants.find(p => p.user.toString() === req.user.id);

            const effectiveRole = isHost ? 'host' : (participant?.role || 'attendee');

            if (!allowedRoles.includes(effectiveRole)) {
                return res.status(403).json({ message: 'Forbidden: Insufficient meeting role permissions' });
            }

            req.meeting = meeting;
            req.meetingRole = effectiveRole;
            next();
        } catch (error) {
            console.error('Meeting RBAC error:', error);
            res.status(500).json({ message: 'Internal server error validating meeting role' });
        }
    };
};
