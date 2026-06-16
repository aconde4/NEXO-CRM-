import { redirect } from "next/navigation";

export default function RootPage() {
  // Más adelante (tarea 0.9) esto redirigirá a /login si no hay sesión.
  redirect("/dashboard");
}
