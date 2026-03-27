import { VERCEL_PROJECT_ID, VERCEL_TEAM_ID, vercel } from "@/lib/vercel";

export type DomainStatus =
	| "valid"
	| "pending_verification"
	| "invalid"
	| "not_found"
	| "error";

export type DnsRecord = {
	type: string;
	name: string;
	value: string;
};

export type DomainConfigResult = {
	status: DomainStatus;
	dnsRecords: DnsRecord[];
};

/**
 * Adiciona um domínio ao projeto na Vercel.
 */
export async function addDomain(domain: string) {
	return vercel.projects.addProjectDomain({
		idOrName: VERCEL_PROJECT_ID,
		teamId: VERCEL_TEAM_ID,
		requestBody: {
			name: domain,
			redirect: null,
			gitBranch: null,
		},
	});
}

/**
 * Remove um domínio do projeto na Vercel.
 */
export async function removeDomain(domain: string) {
	await Promise.all([
		vercel.projects.removeProjectDomain({
			idOrName: VERCEL_PROJECT_ID,
			teamId: VERCEL_TEAM_ID,
			domain,
		}),
		vercel.domains.deleteDomain({
			domain,
			teamId: VERCEL_TEAM_ID,
		}).catch(() => {
			// Ignora erro se o domínio não existe na conta (apenas no projeto)
		}),
	]);
}

/**
 * Verifica ownership de um domínio na Vercel.
 */
export async function verifyDomain(domain: string) {
	return vercel.projects.verifyProjectDomain({
		idOrName: VERCEL_PROJECT_ID,
		teamId: VERCEL_TEAM_ID,
		domain,
	});
}

/**
 * Busca o status de configuração DNS de um domínio.
 * Retorna o status e os registros DNS que o usuário precisa configurar.
 */
export async function getDomainConfig(
	domain: string,
): Promise<DomainConfigResult> {
	try {
		const [domainInfo, configInfo] = await Promise.all([
			vercel.projects
				.getProjectDomain({
					idOrName: VERCEL_PROJECT_ID,
					teamId: VERCEL_TEAM_ID,
					domain,
				})
				.catch(() => null),
			vercel.domains
				.getDomainConfig({
					domain,
					teamId: VERCEL_TEAM_ID,
				})
				.catch(() => null),
		]);

		if (!domainInfo) {
			return { status: "not_found", dnsRecords: [] };
		}

		// Se precisa de verificação TXT (domínio já em uso por outra conta Vercel)
		if (domainInfo.verification && domainInfo.verification.length > 0) {
			const dnsRecords: DnsRecord[] = domainInfo.verification.map((v) => ({
				type: v.type,
				name: v.domain,
				value: v.value,
			}));

			return { status: "pending_verification", dnsRecords };
		}

		// Se a configuração DNS está válida
		if (configInfo?.misconfigured === false) {
			return { status: "valid", dnsRecords: [] };
		}

		// DNS inválido — monta os registros que o usuário precisa configurar
		const dnsRecords: DnsRecord[] = [];
		const isApex = !domain.includes(".") || domain.split(".").length === 2;

		if (isApex) {
			dnsRecords.push({
				type: "A",
				name: "@",
				value: "76.76.21.21",
			});
		} else {
			dnsRecords.push({
				type: "CNAME",
				name: domain.split(".")[0],
				value: "cname.vercel-dns.com",
			});
		}

		return { status: "invalid", dnsRecords };
	} catch {
		return { status: "error", dnsRecords: [] };
	}
}
