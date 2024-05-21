import { Router } from "express";
import jwt from "jsonwebtoken";
import { authMiddleWareWorker } from "../middlewares/middleware";
import { prismaClient } from "../config/config";
import { getNextTask } from "../utils/dbLogic";
import { createSubmissionInput } from "../types/types";

const workerRouter = Router();

workerRouter.post("/signin", async (req, res) => {
    try {
        const walletAddress =
            req.body.wallet || "GLvVMs13Zxyorf5xHMHKwZAiG5NqMbH7XvFTL8E2ykNF";
        const telegram = req.body.telegram;

        const user = await prismaClient.worker.findFirst({
            where: {
                telegram,
            },
        });

        if (user) {
            const token = jwt.sign(
                { userId: user.id },
                process.env.JWT_SECRET_WORKER || ""
            );
            return res.json({ token });
        } else {
            const newUser = await prismaClient.worker.create({
                data: {
                    address: walletAddress,
                    pending_amount: 0,
                    locked_amount: 0,
                    telegram,
                },
            });
            const token = jwt.sign(
                { userId: newUser.id },
                process.env.JWT_SECRET || ""
            );
            return res.json({ token });
        }
    } catch (err) {
        res.status(500).json({ message: "Something went wrong" });
    }
});

workerRouter.get("/nextTask", authMiddleWareWorker, async (req, res) => {
    //@ts-ignore
    const userId = req.userId;

    const tasks = await getNextTask(Number(userId));

    if (!tasks) {
        return res.status(200).json("No more tasks for you.");
    } else {
        return res.status(200).json({ tasks });
    }
});

workerRouter.post("/submission", authMiddleWareWorker, async (req, res) => {
    const body = req.body;
    const parsedData = createSubmissionInput.safeParse(body);
    //@ts-ignore
    const userId = req.userId;

    if (!parsedData.success) {
        return res
            .status(401)
            .json({ message: "Arguments sent is not in correct format" });
    }

    const task = await getNextTask(Number(userId));
    if (!(task?.id === Number(parsedData.data.taskId))) {
        return res
            .status(411)
            .json({ message: "You are not allowed to submit for this task" });
    }

    const amount: number = (Number(task.amount) * 1000000000) / task.sampleSize;

    const transactionResponse = await prismaClient.$transaction(async (tx) => {
        const response = await tx.submission.create({
            data: {
                option_id: Number(parsedData.data.selection),
                worker_id: Number(userId),
                task_id: Number(parsedData.data.taskId),
                amount: String(amount),
            },
        });

        await tx.task.update({
            where: {
                id: task.id,
            },
            data: {
                submissionCount: task.submissionCount + 1,
            },
        });

        const currentPendingAmount = await tx.worker.findFirst({
            where: {
                id: Number(userId),
            },
        });

        await tx.worker.update({
            where: {
                id: Number(userId),
            },
            data: {
                pending_amount:
                    Number(currentPendingAmount?.pending_amount) +
                    Number(response.amount),
            },
        });

        return response;
    });

    const nextTask = getNextTask(Number(userId));

    if (transactionResponse) {
        return res.status(200).json({
            message: "Your task submission successful.",
            submissionStatus: true,
            amount: transactionResponse.amount,
            nextTask,
        });
    } else {
        return res.status(200).json({
            message: "Your task submission failed.",
            submissionStatus: false,
            amount: 0,
            nextTask,
        });
    }
});

workerRouter.get("/balance", authMiddleWareWorker, async (req, res) => {
    //@ts-ignore
    const userId = req.userId;

    const worker = await prismaClient.worker.findFirst({
        where: {
            id: userId,
        },
    });

    if (!worker) {
        return res.status(404).json({ messsage: "No user found" });
    } else {
        return res.status(200).json({
            pending_balance: worker.pending_amount,
            locked_amount: worker.locked_amount,
            balance: worker.pending_amount + worker.locked_amount,
        });
    }
});

workerRouter.post("/payout", authMiddleWareWorker, async (req, res) => {});

export default workerRouter;
