"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JobStatus = exports.DocumentStatus = exports.CollectionType = exports.AgentType = exports.MessageType = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["ADMIN"] = "admin";
    UserRole["TEACHER"] = "teacher";
    UserRole["STUDENT"] = "student";
})(UserRole || (exports.UserRole = UserRole = {}));
var MessageType;
(function (MessageType) {
    MessageType["TEXT"] = "text";
    MessageType["FILE"] = "file";
    MessageType["IMAGE"] = "image";
    MessageType["SYSTEM"] = "system";
})(MessageType || (exports.MessageType = MessageType = {}));
var AgentType;
(function (AgentType) {
    AgentType["GENERAL"] = "general";
    AgentType["DOCUMENT_QA"] = "document_qa";
    AgentType["CODE_ASSISTANT"] = "code_assistant";
    AgentType["MATH_TUTOR"] = "math_tutor";
})(AgentType || (exports.AgentType = AgentType = {}));
var CollectionType;
(function (CollectionType) {
    CollectionType["DOCUMENT"] = "document";
    CollectionType["WEBPAGE"] = "webpage";
    CollectionType["API"] = "api";
})(CollectionType || (exports.CollectionType = CollectionType = {}));
var DocumentStatus;
(function (DocumentStatus) {
    DocumentStatus["PENDING"] = "pending";
    DocumentStatus["PROCESSING"] = "processing";
    DocumentStatus["COMPLETED"] = "completed";
    DocumentStatus["FAILED"] = "failed";
})(DocumentStatus || (exports.DocumentStatus = DocumentStatus = {}));
var JobStatus;
(function (JobStatus) {
    JobStatus["PENDING"] = "pending";
    JobStatus["PROCESSING"] = "processing";
    JobStatus["COMPLETED"] = "completed";
    JobStatus["FAILED"] = "failed";
})(JobStatus || (exports.JobStatus = JobStatus = {}));
//# sourceMappingURL=domain.types.js.map