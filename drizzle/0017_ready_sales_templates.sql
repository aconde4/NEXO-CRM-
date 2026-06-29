-- Fase T.2: plantillas comerciales base para usuarios existentes.
-- Idempotente: conserva plantillas editadas o creadas por el usuario con el mismo nombre.
INSERT INTO "email_templates" (
  "owner_id",
  "name",
  "category",
  "subject",
  "body_text",
  "body_html",
  "variables"
)
SELECT
  "user"."id",
  preset."name",
  'sales',
  preset."subject",
  preset."body_text",
  preset."body_html",
  preset."variables"::jsonb
FROM "user"
CROSS JOIN (
  VALUES
    (
      'Comercial - Primer contacto consultivo',
      '{{empresa|"Tu empresa"}} - idea rapida',
      $body$Hola {{nombre|"buenas"}},

Te escribo porque he visto que {{empresa|"vuestra empresa"}} trabaja en un contexto donde ordenar contactos, seguimientos y oportunidades suele marcar bastante diferencia.

En Nexo estamos trabajando en un sistema para ordenar contactos, embudos, emails y seguimientos sin perder oportunidades por el camino. La idea no es mandarte una presentacion larga, sino ver si hay un problema real que merezca una conversacion.

¿Te encajaria una llamada breve esta semana o la que viene?

Un saludo,$body$,
      $html$<p>Hola {{nombre|"buenas"}},</p><p>Te escribo porque he visto que {{empresa|"vuestra empresa"}} trabaja en un contexto donde ordenar contactos, seguimientos y oportunidades suele marcar bastante diferencia.</p><p>En Nexo estamos trabajando en un sistema para ordenar contactos, embudos, emails y seguimientos sin perder oportunidades por el camino. La idea no es mandarte una presentacion larga, sino ver si hay un problema real que merezca una conversacion.</p><p>¿Te encajaria una llamada breve esta semana o la que viene?</p><p>Un saludo,</p>$html$,
      '["empresa","nombre"]'
    ),
    (
      'Comercial - Follow-up tras primer contacto',
      'Re: {{empresa|"tu equipo"}} y Nexo CRM',
      $body$Hola {{nombre|"buenas"}},

Te escribo para retomar mi mensaje anterior. Creo que puede tener sentido revisar si {{empresa|"vuestra empresa"}} esta perdiendo oportunidades por falta de seguimiento, datos dispersos o embudos poco claros.

Si ahora no es prioridad, lo entiendo perfectamente. Si te encaja, puedo proponerte dos huecos y lo vemos en 15 minutos con algo concreto.

¿Te viene mejor esta semana o la siguiente?

Un saludo,$body$,
      $html$<p>Hola {{nombre|"buenas"}},</p><p>Te escribo para retomar mi mensaje anterior. Creo que puede tener sentido revisar si {{empresa|"vuestra empresa"}} esta perdiendo oportunidades por falta de seguimiento, datos dispersos o embudos poco claros.</p><p>Si ahora no es prioridad, lo entiendo perfectamente. Si te encaja, puedo proponerte dos huecos y lo vemos en 15 minutos con algo concreto.</p><p>¿Te viene mejor esta semana o la siguiente?</p><p>Un saludo,</p>$html$,
      '["empresa","nombre"]'
    ),
    (
      'Comercial - Respuesta a interes',
      'Siguiente paso para {{empresa|"tu equipo"}}',
      $body$Hola {{nombre|"buenas"}},

Gracias por responder. Para que la conversacion sea util, te propongo centrarnos en tres puntos:

1. Como entran hoy los contactos y oportunidades.
2. Donde se pierde seguimiento.
3. Que tendria que pasar para que el CRM ayude en el dia a dia y no sea otra herramienta mas.

Si te parece, agendamos una llamada breve y salimos con un diagnostico claro, aunque decidamos que no es el momento.

¿Que dia te encaja?

Un saludo,$body$,
      $html$<p>Hola {{nombre|"buenas"}},</p><p>Gracias por responder. Para que la conversacion sea util, te propongo centrarnos en tres puntos:</p><p>1. Como entran hoy los contactos y oportunidades.<br />2. Donde se pierde seguimiento.<br />3. Que tendria que pasar para que el CRM ayude en el dia a dia y no sea otra herramienta mas.</p><p>Si te parece, agendamos una llamada breve y salimos con un diagnostico claro, aunque decidamos que no es el momento.</p><p>¿Que dia te encaja?</p><p>Un saludo,</p>$html$,
      '["empresa","nombre"]'
    ),
    (
      'Comercial - Recuperacion de silencio',
      '¿Lo dejamos para mas adelante, {{nombre|"buenas"}}?',
      $body$Hola {{nombre|"buenas"}},

No quiero insistir si ahora no es el momento. Te escribo solo para cerrar el bucle.

Si ordenar contactos, campanas, embudos y seguimientos no es prioridad para {{empresa|"vuestra empresa"}} ahora mismo, lo dejo aparcado sin problema.

Si sigue teniendo sentido, puedo enviarte una propuesta de siguiente paso muy simple para valorarlo sin invertir demasiado tiempo.

¿Prefieres que lo dejemos para mas adelante o lo revisamos brevemente?

Un saludo,$body$,
      $html$<p>Hola {{nombre|"buenas"}},</p><p>No quiero insistir si ahora no es el momento. Te escribo solo para cerrar el bucle.</p><p>Si ordenar contactos, campanas, embudos y seguimientos no es prioridad para {{empresa|"vuestra empresa"}} ahora mismo, lo dejo aparcado sin problema.</p><p>Si sigue teniendo sentido, puedo enviarte una propuesta de siguiente paso muy simple para valorarlo sin invertir demasiado tiempo.</p><p>¿Prefieres que lo dejemos para mas adelante o lo revisamos brevemente?</p><p>Un saludo,</p>$html$,
      '["empresa","nombre"]'
    ),
    (
      'Comercial - Cierre para reunion',
      'Propuesta de llamada - {{empresa|"tu equipo"}}',
      $body$Hola {{nombre|"buenas"}},

Por lo que hemos comentado, creo que la mejor forma de avanzar es una llamada corta para aterrizar el caso de {{empresa|"vuestra empresa"}} y ver si Nexo encaja de verdad.

La idea seria revisar vuestro flujo actual, detectar los puntos de friccion y salir con una recomendacion clara: seguir, aparcarlo o probar algo pequeño.

Tengo disponibilidad esta semana para una llamada de 20 minutos.

¿Te va bien que te proponga un par de huecos?

Un saludo,$body$,
      $html$<p>Hola {{nombre|"buenas"}},</p><p>Por lo que hemos comentado, creo que la mejor forma de avanzar es una llamada corta para aterrizar el caso de {{empresa|"vuestra empresa"}} y ver si Nexo encaja de verdad.</p><p>La idea seria revisar vuestro flujo actual, detectar los puntos de friccion y salir con una recomendacion clara: seguir, aparcarlo o probar algo pequeño.</p><p>Tengo disponibilidad esta semana para una llamada de 20 minutos.</p><p>¿Te va bien que te proponga un par de huecos?</p><p>Un saludo,</p>$html$,
      '["empresa","nombre"]'
    )
) AS preset("name", "subject", "body_text", "body_html", "variables")
ON CONFLICT ("owner_id", "name") DO NOTHING;
