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
});

export const User = model('User', User);