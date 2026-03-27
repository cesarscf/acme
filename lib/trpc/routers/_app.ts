import { baseProcedure, createTRPCRouter } from "@/lib/trpc/init";
import { organizationsRouter } from "@/lib/trpc/routers/organizations";
import { pagesRouter } from "@/lib/trpc/routers/pages";

export const appRouter = createTRPCRouter({
	healthCheck: baseProcedure.query(() => {
		return { status: "ok" };
	}),
	organizations: organizationsRouter,
	pages: pagesRouter,
});

export type AppRouter = typeof appRouter;
