import { useEffect, useState } from "react";
import { ImageOff } from "lucide-react";

interface Props {
  src: string;
  alt: string;
  className?: string;
  // Si `src` falla (ej: una URL de una página de terceros con hotlink
  // protection), se reintenta una vez con esta imagen antes de rendirse.
  fallbackSrc?: string;
}

/**
 * Imagen de destino con estado de carga (skeleton) y fallback a un degradado
 * si la foto no carga (p.ej. si LoremFlickr no responde).
 */
export default function DestImage({ src, alt, className = "", fallbackSrc }: Props) {
  const [current, setCurrent] = useState(src);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  // Si cambia el `src` de arriba (ej: otro mensaje), reinicia el estado.
  useEffect(() => {
    setCurrent(src);
    setLoaded(false);
    setFailed(false);
  }, [src]);

  if (failed) {
    return (
      <div
        className={`grid place-items-center bg-gradient-to-br from-brand-500 to-brand-700 text-white/70 ${className}`}
        aria-label={alt}
      >
        <ImageOff className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden ${className}`}>
      {!loaded && <div className="img-skeleton absolute inset-0" />}
      <img
        src={current}
        alt={alt}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => {
          if (fallbackSrc && current !== fallbackSrc) {
            setCurrent(fallbackSrc);
          } else {
            setFailed(true);
          }
        }}
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
      />
    </div>
  );
}
