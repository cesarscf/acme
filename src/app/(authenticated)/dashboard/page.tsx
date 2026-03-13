import { getOrganizations } from "@/lib/queries/organizations"

export default async function DashboardPage() {
  const organizations = await getOrganizations()

  return (
    <div className="flex flex-1 flex-col">
      {organizations.map((org) => (
        <div key={org.id}>{org.name}</div>
      ))}
    </div>
  )
}
