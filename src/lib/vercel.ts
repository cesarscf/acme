import { env } from "@/env"

function teamParam() {
  return env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : ""
}

function headers() {
  return { Authorization: `Bearer ${env.VERCEL_AUTH_TOKEN}` }
}

export async function addDomainToVercel(domain: string) {
  const res = await fetch(
    `https://api.vercel.com/v10/projects/${env.VERCEL_PROJECT_ID}/domains${teamParam()}`,
    {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: domain }),
    }
  )

  if (!res.ok) {
    const data = await res.json()
    throw new Error(data.error?.message || "Failed to add domain to Vercel")
  }

  return res.json()
}

export async function removeDomainFromVercel(domain: string) {
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${env.VERCEL_PROJECT_ID}/domains/${domain}${teamParam()}`,
    {
      method: "DELETE",
      headers: headers(),
    }
  )

  if (!res.ok) {
    const data = await res.json()
    throw new Error(
      data.error?.message || "Failed to remove domain from Vercel"
    )
  }

  return res.json()
}
