import { baseProcedure, createTRPCRouter } from "@/lib/trpc/init";
import { organizationsRouter } from "@/lib/trpc/routers/organizations";

export const appRouter = createTRPCRouter({
	healthCheck: baseProcedure.query(() => {
		return { status: "ok" };
	}),
	organizations: organizationsRouter,
});

export type AppRouter = typeof appRouter;
