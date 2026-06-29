export const SALES_TEMPLATE_CATEGORY = "sales";

export type SalesEmailTemplate = {
  key: string;
  name: string;
  subject: string;
  bodyText: string;
};

export const SALES_EMAIL_TEMPLATES: SalesEmailTemplate[] = [
  {
    key: "first-contact",
    name: "Comercial - Primer contacto consultivo",
    subject: '{{empresa|"Tu empresa"}} - idea rapida',
    bodyText: `Hola {{nombre|"buenas"}},

Te escribo porque he visto que {{empresa|"vuestra empresa"}} trabaja en un contexto donde ordenar contactos, seguimientos y oportunidades suele marcar bastante diferencia.

En Nexo estamos trabajando en un sistema para ordenar contactos, embudos, emails y seguimientos sin perder oportunidades por el camino. La idea no es mandarte una presentacion larga, sino ver si hay un problema real que merezca una conversacion.

¿Te encajaria una llamada breve esta semana o la que viene?

Un saludo,`,
  },
  {
    key: "follow-up",
    name: "Comercial - Follow-up tras primer contacto",
    subject: 'Re: {{empresa|"tu equipo"}} y Nexo CRM',
    bodyText: `Hola {{nombre|"buenas"}},

Te escribo para retomar mi mensaje anterior. Creo que puede tener sentido revisar si {{empresa|"vuestra empresa"}} esta perdiendo oportunidades por falta de seguimiento, datos dispersos o embudos poco claros.

Si ahora no es prioridad, lo entiendo perfectamente. Si te encaja, puedo proponerte dos huecos y lo vemos en 15 minutos con algo concreto.

¿Te viene mejor esta semana o la siguiente?

Un saludo,`,
  },
  {
    key: "interest-reply",
    name: "Comercial - Respuesta a interes",
    subject: 'Siguiente paso para {{empresa|"tu equipo"}}',
    bodyText: `Hola {{nombre|"buenas"}},

Gracias por responder. Para que la conversacion sea util, te propongo centrarnos en tres puntos:

1. Como entran hoy los contactos y oportunidades.
2. Donde se pierde seguimiento.
3. Que tendria que pasar para que el CRM ayude en el dia a dia y no sea otra herramienta mas.

Si te parece, agendamos una llamada breve y salimos con un diagnostico claro, aunque decidamos que no es el momento.

¿Que dia te encaja?

Un saludo,`,
  },
  {
    key: "silence-recovery",
    name: "Comercial - Recuperacion de silencio",
    subject: '¿Lo dejamos para mas adelante, {{nombre|"buenas"}}?',
    bodyText: `Hola {{nombre|"buenas"}},

No quiero insistir si ahora no es el momento. Te escribo solo para cerrar el bucle.

Si ordenar contactos, campanas, embudos y seguimientos no es prioridad para {{empresa|"vuestra empresa"}} ahora mismo, lo dejo aparcado sin problema.

Si sigue teniendo sentido, puedo enviarte una propuesta de siguiente paso muy simple para valorarlo sin invertir demasiado tiempo.

¿Prefieres que lo dejemos para mas adelante o lo revisamos brevemente?

Un saludo,`,
  },
  {
    key: "meeting-close",
    name: "Comercial - Cierre para reunion",
    subject: 'Propuesta de llamada - {{empresa|"tu equipo"}}',
    bodyText: `Hola {{nombre|"buenas"}},

Por lo que hemos comentado, creo que la mejor forma de avanzar es una llamada corta para aterrizar el caso de {{empresa|"vuestra empresa"}} y ver si Nexo encaja de verdad.

La idea seria revisar vuestro flujo actual, detectar los puntos de friccion y salir con una recomendacion clara: seguir, aparcarlo o probar algo pequeño.

Tengo disponibilidad esta semana para una llamada de 20 minutos.

¿Te va bien que te proponga un par de huecos?

Un saludo,`,
  },
];
