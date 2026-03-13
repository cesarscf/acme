import { getTenants } from "@/lib/queries/tenants"

export default async function DashboardPage() {
  const tenants = await getTenants()

  return (
    <div className="flex flex-1 flex-col">
      {tenants.map((tentant) => (
        <div key={tentant.id}>{tentant.name}</div>
      ))}
    </div>
  )
}
