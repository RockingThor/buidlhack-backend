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
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const middleware_1 = require("../middlewares/middleware");
const config_1 = require("../config/config");
const dbLogic_1 = require("../utils/dbLogic");
const types_1 = require("../types/types");
const util_1 = require("../utils/util");
const web3_js_1 = require("@solana/web3.js");
const bs58_1 = require("bs58");
const workerRouter = (0, express_1.Router)();
const connection = new web3_js_1.Connection("https://api.devnet.solana.com");
workerRouter.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const walletAddress = req.body.wallet;
        const telegram = req.body.telegram;
        const user = yield config_1.prismaClient.worker.findFirst({
            where: {
                telegram,
            },
        });
        if (user) {
            const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET_WORKER || "");
            return res.json({ token });
        }
        else {
            const newUser = yield config_1.prismaClient.worker.create({
                data: {
                    address: walletAddress,
                    pending_amount: 0,
                    locked_amount: 0,
                    telegram,
                },
            });
            const token = jsonwebtoken_1.default.sign({ userId: newUser.id }, process.env.JWT_SECRET || "");
            return res.json({ token });
        }
    }
    catch (err) {
        res.status(500).json({ message: "Something went wrong" });
    }
}));
workerRouter.get("/nextTask", middleware_1.authMiddleWareWorker, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const tasks = yield (0, dbLogic_1.getNextTask)(Number(userId));
    if (!tasks) {
        return res.status(200).json("No more tasks for you.");
    }
    else {
        return res.status(200).json({ tasks });
    }
}));
workerRouter.post("/submission", middleware_1.authMiddleWareWorker, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const body = req.body;
    const parsedData = types_1.createSubmissionInput.safeParse(body);
    //@ts-ignore
    const userId = req.userId;
    if (!parsedData.success) {
        return res
            .status(401)
            .json({ message: "Arguments sent is not in correct format" });
    }
    const task = yield (0, dbLogic_1.getNextTask)(Number(userId));
    if (!((task === null || task === void 0 ? void 0 : task.id) === Number(parsedData.data.taskId))) {
        return res
            .status(411)
            .json({ message: "You are not allowed to submit for this task" });
    }
    const amount = (Number(task.amount) * 1000000000) / task.sampleSize;
    const transactionResponse = yield config_1.prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        const response = yield tx.submission.create({
            data: {
                option_id: Number(parsedData.data.selection),
                worker_id: Number(userId),
                task_id: Number(parsedData.data.taskId),
                amount: String(amount),
            },
        });
        yield tx.task.update({
            where: {
                id: task.id,
            },
            data: {
                submissionCount: task.submissionCount + 1,
            },
        });
        const currentPendingAmount = yield tx.worker.findFirst({
            where: {
                id: Number(userId),
            },
        });
        yield tx.worker.update({
            where: {
                id: Number(userId),
            },
            data: {
                pending_amount: Number(currentPendingAmount === null || currentPendingAmount === void 0 ? void 0 : currentPendingAmount.pending_amount) +
                    Number(response.amount),
            },
        });
        return response;
    }));
    const nextTask = (0, dbLogic_1.getNextTask)(Number(userId));
    if (transactionResponse) {
        return res.status(200).json({
            message: "Your task submission successful.",
            submissionStatus: true,
            amount: transactionResponse.amount,
            nextTask,
        });
    }
    else {
        return res.status(200).json({
            message: "Your task submission failed.",
            submissionStatus: false,
            amount: 0,
            nextTask,
        });
    }
}));
workerRouter.get("/balance", middleware_1.authMiddleWareWorker, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const worker = yield config_1.prismaClient.worker.findFirst({
        where: {
            id: userId,
        },
    });
    if (!worker) {
        return res.status(404).json({ messsage: "No user found" });
    }
    else {
        return res.status(200).json({
            pending_balance: worker.pending_amount,
            locked_amount: worker.locked_amount,
            balance: worker.pending_amount + worker.locked_amount,
        });
    }
}));
workerRouter.post("/chat", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const telegram = req.body.telegram;
    const chatId = req.body.chatId;
    const worker = yield config_1.prismaClient.worker.findFirst({
        where: {
            telegram,
        },
    });
    if (worker) {
        const response = yield config_1.prismaClient.worker.update({
            where: {
                telegram,
            },
            data: {
                chatId,
            },
        });
        return res.status(200).json({
            success: true,
        });
    }
    else {
        const response = yield config_1.prismaClient.worker.create({
            data: {
                address: (0, util_1.generateRandomString)(16),
                pending_amount: 0,
                locked_amount: 0,
                telegram,
                chatId,
            },
        });
        return res.status(200).json({
            success: true,
        });
    }
}));
workerRouter.post("/payout", middleware_1.authMiddleWareWorker, (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    //@ts-ignore
    const userId = req.userId;
    const walletAddress = req.body.wallet;
    const worker = yield config_1.prismaClient.worker.findFirst({
        where: {
            id: userId,
        },
    });
    const transaction = new web3_js_1.Transaction().add(web3_js_1.SystemProgram.transfer({
        fromPubkey: new web3_js_1.PublicKey("GLvVMs13Zxyorf5xHMHKwZAiG5NqMbH7XvFTL8E2yTME"),
        toPubkey: new web3_js_1.PublicKey(walletAddress),
        lamports: Number(worker === null || worker === void 0 ? void 0 : worker.pending_amount) * 1000000000,
        // lamports: 0.02 * 1000000000,
    }));
    const keypair = web3_js_1.Keypair.fromSecretKey((0, bs58_1.decode)(process.env.PRIVATE_KEY || ""));
    let signature = "";
    try {
        signature = yield (0, web3_js_1.sendAndConfirmTransaction)(connection, transaction, [
            keypair,
        ]);
    }
    catch (e) {
        return res.json({
            message: "Transaction failed",
        });
    }
    console.log(signature);
    // We should add a lock here
    yield config_1.prismaClient.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
        yield tx.worker.update({
            where: {
                id: Number(userId),
            },
            data: {
                pending_amount: {
                    decrement: Number(worker === null || worker === void 0 ? void 0 : worker.pending_amount),
                },
                locked_amount: {
                    increment: worker === null || worker === void 0 ? void 0 : worker.pending_amount,
                },
            },
        });
        yield tx.payout.create({
            data: {
                user_id: Number(userId),
                amount: Number(worker === null || worker === void 0 ? void 0 : worker.pending_amount),
                status: "Processing",
                signature: signature,
            },
        });
    }));
    res.json({
        message: "Processing payout",
        amount: worker === null || worker === void 0 ? void 0 : worker.pending_amount,
    });
}));
exports.default = workerRouter;
