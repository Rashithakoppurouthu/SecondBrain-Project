"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const mongoose_1 = __importDefault(require("mongoose"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const middleware_1 = require("./middleware");
const db_1 = require("./db");
const config_1 = require("./config");
const utils_1 = require("./utils");
const validation_1 = require("./validation");
const cors_1 = __importDefault(require("cors"));
const bcrypt_1 = __importDefault(require("bcrypt"));
const nodemailer_1 = __importDefault(require("nodemailer"));
const app = (0, express_1.default)();
app.use(express_1.default.json());
app.use((0, cors_1.default)({
    origin: "http://localhost:5173",
    credentials: true
}));
//otps are stored temporariy (use nodemailer)
const otpStore = {};
const transporter = nodemailer_1.default.createTransport({
    service: "gmail",
    auth: {
        user: "youremail@gmail.com",
        pass: "your_app_password",
    },
});
app.post("/api/v1/signup", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const parse = validation_1.SignupSchema.safeParse(req.body);
    if (!parse.success) {
        res.status(400).json({ error: parse.error.errors });
        return;
    }
    const { username, password } = parse.data;
    const hashedPassword = yield bcrypt_1.default.hash(password, 10);
    try {
        yield db_1.UserModel.create({
            username: username,
            password: hashedPassword
        });
        res.json({
            message: "User signed up"
        });
    }
    catch (e) {
        res.status(411).json({
            message: "User already exists"
        });
    }
}));
app.post("/api/v1/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const parsed = validation_1.SigninSchema.safeParse(req.body);
    if (!parsed.success) {
        res.status(400).json({ error: parsed.error.errors });
        return;
    }
    const { username, password } = parsed.data;
    const existingUser = yield db_1.UserModel.findOne({
        username,
    });
    if (!existingUser) {
        res.status(403).json({ message: "Invalid Credentials" });
        return;
    }
    const isPasswordcorrect = yield bcrypt_1.default.compare(password, existingUser.password || "");
    if (!isPasswordcorrect) {
        res.status(403).json({ message: "Invalid Password" });
        return;
    }
    const token = jsonwebtoken_1.default.sign({ id: existingUser._id }, config_1.JWT_PASSWORD);
    res.json({ token });
}));
app.post("/api/v1/forgot-password/send-otp", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email } = req.body;
    const user = yield db_1.UserModel.findOne({ username: email });
    if (!user) {
        res.status(404).json({ message: "User not found" });
        return;
    }
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore[email] = { otp, expiresAt: Date.now() + 5 * 60 * 1000 };
    yield transporter.sendMail({
        from: "youremail@gmail.com",
        to: email,
        subject: "Your OTP to Reset Password",
        html: `<h3>Your OTP is: ${otp}</h3><p>This OTP will expire in 5 minutes.</p>`,
    });
    res.json({ message: "OTP sent to your email." });
}));
app.post("/api/v1/forgot-password/reset", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { email, otp, newPassword } = req.body;
    const record = otpStore[email];
    if (!record || record.otp !== otp || record.expiresAt < Date.now()) {
        res.status(400).json({ message: "Invalid or expired OTP." });
        return;
    }
    const hashedPassword = yield bcrypt_1.default.hash(newPassword, 10);
    yield db_1.UserModel.updateOne({ username: email }, { password: hashedPassword });
    delete otpStore[email];
    res.json({ message: "Password reset successfully." });
}));
app.post("/api/v1/content", middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const link = req.body.link;
    const type = req.body.type;
    const title = req.body.title;
    yield db_1.ContentModel.create({
        link,
        type,
        title: req.body.title,
        userId: req.userId,
        tags: []
    });
    res.json({
        message: "Content added"
    });
}));
app.get("/api/v1/content", middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const userId = new mongoose_1.default.Types.ObjectId(req.userId);
    const content = yield db_1.ContentModel.find({
        userId: userId
    }).populate("userId", "username");
    res.json({
        content
    });
}));
app.delete("/api/v1/content", middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const link = req.body.link;
    yield db_1.ContentModel.deleteOne({
        link,
        userId: req.userId
    });
    res.json({
        message: "Deleted"
    });
}));
app.post("/api/v1/brain/share", middleware_1.userMiddleware, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const share = req.body.share;
    if (share) {
        const existingLink = yield db_1.LinkModel.findOne({
            userId: req.userId
        });
        if (existingLink) {
            res.json({
                hash: existingLink.hash
            });
            return;
        }
        const hash = (0, utils_1.random)(10);
        yield db_1.LinkModel.create({
            userId: req.userId,
            hash: hash
        });
        res.json({
            hash
        });
    }
    else {
        yield db_1.LinkModel.deleteOne({
            userId: req.userId
        });
        res.json({
            message: "Removed Link"
        });
    }
}));
app.get("/api/v1/brain/:shareLink", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const hash = req.params.shareLink;
    const link = yield db_1.LinkModel.findOne({
        hash
    });
    if (!link) {
        res.status(411).json({
            message: "Sorry incorrect input"
        });
        return;
    }
    const content = yield db_1.ContentModel.find({
        userId: link.userId
    });
    console.log(link);
    const user = yield db_1.UserModel.findOne({
        _id: link.userId
    });
    if (!user) {
        res.status(411).json({
            message: "user not found"
        });
        return;
    }
    res.json({
        username: user.username,
        content: content
    });
}));
app.listen(3000);
