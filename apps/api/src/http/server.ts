import { cors } from "@elysiajs/cors"
import { Elysia } from "elysia"
import { authPuglin } from "./plugins/auth"

const app = new Elysia()
  .use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  )
  .use(authPuglin)
  .get("/", () => "Hello Elysia")
  .get("/protected", () => "Hello Protected", { auth: true })
  .listen(3333)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
