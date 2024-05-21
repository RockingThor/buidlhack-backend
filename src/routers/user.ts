import { Router } from "express";
import jwt from "jsonwebtoken";
import { S3Client } from "@aws-sdk/client-s3";
import { authMiddleWare } from "../middlewares/middleware";
import { createPresignedPost } from "@aws-sdk/s3-presigned-post";
import { createTaskInput } from "../types/types";
import { prismaClient } from "../config/config";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import nacl from "tweetnacl";

const userRouter = Router();
const DEFAULT_TITLE = "Select the most attractive thumbnail.";

const s3Client = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_R || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_R || "",
  },
  region: "us-east-1",
});

//signin with wallet
userRouter.post("/signin", async (req, res) => {
  try {
    const { publicKey, signature } = req.body;
    const message = new TextEncoder().encode(
      "Jaldi se Jaldi Permission dedo sirf jaldi se jaldi permission dedo sir"
    );
    const result = nacl.sign.detached.verify(
      message,
      new Uint8Array(signature.data),
      new PublicKey(publicKey).toBytes()
    );

    if (!result) {
      return res.status(411).json({
        message: "Incorrect signature",
      });
    }

    const user = await prismaClient.user.findFirst({
      where: {
        address: publicKey,
      },
    });

    if (user) {
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET || "");
      return res.json({ token });
    } else {
      const newUser = await prismaClient.user.create({
        data: {
          address: publicKey,
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

userRouter.get("/presigned-url", authMiddleWare, async (req, res) => {
  //@ts-ignore
  const userId = req.userId;
  // const { url, fields } = await createPresignedPost(s3Client, {
  //     Bucket: "thumbnail-rohit",
  //     Key: `thumbnails/${userId}/${Math.random()}/image.jpg`,
  //     Conditions: [["content-length-range", 0, 5 * 1024 * 1024]],
  //     Fields: {
  //         "Content-Type": "image/png",
  //     },
  //     Expires: 3600,
  // });
  const { url, fields } = await createPresignedPost(s3Client, {
    Bucket: "thumbnail-rohit",
    Key: `thumbnails/${userId}/${Math.random()}/image.jpg`,
    Conditions: [
      ["content-length-range", 0, 5 * 1024 * 1024], // 5 MB max
    ],
    Expires: 3600,
  });

  return res.json({ preSignedURL: url, fields });
});

userRouter.post("/task", authMiddleWare, async (req, res) => {
  const body = req.body;
  //@ts-ignore
  const userId = req.userId;
  const parsedData = createTaskInput.safeParse(body);
  // console.log(parsedData);

  if (!parsedData.success) {
    return res
      .status(411)
      .json({ message: "You have sent data in wrong format" });
  }

  const transactionResponse = await prismaClient.$transaction(
    async (tx: any) => {
      const response = await tx.task.create({
        data: {
          title: parsedData.data.title || DEFAULT_TITLE,
          amount: "1",
          signature: parsedData.data.signature,
          user_id: userId,
          sampleSize: Number(parsedData.data.sampleSize),
          submissionCount: 0,
        },
      });
      await tx.option.createMany({
        data: parsedData.data.options.map((x) => ({
          image_url: x.imageUrl,
          task_id: response.id,
        })),
      });
      return response;
    },
    {
      maxWait: 5000, // default: 2000
      timeout: 10000, // default: 5000
    }
  );

  res.json({ id: transactionResponse.id });
});

userRouter.get("/task", authMiddleWare, async (req, res) => {
  const taskId = req.query.taskId;
  //@ts-ignore
  const userId = req.userId;

  if (!taskId) {
    return res.status(400).json({ message: "No task id provided" });
  }

  const task = await prismaClient.task.findFirst({
    where: {
      user_id: Number(userId),
      id: Number(taskId),
    },
    include: {
      options: true,
    },
  });

  if (!task) {
    return res.status(404).json({ message: "Task not found" });
  }

  //TODO: Make this operation efficient
  const responses = await prismaClient.submission.findMany({
    where: {
      task_id: Number(taskId),
    },
    include: {
      option: true,
    },
  });

  const result: Record<
    string,
    {
      count: number;
      option: {
        imageUrl: string;
      };
    }
  > = {};

  task.options.forEach((t) => {
    result[t.id] = {
      count: 0,
      option: {
        imageUrl: t.image_url,
      },
    };
  });
  responses.forEach((r) => {
    if (!result[r.option_id]) {
      result[r.option_id] = {
        count: 1,
        option: {
          imageUrl: r.option.image_url,
        },
      };
    } else {
      result[r.option_id].count++;
    }
  });
  return res.status(200).json({ result, taskDetails: task });
});

export default userRouter;
