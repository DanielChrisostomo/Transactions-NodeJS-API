import { FastifyInstance } from "fastify";
import { z } from "zod"
import { knex } from "../database"
import { randomUUID } from "node:crypto";
import { checkSessionIdExists } from "../middlewares/check-session-id-exists";

export async function transactionsRoutes(app: FastifyInstance) {

    app.addHook('preHandler', async (request, reply) => {
        console.log(`${request.method} ${request.url}`)   
    })

    app.get("/", { preHandler: [checkSessionIdExists] }, async (req, reply) => {

        const { sessionId } = req.cookies

        const transactions = await knex("transactions").where("session_id", sessionId)
        .select()

        return { transactions }
    })

    app.get('/summary', { preHandler: [checkSessionIdExists] }, async (req, reply) => {
        const { sessionId } = req.cookies

        const summary = await knex('transactions')
          .where('session_id', sessionId)
          .sum('amount', { as: 'amount' })
          .first()
    
        return { summary }
      })

    app.get("/:id", { preHandler: [checkSessionIdExists] } ,async (req, reply) => {

        const { sessionId } = req.cookies

        const getTransactionsParamsSchema = z.object({
            id: z.string().uuid(),
        })

        const { id } = getTransactionsParamsSchema.parse(req.params)

        const transaction = await knex('transactions')
        .where({
            session_id: sessionId,
            id: id
        })
        .first()

        return { transaction }

    })

    app.post("/", async (req, reply) => {

        console.log(req)

        const createTransactionBodySchema = z.object({
            title: z.string(),
            amount: z.number(),
            type: z.enum(["credit", "debit"])
        })

        const { title, amount, type } = createTransactionBodySchema.parse(req.body)

        let sessionId = req.cookies.sessionId

        if(!sessionId) {
            sessionId = randomUUID()

            reply.cookie("sessionId", sessionId, {
                path: '/',
                maxAge: 60 * 60 * 24 * 7 // 7 days
            })
        }

        await knex("transactions")
        .insert({
            id: randomUUID(),
            title,
            amount: type === "credit" ? amount : amount * -1,
            session_id: sessionId
        })

        return reply.status(201).send()
    })
}
