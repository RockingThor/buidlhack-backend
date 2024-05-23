import { Telegraf as TelegramBot, Context } from "telegraf";
import { Config } from "./config";
import { prismaClient } from "../../config/config";

export class Bot {
    private bot: TelegramBot;

    constructor() {
        this.bot = this.createTelegramBot();
    }

    public start() {
        this.bot.start(this.handleBotStart);
        this.bot.launch(this.handleBotLaunch);
        this.bot.command("payout", this.onPayOut);
    }

    // -------------------------------PRIVATE--------------------------------- //

    private createTelegramBot() {
        const botToken = Config.TELE_BOT_TOKEN;
        return new TelegramBot(botToken);
    }

    private async handleBotStart(ctx: Context) {
        const webLink = Config.TELE_BOT_WEB_LINK;

        ctx.reply("Hi! lets get you started Click the button below", {
            reply_markup: {
                inline_keyboard: [
                    [
                        {
                            text: "Get Started",
                            web_app: {
                                url: webLink,
                            },
                        },
                    ],
                ],
            },
        });
    }

    private async onPayOut(ctx: Context) {
        const userName = ctx.from?.username;

        const worker = await prismaClient.worker.findFirst({
            where: {
                telegram: userName,
            },
        });

        const payout = await prismaClient.payout.findFirst({
            where: {
                user_id: worker?.id,
            },
        });

        if (payout) {
            ctx.reply(
                `Your payment of ${payout.amount} SOL has been processed. The transaction signature is ${payout.signature}. You should receive your money within 24 hours.`
            );
        } else {
            ctx.reply("You have no pending payment.");
        }
    }

    private handleBotLaunch() {
        console.log("Bot is up and running...");
    }
}
