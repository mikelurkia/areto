# Plantillas de correo de Supabase Auth

Los correos de autenticación los envía Supabase, no la aplicación, así que su
HTML vive en el dashboard y no en el código. Estos ficheros son la copia buena:
se editan aquí, se revisan en el PR y se pegan en el dashboard.

## Cómo aplicarlas

Authentication → Email Templates → pestaña correspondiente → pegar en *Message
body* → **Save**.

| Fichero | Plantilla del dashboard | Cuándo se envía |
|---|---|---|
| `invite.html` | **Invite user** | Al invitar desde `/administracion/usuarios` |
| `magic-link.html` | **Magic Link** | Al pulsar «Reenviar invitación» |
| `reset-password.html` | **Reset Password** | «¿Has olvidado tu contraseña?» del login, y «Enviar restablecimiento» de la pantalla de usuarios |

Hay que aplicar las tres. La de **Magic Link** es la que se olvida: reenviar una
invitación a alguien cuya cuenta ya existe usa `signInWithOtp`, porque
`inviteUserByEmail` falla con `email_exists` en cuanto la cuenta está creada.
Sin esa plantilla, el reenvío manda un enlace que no lleva a ninguna parte.

## Lo único que no se puede tocar

El `href` de los enlaces:

```
{{ .RedirectTo }}&token_hash={{ .TokenHash }}&type=invite | magiclink | recovery
```

- **`{{ .RedirectTo }}`** y no `{{ .SiteURL }}`: lleva el destino que ha
  calculado la aplicación a partir de `SITE_URL`, y **ya trae el `?next=`
  puesto** — por eso lo siguiente se encadena con `&` y no con `?`. Así el mismo
  proyecto de Supabase sirve para local y para los Preview Deployments, que
  tienen dominios distintos. Requiere que el destino esté en la lista de
  *Redirect URLs* del dashboard; si no, Supabase lo descarta.
- **`token_hash` + `type`**: el enlace llega a `/auth/confirm`, que lo canjea
  con `verifyOtp`. No puede ir a `/auth/callback`, que hace
  `exchangeCodeForSession`: `inviteUserByEmail` no soporta PKCE, porque el
  navegador que invita no es el que acepta la invitación.

El texto, los colores y la estructura sí se pueden cambiar sin miedo.

## Decisiones de diseño

- **HTML de correo, no HTML de web**: tablas anidadas, estilos en línea y nada
  de flexbox, grid ni hojas de estilo. Outlook y Gmail se comen casi todo lo
  demás.
- **Bilingüe, euskera primero**: Supabase no sabe el idioma de quien recibe el
  correo (la plantilla es una sola para todo el mundo), así que van los dos
  idiomas en el mismo mensaje, en el orden del `defaultLocale` de la aplicación.
- **El logo sale de `{{ .SiteURL }}/logo.png`**, que es público. En local
  apuntará a `http://localhost:3000/logo.png` y el cliente de correo no podrá
  cargarlo: es normal, y por eso el diseño se sostiene sin la imagen.
- **Colores tomados de `src/app/globals.css`**, convertidos de `oklch` a
  hexadecimal porque ningún cliente de correo entiende `oklch`:
  `#026fd7` (primario), `#12161c` (texto), `#585e66` (texto atenuado),
  `#eff2f6` (fondo), `#dadee3` (bordes).
- **Enlace en texto plano además del botón**: si el cliente bloquea o rompe el
  botón, el enlace sigue estando.
