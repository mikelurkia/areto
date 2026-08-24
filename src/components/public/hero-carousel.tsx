"use client";

import Autoplay from "embla-carousel-autoplay";
import Image from "next/image";
import { Sprout, Trophy, UsersRound } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";

import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import { cn } from "@/lib/utils";

const SLIDES = [
  { key: "firstTeam", icon: Trophy, tone: "primary", photo: "primer-equipo.jpg" },
  { key: "grassroots", icon: Sprout, tone: "gold", photo: "cantera.jpg" },
  { key: "wholeClub", icon: UsersRound, tone: "primary", photo: "cantera2.jpg" },
] as const;

const TONE_CLASSES = {
  primary: "bg-gradient-to-br from-primary/20 via-primary/5 to-transparent text-primary",
  gold: "bg-gradient-to-br from-gold/25 via-gold/5 to-transparent text-foreground",
} as const;

/**
 * Carrusel del hero de la home. Cada slide busca su foto en
 * `/public/club/<photo>`; si no existe (aún no se ha subido) se ve el
 * marcador de gradiente + icono, sin tocar el resto del componente.
 */
export function HeroCarousel() {
  const t = useTranslations("Landing.carousel");
  // Instancia única y estable del plugin. `useState` con inicializador lazy la
  // crea una sola vez (como haría un ref) pero la expone como valor normal, sin
  // leer `.current` en el render (lo prohíbe react-hooks/refs).
  const [autoplay] = useState(() =>
    Autoplay({ delay: 4500, stopOnInteraction: false, stopOnMouseEnter: true }),
  );
  const [failed, setFailed] = useState<Record<string, boolean>>({});

  return (
    <Carousel
      opts={{ loop: true }}
      plugins={[autoplay]}
      className="w-full max-w-md"
    >
      <CarouselContent className="-ml-0">
        {SLIDES.map((slide, index) => {
          const title = t(`${slide.key}.title`);
          const hasPhoto = !failed[slide.key];

          return (
            <CarouselItem key={slide.key} className="pl-0">
              <div
                className={cn(
                  "relative flex aspect-4/3 flex-col items-center justify-center gap-4 overflow-hidden rounded-2xl border p-8 text-center",
                  TONE_CLASSES[slide.tone],
                )}
              >
                {hasPhoto ? (
                  <Image
                    src={`/club/${slide.photo}`}
                    alt={title}
                    fill
                    sizes="(min-width: 768px) 28rem, 90vw"
                    className="object-cover"
                    priority={index === 0}
                    onError={() => setFailed((prev) => ({ ...prev, [slide.key]: true }))}
                  />
                ) : (
                  <slide.icon className="size-12" strokeWidth={1.5} />
                )}
                <div
                  className={cn(
                    hasPhoto &&
                      "absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-4",
                  )}
                >
                  <p
                    className={cn(
                      "font-heading text-lg font-semibold",
                      hasPhoto ? "text-white" : "text-foreground",
                    )}
                  >
                    {title}
                  </p>
                  <p className={cn("mt-1 text-sm", hasPhoto ? "text-white/80" : "text-muted-foreground")}>
                    {t(`${slide.key}.description`)}
                  </p>
                </div>
              </div>
            </CarouselItem>
          );
        })}
      </CarouselContent>
    </Carousel>
  );
}
