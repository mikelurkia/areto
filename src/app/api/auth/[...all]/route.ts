import { toNextJsHandler } from "better-auth/next-js";

import { auth } from "@/lib/better-auth";

// Endpoints HTTP de Better Auth. La aplicación los llama desde el servidor
// (`auth.api.*`); por aquí pasan solo los enlaces del correo, como el de
// verificar un cambio de email.
export const { GET, POST } = toNextJsHandler(auth);
