"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const passport_1 = __importDefault(require("passport"));
const express_session_1 = __importDefault(require("express-session"));
const mongodb_1 = require("./lib/mongodb");
const auth_1 = __importDefault(require("./routes/auth"));
const training_1 = __importDefault(require("./routes/training"));
const embedding_1 = __importDefault(require("./routes/embedding"));
const chat_1 = __importDefault(require("./routes/chat"));
const models_1 = __importDefault(require("./routes/models"));
const body_parser_1 = __importDefault(require("body-parser"));
const compression_1 = __importDefault(require("compression"));
const admin_1 = __importDefault(require("./routes/admin"));
const stats_1 = __importDefault(require("./routes/stats"));
const department_1 = __importDefault(require("./routes/department"));
const app = (0, express_1.default)();
// Connect to MongoDB
(0, mongodb_1.connectDB)();
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['https://mfulearnai.mfu.ac.th'];
console.log('Allowed origins:', allowedOrigins);
app.use((0, cors_1.default)({
    origin: function (origin, callback) {
        // console.log('Request origin:', origin);
        // allow requests with no origin (like mobile apps or curl requests)
        if (!origin) {
            return callback(null, true);
        }
        if (allowedOrigins.indexOf(origin) === -1) {
            return callback(new Error('Not allowed by CORS'), false);
        }
        return callback(null, true);
    },
    credentials: true
}));
app.use(body_parser_1.default.json({ limit: '500mb' }));
app.use(body_parser_1.default.urlencoded({ limit: '500mb', extended: true }));
app.use((0, express_session_1.default)({
    secret: process.env.SESSION_SECRET || 'your-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
}));
app.use(passport_1.default.initialize());
app.use(passport_1.default.session());
app.use('/api/auth', auth_1.default);
app.use('/api/training', training_1.default);
app.use('/api/chat', chat_1.default);
app.use('/api/embed', embedding_1.default);
app.use('/api/models', models_1.default);
app.use('/api/admin', admin_1.default);
app.use('/api/stats', stats_1.default);
app.use('/api/departments', department_1.default);
// เพิ่มการตั้งค่า timeout
app.use((req, res, next) => {
    res.setTimeout(24 * 60 * 60 * 1000); // 24 hours
    next();
});
// ปิดการใช้งาน compression middleware สำหรับ SSE endpoints
app.use((req, res, next) => {
    if (req.url.includes('/api/chat') && req.method === 'POST') {
        // ข้าม compression สำหรับ chat endpoint
        next();
    }
    else {
        (0, compression_1.default)()(req, res, next);
    }
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    // console.log(`Server running on port ${PORT}`);
});
