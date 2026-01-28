import { cors } from "@elysiajs/cors"
import { Elysia } from "elysia"

export const corsPlugin = new Elysia({ name: "cors" }).use(
  cors({
    origin: "http://localhost:3000",
    credentials: true,
  })
)
