import { CardSkeleton, PageHeaderSkeleton } from "@/components/skeletons";

export default function Loading() {
  return (
    <div className="flex flex-1 flex-col gap-6">
      <PageHeaderSkeleton />
      <div className="grid gap-4 lg:max-w-2xl">
        {/* Perfil (nombre + correo), contraseña, idioma y zona de peligro. */}
        <CardSkeleton fields lines={2} />
        <CardSkeleton fields lines={2} />
        <CardSkeleton fields lines={1} />
        <CardSkeleton fields lines={1} />
      </div>
    </div>
  );
}
