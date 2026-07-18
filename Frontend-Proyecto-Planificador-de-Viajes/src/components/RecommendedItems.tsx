import DestImage from "./DestImage";
import { destinationImage } from "../lib/images";
import type { RecommendedItem } from "../types";

interface Props {
  items: RecommendedItem[];
  // Destino de la conversación (si el usuario lo puso en los filtros), para
  // afinar la búsqueda de imagen de cada item (ej: "Malecón" + "Lima").
  destinationHint?: string;
}

/**
 * Grilla de tarjetas con imagen para los lugares/platos que devuelve una
 * consulta_puntual (ver RespuestaConsultaPuntual en el backend). El backend
 * ya busca una imagen real por item con Tavily (imagen_url); si no encontró
 * ninguna, se hace fallback a una foto genérica por palabras clave
 * (LoremFlickr) que puede no ser del lugar exacto.
 */
export default function RecommendedItems({ items, destinationHint }: Props) {
  if (!items.length) return null;

  return (
    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
      {items.map((item, i) => {
        const generica = destinationImage(item.nombre, {
          w: 400,
          h: 300,
          extra: destinationHint,
          seed: item.nombre,
        });
        return (
          <div
            key={`${item.nombre}-${i}`}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
          >
            <DestImage
              src={item.imagen_url || generica}
              fallbackSrc={item.imagen_url ? generica : undefined}
              alt={item.nombre}
              className="h-24 w-full"
            />
            <div className="p-2.5">
              <p className="text-xs font-semibold leading-snug text-slate-800">
                {item.nombre}
              </p>
              <p className="mt-0.5 line-clamp-2 text-[11px] leading-snug text-slate-500">
                {item.descripcion}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
