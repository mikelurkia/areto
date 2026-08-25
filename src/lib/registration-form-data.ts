/**
 * Lectura del `FormData` de inscripción a los campos que se devuelven al
 * formulario, y el estado que los transporta.
 *
 * Vive aquí y no en `inscripcion/actions.ts` porque hacen falta en los dos
 * lados. El servidor los usa para el eco de un envío rechazado; el cliente,
 * para construir ese mismo eco cuando la petición NO llega a ejecutarse en el
 * servidor —cortada por tamaño en la plataforma, o una red móvil que se cae a
 * mitad de la subida— y por tanto no hay respuesta que devolverlo. Ver el
 * envoltorio de `submitTeamRegistration` en `jugador-form.tsx`.
 *
 * Un fichero `"use server"` no puede exportar nada que no sea una Server
 * Action, así que esto no cabía allí (mismo motivo que
 * `registration-guardians.ts`).
 */

import { readGuardians } from "./registration-guardians";

export type SubmittedGuardian = {
  firstName: string;
  lastName: string;
  birthDate: string;
  nationalId: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
};

/** Eco de lo que el usuario había rellenado. React 19 resetea los campos no
 * controlados de un `<form action>` tras CUALQUIER envío (éxito o error), así
 * que sin repoblar desde aquí un solo campo inválido (p. ej. el IBAN) borraría
 * todo lo demás que ya había escrito.
 *
 * Los ficheros son la excepción: un `<input type="file">` no se puede
 * repoblar por seguridad, así que las fotos siempre hay que volver a
 * adjuntarlas. */
export type SubmittedFields = {
  firstName: string;
  lastName: string;
  birthDate: string;
  nationalId: string;
  address: string;
  city: string;
  postalCode: string;
  phone: string;
  email: string;
  iban: string;
  photoConsent: boolean;
  privacyConsent: boolean;
  shirtSize?: string;
  pantsSize?: string;
  shoeSize?: string;
  installmentsChosen?: number;
  sepaConsent?: boolean;
  termsConsent?: boolean;
  guardians: SubmittedGuardian[];
};

/**
 * Lo que trae SIEMPRE el formulario de jugador. `SubmittedFields` deja
 * opcional todo lo que el de socio no tiene (tallas, plazos, consentimientos
 * de SEPA y condiciones); aquí se concreta, para que el insert no tenga que
 * defenderse de un `undefined` que en este camino no puede llegar.
 */
export type PlayerFields = SubmittedFields & {
  shirtSize: string;
  pantsSize: string;
  shoeSize: string;
  installmentsChosen: number;
  sepaConsent: boolean;
  termsConsent: boolean;
};

export type RegistrationState = {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: boolean;
  registrationId?: string;
  submitted?: SubmittedFields;
};

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? "").trim();
}

/** Los checkbox de un formulario nativo solo llegan si están marcados, y
 * entonces valen `"on"`; no llegar significa desmarcado. */
function checked(formData: FormData, key: string): boolean {
  return formData.get(key) === "on";
}

export function readCommonFields(formData: FormData) {
  return {
    firstName: text(formData, "firstName"),
    lastName: text(formData, "lastName"),
    birthDate: text(formData, "birthDate"),
    nationalId: text(formData, "nationalId"),
    address: text(formData, "address"),
    city: text(formData, "city"),
    postalCode: text(formData, "postalCode"),
    phone: text(formData, "phone"),
    email: text(formData, "email"),
    iban: text(formData, "iban"),
    photoConsent: checked(formData, "photoConsent"),
    privacyConsent: checked(formData, "privacyConsent"),
  };
}

export function readPlayerFields(formData: FormData): PlayerFields {
  return {
    ...readCommonFields(formData),
    shirtSize: text(formData, "shirtSize"),
    pantsSize: text(formData, "pantsSize"),
    shoeSize: text(formData, "shoeSize"),
    installmentsChosen: Number(formData.get("installmentsChosen") ?? "1") === 2 ? 2 : 1,
    sepaConsent: checked(formData, "sepaConsent"),
    termsConsent: checked(formData, "termsConsent"),
    guardians: readGuardians(formData),
  };
}
