import { Schema, model } from "mongoose";

const UserSchema = new Schema({
    email: {
        type: String,
        unique: true,
        required: true,
        lowercase: true,
    },
    password: {
        type: String,
        required: true
    },
    name: String,
    avatar: String,
    systemRole: {
        type: String,
        enum: ['SUPER_ADMIN', 'PLATFORM_ADMIN', 'MEDIA_MANAGER', 'PLATFORM_USER'],
        default: 'PLATFORM_USER',
    }
});

export const User = model('User', UserSchema);