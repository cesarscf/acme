import { NextRequest, NextResponse } from "next/server"
import { env } from "@/env"

export async function GET(request: NextRequest) {
  const domain = request.nextUrl.searchParams.get("domain")

  if (!domain) {
    return NextResponse.json({ error: "Domain is required" }, { status: 400 })
  }

  const teamParam = env.VERCEL_TEAM_ID ? `?teamId=${env.VERCEL_TEAM_ID}` : ""

  try {
    const [configRes, verifyRes] = await Promise.all([
      fetch(`https://api.vercel.com/v6/domains/${domain}/config${teamParam}`, {
        headers: { Authorization: `Bearer ${env.VERCEL_AUTH_TOKEN}` },
      }),
      fetch(
        `https://api.vercel.com/v9/projects/${env.VERCEL_PROJECT_ID}/domains/${domain}/verify${teamParam}`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${env.VERCEL_AUTH_TOKEN}` },
        }
      ),
    ])

    const configData = await configRes.json()
    const verifyData = await verifyRes.json()

    const configured = configData.misconfigured === false

    return NextResponse.json({
      configured,
      verification: verifyData,
      config: configData,
    })
  } catch {
    return NextResponse.json(
      { error: "Failed to check domain" },
      { status: 500 }
    )
  }
}
