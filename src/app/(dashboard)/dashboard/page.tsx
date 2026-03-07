import { SiteHeader } from "../_components/site-header"

export default function DashboardPage() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <h2 className="text-2xl font-semibold">Home</h2>
      </div>
    </>
  )
}
