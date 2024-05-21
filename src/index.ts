import express from "express";
import userRouter from "./routers/user";
import workerRouter from "./routers/worker";
import "dotenv/config";
import cors from "cors";

const app = express();
app.use(cors());

app.use(express.json());

app.use("/v1/users", userRouter);
app.use("/v1/workers", workerRouter);

app.listen(3000, () => {
  console.log("App is running on PORT 3000");
});

app.get("/ping", async (req, res) => {
  res.send("pong");
});
