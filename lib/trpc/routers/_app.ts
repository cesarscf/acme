import { baseProcedure, createTRPCRouter } from "@/lib/trpc/init";

export const appRouter = createTRPCRouter({
	healthCheck: baseProcedure.query(() => {
		return { status: "ok" };
	}),
});

export type AppRouter = typeof appRouter;
