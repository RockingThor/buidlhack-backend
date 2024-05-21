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
const workerRouter = (0, express_1.Router)();
workerRouter.post("/signin", (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const walletAddress = req.body.wallet || "GLvVMs13Zxyorf5xHMHKwZAiG5NqMbH7XvFTL8E2ykNF";
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
workerRouter.post("/payout", middleware_1.authMiddleWareWorker, (req, res) => __awaiter(void 0, void 0, void 0, function* () { }));
exports.default = workerRouter;
