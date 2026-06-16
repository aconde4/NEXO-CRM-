/**
 * Datos de ejemplo para desarrollo. Ejecuta: `pnpm db:seed`.
 * Asocia los datos al usuario de la allowlist (el mismo del login de desarrollo).
 * Es idempotente: si ya hay contactos para ese usuario, no hace nada.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

async function main() {
  const { eq } = await import("drizzle-orm");
  const { db } = await import("./index");
  const { users, organizations, persons, notes } = await import("./schema");

  const email =
    (process.env.ALLOWED_EMAILS ?? "dev@nexo.local").split(",")[0]?.trim() ||
    "dev@nexo.local";

  let user = (
    await db.select().from(users).where(eq(users.email, email)).limit(1)
  )[0];
  if (!user) {
    user = (
      await db
        .insert(users)
        .values({ email, name: "Usuario de prueba (dev)" })
        .returning()
    )[0];
  }
  if (!user) throw new Error("No se pudo crear el usuario de ejemplo");

  const existing = await db.$count(persons, eq(persons.ownerId, user.id));
  if (existing > 0) {
    console.log(
      `Ya hay ${existing} contactos para ${email}. No se siembra de nuevo.`,
    );
    return;
  }

  const orgsData = [
    {
      name: "Innovatech Soluciones",
      domain: "innovatech.es",
      website: "https://innovatech.es",
      industry: "Software",
      size: "11-50",
      phone: "+34 911 223 344",
    },
    {
      name: "Marbella Hoteles",
      domain: "marbellahoteles.com",
      website: "https://marbellahoteles.com",
      industry: "Turismo",
      size: "51-200",
      phone: "+34 952 800 100",
    },
    {
      name: "Logística del Sur",
      domain: "logisur.es",
      website: "https://logisur.es",
      industry: "Logística",
      size: "201-500",
      phone: "+34 954 010 020",
    },
    {
      name: "Estudio Verde Arquitectura",
      domain: "estudioverde.es",
      industry: "Arquitectura",
      size: "1-10",
    },
  ];

  const insertedOrgs = await db
    .insert(organizations)
    .values(orgsData.map((o) => ({ ...o, ownerId: user.id })))
    .returning({ id: organizations.id, name: organizations.name });

  const orgByName = new Map(insertedOrgs.map((o) => [o.name, o.id]));

  const peopleData: Array<{
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
    title: string;
    org: string | null;
  }> = [
    { firstName: "Ana", lastName: "García", email: "ana.garcia@innovatech.es", phone: "+34 600 111 222", title: "Directora de Marketing", org: "Innovatech Soluciones" },
    { firstName: "Carlos", lastName: "Ruiz", email: "carlos.ruiz@innovatech.es", phone: "+34 600 333 444", title: "CTO", org: "Innovatech Soluciones" },
    { firstName: "Lucía", lastName: "Fernández", email: "lucia@marbellahoteles.com", phone: "+34 600 555 666", title: "Revenue Manager", org: "Marbella Hoteles" },
    { firstName: "Javier", lastName: "Moreno", email: "javier.moreno@marbellahoteles.com", title: "Director General", org: "Marbella Hoteles" },
    { firstName: "Elena", lastName: "Sánchez", email: "elena.sanchez@logisur.es", phone: "+34 600 777 888", title: "Jefa de Operaciones", org: "Logística del Sur" },
    { firstName: "Miguel", lastName: "Torres", email: "miguel.torres@logisur.es", title: "Responsable de Compras", org: "Logística del Sur" },
    { firstName: "Paula", lastName: "Navarro", email: "paula@estudioverde.es", phone: "+34 600 999 000", title: "Arquitecta", org: "Estudio Verde Arquitectura" },
    { firstName: "Diego", lastName: "Romero", email: "diego.romero@gmail.com", phone: "+34 611 222 333", title: "Consultor independiente", org: null },
    { firstName: "Marta", lastName: "Gil", email: "marta.gil@hotmail.com", title: "Emprendedora", org: null },
    { firstName: "Sergio", lastName: "Castro", email: "sergio.castro@innovatech.es", phone: "+34 622 333 444", title: "Comercial", org: "Innovatech Soluciones" },
  ];

  const insertedPeople = await db
    .insert(persons)
    .values(
      peopleData.map((p) => ({
        firstName: p.firstName,
        lastName: p.lastName,
        email: p.email,
        phone: p.phone ?? null,
        title: p.title,
        orgId: p.org ? (orgByName.get(p.org) ?? null) : null,
        source: "Datos de ejemplo",
        ownerId: user.id,
      })),
    )
    .returning({ id: persons.id });

  const firstPerson = insertedPeople[0];
  if (firstPerson) {
    await db.insert(notes).values([
      {
        body: "Contacto inicial por LinkedIn. Interesada en una demo del producto la próxima semana.",
        personId: firstPerson.id,
        ownerId: user.id,
      },
      {
        body: "Enviada propuesta. Pendiente de confirmar presupuesto con dirección.",
        personId: firstPerson.id,
        ownerId: user.id,
      },
    ]);
  }

  console.log(
    `✓ Sembrados ${insertedOrgs.length} empresas y ${insertedPeople.length} contactos para ${email}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
