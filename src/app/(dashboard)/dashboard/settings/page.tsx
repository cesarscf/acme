import { SiteHeader } from "../../_components/site-header"

export default function SettingsPage() {
  return (
    <>
      <SiteHeader />
      <div className="flex flex-1 flex-col gap-4 p-4 lg:p-6">
        <div>
          <h2 className="text-2xl font-semibold">Configuracoes</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Gerencie as configuracoes da sua conta
          </p>
        </div>
      </div>
    </>
  )
}
