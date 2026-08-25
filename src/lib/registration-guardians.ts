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
