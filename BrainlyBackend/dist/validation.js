"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SigninSchema = exports.SignupSchema = void 0;
const zod_1 = require("zod");
exports.SignupSchema = zod_1.z.object({
    username: zod_1.z.string().email({ message: "Username must be valid email" }),
    password: zod_1.z.string().min(6, { message: "Password must be atleast 6 characters" })
});
exports.SigninSchema = exports.SignupSchema;
