"use strict";
var __awaiter =
  (this && this.__awaiter) ||
  function (thisArg, _arguments, P, generator) {
    function adopt(value) {
      return value instanceof P
        ? value
        : new P(function (resolve) {
            resolve(value);
          });
    }
    return new (P || (P = Promise))(function (resolve, reject) {
      function fulfilled(value) {
        try {
          step(generator.next(value));
        } catch (e) {
          reject(e);
        }
      }
      function rejected(value) {
        try {
          step(generator["throw"](value));
        } catch (e) {
          reject(e);
        }
      }
      function step(result) {
        result.done
          ? resolve(result.value)
          : adopt(result.value).then(fulfilled, rejected);
      }
      step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
  };
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const client_s3_1 = require("@aws-sdk/client-s3");
const middleware_1 = require("../middlewares/middleware");
const s3_presigned_post_1 = require("@aws-sdk/s3-presigned-post");
const types_1 = require("../types/types");
const config_1 = require("../config/config");
const web3_js_1 = require("@solana/web3.js");
const tweetnacl_1 = __importDefault(require("tweetnacl"));
const userRouter = (0, express_1.Router)();
const DEFAULT_TITLE = "Select the most attractive thumbnail.";
const s3Client = new client_s3_1.S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_R || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY_R || "",
  },
  region: "us-east-1",
});
//signin with wallet
userRouter.post("/signin", (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    try {
      const { publicKey, signature } = req.body;
      const message = new TextEncoder().encode(
        "Jaldi se Jaldi Permission dedo sirf jaldi se jaldi permission dedo sir"
      );
      const result = tweetnacl_1.default.sign.detached.verify(
        message,
        new Uint8Array(signature.data),
        new web3_js_1.PublicKey(publicKey).toBytes()
      );
      if (!result) {
        return res.status(411).json({
          message: "Incorrect signature",
        });
      }
      const user = yield config_1.prismaClient.user.findFirst({
        where: {
          address: publicKey,
        },
      });
      if (user) {
        const token = jsonwebtoken_1.default.sign(
          { userId: user.id },
          process.env.JWT_SECRET || ""
        );
        return res.json({ token });
      } else {
        const newUser = yield config_1.prismaClient.user.create({
          data: {
            address: publicKey,
          },
        });
        const token = jsonwebtoken_1.default.sign(
          { userId: newUser.id },
          process.env.JWT_SECRET || ""
        );
        return res.json({ token });
      }
    } catch (err) {
      res.status(500).json({ message: "Something went wrong" });
    }
  })
);
userRouter.get("/presigned-url", middleware_1.authMiddleWare, (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
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
    const { url, fields } = yield (0, s3_presigned_post_1.createPresignedPost)(
      s3Client,
      {
        Bucket: "thumbnail-rohit",
        Key: `thumbnails/${userId}/${Math.random()}/image.jpg`,
        Conditions: [
          ["content-length-range", 0, 5 * 1024 * 1024], // 5 MB max
        ],
        Expires: 3600,
      }
    );
    return res.json({ preSignedURL: url, fields });
  })
);
userRouter.post("/task", middleware_1.authMiddleWare, (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    const body = req.body;
    //@ts-ignore
    const userId = req.userId;
    const parsedData = types_1.createTaskInput.safeParse(body);
    // console.log(parsedData);
    if (!parsedData.success) {
      return res
        .status(411)
        .json({ message: "You have sent data in wrong format" });
    }
    const transactionResponse = yield config_1.prismaClient.$transaction(
      (tx) =>
        __awaiter(void 0, void 0, void 0, function* () {
          const response = yield tx.task.create({
            data: {
              title: parsedData.data.title || DEFAULT_TITLE,
              amount: "1",
              signature: parsedData.data.signature,
              user_id: userId,
              sampleSize: Number(parsedData.data.sampleSize),
              submissionCount: 0,
            },
          });
          yield tx.option.createMany({
            data: parsedData.data.options.map((x) => ({
              image_url: x.imageUrl,
              task_id: response.id,
            })),
          });
          return response;
        }),
      {
        maxWait: 5000, // default: 2000
        timeout: 10000, // default: 5000
      }
    );
    res.json({ id: transactionResponse.id });
  })
);
userRouter.get("/task", middleware_1.authMiddleWare, (req, res) =>
  __awaiter(void 0, void 0, void 0, function* () {
    const taskId = req.query.taskId;
    //@ts-ignore
    const userId = req.userId;
    if (!taskId) {
      return res.status(400).json({ message: "No task id provided" });
    }
    const task = yield config_1.prismaClient.task.findFirst({
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
    const responses = yield config_1.prismaClient.submission.findMany({
      where: {
        task_id: Number(taskId),
      },
      include: {
        option: true,
      },
    });
    const result = {};
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
  })
);
exports.default = userRouter;
