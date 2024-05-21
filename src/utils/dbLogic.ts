import { prismaClient } from "../config/config";

export const getNextTask = async (id: number) => {
    const task = await prismaClient.task.findFirst({
        where: {
            done: false,
            submissions: {
                none: {
                    worker_id: Number(id),
                },
            },
        },
        select: {
            submissionCount: true,
            sampleSize: true,
            amount: true,
            id: true,
            title: true,
            options: true,
        },
    });

    return task;
};
