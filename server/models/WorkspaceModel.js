import { Schema, model } from "mongoose";

export const WORKSPACE_PERMISSIONS = {
    CREATE_MEETING: 'CREATE_MEETING',
    CREATE_TASK: 'CREATE_TASK',
    MANAGE_BOARDS: 'MANAGE_BOARDS',
    INVITE_MEMBERS: 'INVITE_MEMBERS',
    DELETE_TASKS: 'DELETE_TASKS'
};

const WorkspaceMemberSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        enum: ['WORKSPACE_OWNER', 'WORKSPACE_ADMIN', 'MEMBER', 'GUEST'],
        default: 'MEMBER'
    },
    customPermissions: [{
        type: String
    }],
    joinedAt: {
        type: Date,
        default: Date.now
    }
});

const WorkspaceSchema = new Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    owner: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    members: [WorkspaceMemberSchema]
}, {
    timestamps: true
});

export const Workspace = model('Workspace', WorkspaceSchema);
