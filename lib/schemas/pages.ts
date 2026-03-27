import { z } from "zod";

export const templateEnum = z.enum(["links", "bio"]);
export type Template = z.infer<typeof templateEnum>;

export const linksContentSchema = z.object({
	links: z.array(
		z.object({
			title: z.string().min(1, "Titulo obrigatorio"),
			url: z.url("URL invalida"),
		}),
	),
});

export type LinksContent = z.infer<typeof linksContentSchema>;

export const bioContentSchema = z.object({
	bio: z.string().min(1, "Bio obrigatoria"),
	avatar: z.string().optional(),
	socialLinks: z.array(
		z.object({
			platform: z.string().min(1, "Plataforma obrigatoria"),
			url: z.url("URL invalida"),
		}),
	),
});

export type BioContent = z.infer<typeof bioContentSchema>;

export const defaultContent: Record<Template, string> = {
	links: JSON.stringify({ links: [] }),
	bio: JSON.stringify({ bio: "", socialLinks: [] }),
};

export const createPageSchema = z.object({
	title: z.string().min(1, "Titulo obrigatorio").max(200),
	path: z
		.string()
		.min(1, "Path obrigatorio")
		.regex(
			/^\/[a-z0-9-]*$/,
			"Path deve comecar com / e conter apenas letras minusculas, numeros e hifens",
		)
		.or(z.literal("/")),
	template: templateEnum,
});

export type CreatePageInput = z.infer<typeof createPageSchema>;

export const updatePageSchema = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(200).optional(),
	path: z
		.string()
		.min(1)
		.regex(/^\/[a-z0-9-]*$/)
		.or(z.literal("/"))
		.optional(),
	content: z.string().optional(),
	published: z.boolean().optional(),
});

export type UpdatePageInput = z.infer<typeof updatePageSchema>;
