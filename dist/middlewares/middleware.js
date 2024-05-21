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
exports.authMiddleWareWorker = exports.authMiddleWare = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
function authMiddleWare(req, res, next) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        return res.status(403).json({ message: "The user is not signed in" });
    }
    try {
        const decoded = jsonwebtoken_1.default.verify(authHeader, process.env.JWT_SECRET || "");
        //@ts-ignore
        if (decoded.userId) {
            //@ts-ignore
            req.userId = decoded.userId;
            return next();
        }
        else {
            return res
                .status(403)
                .json({ message: "The user is not signed in" });
        }
    }
    catch (err) {
        return res.status(403).json({ message: "The user is not signed in" });
    }
}
exports.authMiddleWare = authMiddleWare;
function authMiddleWareWorker(req, res, next) {
    return __awaiter(this, void 0, void 0, function* () {
        const authHeader = req.headers["authorization"];
        if (!authHeader) {
            return res.status(403).json({ message: "The user is not signed in" });
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(authHeader, process.env.JWT_SECRET_WORKER || "");
            //@ts-ignore
            if (decoded.userId) {
                //@ts-ignore
                req.userId = decoded.userId;
                return next();
            }
            else {
                return res
                    .status(403)
                    .json({ message: "The user is not signed in" });
            }
        }
        catch (err) {
            return res.status(403).json({ message: "The user is not signed in" });
        }
    });
}
exports.authMiddleWareWorker = authMiddleWareWorker;
