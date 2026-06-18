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
  const {
    users,
    organizations,
    persons,
    notes,
    labels,
    entityLabels,
    activities,
    customFieldDefs,
    pipelines,
    stages,
    deals,
  } = await import("./schema");

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
      tradeName: "Innovatech",
      domain: "innovatech.es",
      website: "https://innovatech.es",
      industry: "Software",
      size: "11-50",
      phone: "+34 911 223 344",
    },
    {
      name: "Marbella Hoteles",
      tradeName: "MH Resorts",
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

  // Etiquetas de ejemplo + asignaciones a los primeros contactos.
  const createdLabels = await db
    .insert(labels)
    .values([
      { name: "Cliente", color: "#10b981", ownerId: user.id },
      { name: "Lead", color: "#6366f1", ownerId: user.id },
      { name: "VIP", color: "#f59e0b", ownerId: user.id },
    ])
    .returning({ id: labels.id });

  const labelAssignments = insertedPeople
    .slice(0, 6)
    .map((p, i) => ({
      labelId: createdLabels[i % createdLabels.length]!.id,
      entityType: "person" as const,
      entityId: p.id,
    }));
  if (labelAssignments.length) {
    await db.insert(entityLabels).values(labelAssignments);
  }

  // Actividades de ejemplo: una vencida, una para hoy, próximas y una hecha.
  const at = (days: number, hour = 10, minute = 0) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d;
  };
  const firstOrgId = insertedOrgs[0]?.id ?? null;
  const activitiesData = [
    { type: "call", subject: "Llamar para confirmar la demo", dueAt: at(-1, 11), personId: insertedPeople[0]?.id ?? null, orgId: null, done: false, doneAt: null },
    { type: "meeting", subject: "Reunión de seguimiento", dueAt: at(0, 16), personId: insertedPeople[2]?.id ?? null, orgId: null, done: false, doneAt: null },
    { type: "task", subject: "Enviar propuesta revisada", dueAt: at(1, 9, 30), personId: insertedPeople[4]?.id ?? null, orgId: null, done: false, doneAt: null },
    { type: "email", subject: "Hacer seguimiento del presupuesto", dueAt: at(3, 12), personId: null, orgId: firstOrgId, done: false, doneAt: null },
    { type: "task", subject: "Preparar materiales de la presentación", dueAt: at(-3, 10), personId: insertedPeople[1]?.id ?? null, orgId: null, done: true, doneAt: at(-2, 15) },
  ] as const;
  await db
    .insert(activities)
    .values(activitiesData.map((a) => ({ ...a, ownerId: user.id })));

  // Campos personalizados de ejemplo (Fase 1.8).
  await db.insert(customFieldDefs).values([
    {
      entityType: "person" as const,
      key: "linkedin",
      label: "LinkedIn",
      type: "url" as const,
      position: 1,
      ownerId: user.id,
    },
    {
      entityType: "organization" as const,
      key: "ingresos_anuales",
      label: "Ingresos anuales",
      type: "monetary" as const,
      position: 1,
      ownerId: user.id,
    },
  ]);

  // Embudo + etapas + negocios de ejemplo (Fase 2).
  const [pipeline] = await db
    .insert(pipelines)
    .values({ name: "Embudo de ventas", isDefault: true, ownerId: user.id })
    .returning({ id: pipelines.id });
  const stagesData = [
    { name: "Calificación", probability: 20, rottingDays: 14 },
    { name: "Contacto establecido", probability: 40, rottingDays: 14 },
    { name: "Propuesta enviada", probability: 60, rottingDays: 21 },
    { name: "Negociación", probability: 80, rottingDays: 30 },
  ];
  const insertedStages = pipeline
    ? await db
        .insert(stages)
        .values(
          stagesData.map((s, i) => ({
            pipelineId: pipeline.id,
            name: s.name,
            position: i,
            probability: s.probability,
            rottingDays: s.rottingDays,
            ownerId: user.id,
          })),
        )
        .returning({ id: stages.id })
    : [];

  if (pipeline && insertedStages.length === 4) {
    const dealsData = [
      { title: "Suscripción anual — Innovatech", value: 12000, stage: 0, person: 0, org: 0, pos: 0, rotting: false },
      { title: "Renovación — Marbella Hoteles", value: 8000, stage: 0, person: null, org: 1, pos: 1, rotting: false },
      { title: "Implantación CRM", value: 25000, stage: 1, person: 2, org: null, pos: 0, rotting: false },
      { title: "Consultoría estratégica", value: 5000, stage: 2, person: null, org: 2, pos: 0, rotting: true },
      { title: "Ampliación de licencias", value: 18000, stage: 3, person: 4, org: 0, pos: 0, rotting: false },
    ];
    await db.insert(deals).values(
      dealsData.map((d) => ({
        title: d.title,
        value: d.value,
        currency: "EUR",
        pipelineId: pipeline.id,
        stageId: insertedStages[d.stage]!.id,
        personId: d.person != null ? (insertedPeople[d.person]?.id ?? null) : null,
        orgId: d.org != null ? (insertedOrgs[d.org]?.id ?? null) : null,
        position: d.pos,
        ownerId: user.id,
        stageChangedAt: d.rotting ? at(-40) : new Date(),
      })),
    );
  }

  console.log(
    `✓ Sembrados ${insertedOrgs.length} empresas, ${insertedPeople.length} contactos, ${createdLabels.length} etiquetas, ${activitiesData.length} actividades, 2 campos personalizados y 1 embudo con 5 negocios para ${email}.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
