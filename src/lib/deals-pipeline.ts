/**
 * Cookie que recuerda el último embudo de Negocios abierto (6.4f), para que al
 * volver a /deals sin parámetro en la URL se muestre ese embudo en vez del primero.
 * Vive en un módulo neutro (no "use client") porque la lee la página en servidor y
 * la escribe el combobox en cliente.
 */
export const DEALS_PIPELINE_COOKIE = "nexo_deals_pipeline";
