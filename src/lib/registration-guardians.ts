/**
 * Lee los tutores de un formulario de inscripción de jugador: bloques
 * repetidos donde cada campo comparte `name` entre tutores (ver
 * `jugador-form.tsx`/`review-form.tsx`), así que se leen con `getAll` y se
 * combinan por posición. Compartido entre el formulario público
 * (`inscripcion/actions.ts`) y la edición en revisión (`(app)/inscripciones/actions.ts`) —
 * no puede vivir en un fichero "use server" porque no es una Server Action.
 */
export function readGuardians(formData: FormData) {
  const firstNames = formData.getAll("guardianFirstName").map(String);
  const lastNames = formData.getAll("guardianLastName").map(String);
  const birthDates = formData.getAll("guardianBirthDate").map(String);
  const nationalIds = formData.getAll("guardianNationalId").map(String);
  const addresses = formData.getAll("guardianAddress").map(String);
  const cities = formData.getAll("guardianCity").map(String);
  const postalCodes = formData.getAll("guardianPostalCode").map(String);
  const phones = formData.getAll("guardianPhone").map(String);
  const emails = formData.getAll("guardianEmail").map(String);

  return firstNames
    .map((firstName, i) => ({
      firstName: firstName.trim(),
      lastName: (lastNames[i] ?? "").trim(),
      birthDate: (birthDates[i] ?? "").trim(),
      nationalId: (nationalIds[i] ?? "").trim(),
      address: (addresses[i] ?? "").trim(),
      city: (cities[i] ?? "").trim(),
      postalCode: (postalCodes[i] ?? "").trim(),
      phone: (phones[i] ?? "").trim(),
      email: (emails[i] ?? "").trim(),
    }))
    .filter((g) => g.firstName || g.lastName);
}

export type GuardianIdentityConflict = { field: "email" | "nationalId" };

/**
 * Email y DNI/NIE identifican a una persona en `persons` (índices únicos
 * `persons_email_idx`/`persons_national_id_idx`); a diferencia del teléfono
 * o la dirección, no pueden repetirse entre el jugador/socio y sus tutores,
 * ni entre tutores, sin que la creación de las dos personas choque contra
 * esos índices al aprobar. Frecuente cuando el jugador es menor y no tiene
 * email propio: el padre/madre reutiliza el suyo.
 */
export function findGuardianIdentityConflict(
  main: { email: string; nationalId: string },
  guardians: { email: string; nationalId: string }[],
): GuardianIdentityConflict | null {
  const all = [main, ...guardians];
  for (let i = 0; i < all.length; i++) {
    for (let j = i + 1; j < all.length; j++) {
      const emailA = all[i].email.trim().toLowerCase();
      const emailB = all[j].email.trim().toLowerCase();
      if (emailA && emailB && emailA === emailB) return { field: "email" };
      const idA = all[i].nationalId.trim().toUpperCase();
      const idB = all[j].nationalId.trim().toUpperCase();
      if (idA && idB && idA === idB) return { field: "nationalId" };
    }
  }
  return null;
}
