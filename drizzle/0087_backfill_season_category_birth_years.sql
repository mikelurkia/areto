-- Traslada el rango de año de nacimiento que hoy vive por equipo a la nueva
-- tabla por categoría y temporada. Si dos equipos de la misma categoría
-- discrepan, se queda con el rango más amplio (MIN/MAX) antes que perder
-- datos: es solo un aviso de incoherencia, nunca bloquea nada.
INSERT INTO "season_category_birth_years" ("season_id", "category", "min_birth_year", "max_birth_year")
SELECT "season_id", "category", MIN("min_birth_year"), MAX("max_birth_year")
FROM "teams"
WHERE "category" IS NOT NULL
  AND ("min_birth_year" IS NOT NULL OR "max_birth_year" IS NOT NULL)
GROUP BY "season_id", "category"
ON CONFLICT ("season_id", "category") DO NOTHING;
