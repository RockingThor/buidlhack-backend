import { NextFunction, Response, Request } from "express";
import jwt from "jsonwebtoken";

export function authMiddleWare(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(403).json({ message: "The user is not signed in" });
    }

    try {
        const decoded = jwt.verify(authHeader, process.env.JWT_SECRET || "");
        //@ts-ignore
        if (decoded.userId) {
            //@ts-ignore
            req.userId = decoded.userId;
            return next();
        } else {
            return res
                .status(403)
                .json({ message: "The user is not signed in" });
        }
    } catch (err) {
        return res.status(403).json({ message: "The user is not signed in" });
    }
}

export async function authMiddleWareWorker(
    req: Request,
    res: Response,
    next: NextFunction
) {
    const authHeader = req.headers["authorization"];

    if (!authHeader) {
        return res.status(403).json({ message: "The user is not signed in" });
    }
    try {
        const decoded = jwt.verify(
            authHeader,
            process.env.JWT_SECRET_WORKER || ""
        );
        //@ts-ignore
        if (decoded.userId) {
            //@ts-ignore
            req.userId = decoded.userId;
            return next();
        } else {
            return res
                .status(403)
                .json({ message: "The user is not signed in" });
        }
    } catch (err) {
        return res.status(403).json({ message: "The user is not signed in" });
    }
}
