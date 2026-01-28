import { createRouter, RouterProvider } from "@tanstack/react-router"
import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import * as TanstackQuery from "./integrations/tanstack-query/root-provider"
import { routeTree } from "./route-tree.gen.ts"

import "./index.css"

const queryContext = TanstackQuery.getContext()

const router = createRouter({
  routeTree,
  defaultPreload: "intent",
  context: {
    ...queryContext,
  },
})

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router
  }
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <TanstackQuery.Provider queryClient={queryContext.queryClient}>
      <RouterProvider router={router} />
    </TanstackQuery.Provider>
  </StrictMode>
)
