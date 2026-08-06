import { Schema, model } from "mongoose";

const TaskSchema = new Schema({
    board: {
        type: Schema.Types.ObjectId,
        ref: 'Board',
        required: true
    },
    columnId: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        default: ''
    },
    position: {
        type: Number,
        default: 0
    },
    priority: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'URGENT'],
        default: 'MEDIUM'
    },
    assignees: [{
        type: Schema.Types.ObjectId,
        ref: 'User'
    }],
    dueDate: Date,
    labels: [{
        name: String,
        color: String
    }],
    meetingId: {
        type: Schema.Types.ObjectId,
        ref: 'Meeting'
    }
}, {
    timestamps: true
});

export const Task = model('Task', TaskSchema);
