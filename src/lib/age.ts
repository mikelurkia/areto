/** Edad en años cumplidos a fecha de hoy (o de `asOf`), sensible al día del mes. */
export function calculateAge(birthDate: string, asOf: Date = new Date()): number {
  const birth = new Date(birthDate);
  let age = asOf.getFullYear() - birth.getFullYear();
  const hasHadBirthdayThisYear =
    asOf.getMonth() > birth.getMonth() ||
    (asOf.getMonth() === birth.getMonth() && asOf.getDate() >= birth.getDate());
  if (!hasHadBirthdayThisYear) age -= 1;
  return age;
}

export function isMinor(birthDate: string | null, asOf?: Date): boolean {
  if (!birthDate) return false;
  return calculateAge(birthDate, asOf) < 18;
}
