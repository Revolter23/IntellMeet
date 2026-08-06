import { Schema, model } from "mongoose";

const ColumnSchema = new Schema({
    id: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: true
    },
    position: {
        type: Number,
        required: true
    },
    color: {
        type: String,
        default: '#6366f1'
    }
});

const BoardSchema = new Schema({
    workspace: {
        type: Schema.Types.ObjectId,
        ref: 'Workspace',
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
    columns: [ColumnSchema],
    isArchived: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

export const Board = model('Board', BoardSchema);
