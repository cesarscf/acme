import { Elysia } from "elysia"
import { authPuglin } from "./plugins/auth"
import { corsPlugin } from "./plugins/cors"

const app = new Elysia()
  .use(corsPlugin)
  .use(authPuglin)
  .get("/", () => "Hello Elysia")
  .get("/protected", () => "Hello Protected", { auth: true })
  .listen(3333)

console.log(
  `🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`
)
