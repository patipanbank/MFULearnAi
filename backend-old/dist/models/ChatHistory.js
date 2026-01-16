"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Chat = void 0;
const mongoose_1 = __importDefault(require("mongoose"));
const imageSchema = new mongoose_1.default.Schema({
    data: { type: String, required: true },
    mediaType: { type: String, required: true }
}, { _id: false });
const sourceSchema = new mongoose_1.default.Schema({
    modelId: { type: String },
    collectionName: { type: String },
    filename: { type: String },
    similarity: { type: Number }
}, { _id: false });
const messageSchema = new mongoose_1.default.Schema({
    role: {
        type: String,
        enum: ['user', 'assistant', 'system'],
        required: true
    },
    content: {
        type: String,
        required: function () {
            return !this.images || this.images.length === 0;
        }
    },
    timestamp: {
        type: Date,
        default: Date.now,
        validate: {
            validator: function (v) {
                if (!v)
                    return true; // Allow default value to be set
                const date = new Date(v);
                return !isNaN(date.getTime());
            },
            message: (props) => `${props.value} is not a valid timestamp!`
        },
        set: function (v) {
            if (!v)
                return new Date();
            if (v.$date)
                return new Date(v.$date);
            return new Date(v);
        }
    },
    images: [imageSchema],
    sources: [sourceSchema],
    isImageGeneration: {
        type: Boolean,
        default: false
    }
}, { _id: false });
const chatSchema = new mongoose_1.default.Schema({
    userId: { type: String, required: true },
    modelId: { type: String, required: true },
    chatname: {
        type: String,
        required: true,
        maxLength: 100
    },
    messages: [messageSchema],
    isPinned: { type: Boolean, default: false },
}, {
    timestamps: true,
    index: [
        { userId: 1 },
        { userId: 1, updatedAt: -1 },
        { userId: 1, modelId: 1 }
    ]
});
// Add validation for messages array
chatSchema.pre('save', function (next) {
    if (!this.messages || this.messages.length === 0) {
        next(new Error('Chat must have at least one message'));
        return;
    }
    next();
});
exports.Chat = mongoose_1.default.model('Chat', chatSchema);
