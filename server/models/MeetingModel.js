import { Schema, model } from "mongoose";

// Sub-schema to track participant logs and roles
const ParticipantSchema = new Schema({
    user: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    role: {
        type: String,
        enum: ['host', 'co-host', 'presenter', 'attendee'],
        default: 'attendee'
    },
    joinedAt: {
        type: Date,
        default: Date.now
    },
    leftAt: Date
});

// Sub-schema for action items extracted by AI
const ActionItemSchema = new Schema({
    task: {
        type: String,
        required: true
    },
    assignee: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    assigneeName: {
        type: String,
        default: ""
    },
    status: {
        type: String,
        enum: ['pending', 'completed'],
        default: 'pending'
    }
});

// Sub-schema for transcripts
const TranscriptSegmentSchema = new Schema({
    speaker: {
        type: Schema.Types.ObjectId,
        ref: 'User'
    },
    speakerName: {
        type: String,
        default: "Speaker"
    },
    text: {
        type: String,
        required: true
    },
    timestamp: {
        type: Date,
        default: Date.now
    }
});

// Main Meeting Schema
const MeetingSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    host: {
        type: Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    meetingCode: {
        type: String,
        unique: true,
        required: true,
        index: true, // Speeds up lookups when joining meetings
    },
    passcode: String,
    isPrivate: {
        type: Boolean,
        default: false,
    },
    isInstant: {
        type: Boolean,
        default: false,
    },
    status: {
        type: String,
        enum: ['scheduled', 'active', 'completed', 'cancelled'],
        default: 'scheduled',
    },
    startTime: {
        type: Date,
        required: true,
    },
    endTime: Date,
    participants: [ParticipantSchema],

    // AI and Media Assets
    recordingUrl: String,
    summary: String,
    actionItems: [ActionItemSchema],
    transcript: [TranscriptSegmentSchema],

    // Collaboration
    notes: {
        type: String,
        default: "",
    }
}, {
    timestamps: true // Automatically adds createdAt and updatedAt fields
});

export const Meeting = model('Meeting', MeetingSchema);
