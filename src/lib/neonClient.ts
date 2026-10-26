import { createClient } from '@neondatabase/neon-js';

const dataApiUrl = import.meta.env.VITE_NEON_DATA_API_URL as
  | string
  | undefined;
const authUrl = import.meta.env.VITE_NEON_AUTH_URL as string | undefined;

export const neonConfigError =
  !dataApiUrl || !authUrl
    ? 'Faltan VITE_NEON_DATA_API_URL o VITE_NEON_AUTH_URL en el archivo .env.'
    : null;

/**
 * Cliente oficial de Neon (Neon Auth + Data API).
 *
 * allowAnonymous permite leer y escribir mediante las políticas RLS
 * configuradas para el rol anónimo. No sustituye a RLS: si una tabla
 * no tiene políticas, el acceso anónimo será rechazado.
 */
export const neonClient =
  dataApiUrl && authUrl
    ? createClient({
        auth: {
          url: authUrl,
          allowAnonymous: true,
        },
        dataApi: {
          url: dataApiUrl,
        },
      })
    : null;

export const isNeonConfigured = neonClient !== null;
