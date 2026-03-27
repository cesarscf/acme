import { Vercel } from "@vercel/sdk";

export const vercel = new Vercel({
	bearerToken: process.env.VERCEL_TOKEN,
});

export const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID as string;
export const VERCEL_TEAM_ID = process.env.VERCEL_TEAM_ID;
