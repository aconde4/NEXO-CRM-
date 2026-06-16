import type { ReactNode } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { AppTopbar } from "@/components/app-topbar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import type { SessionUser } from "@/components/user-menu";

// Placeholder hasta conectar el inicio de sesión (tarea 0.9).
// Entonces se sustituirá por la sesión real de Auth.js.
const placeholderUser: SessionUser = {
  name: null,
  email: "acondeuceda@gmail.com",
  image: null,
};

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar user={placeholderUser} />
      <SidebarInset>
        <AppTopbar />
        <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  );
}
