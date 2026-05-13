export type TipoTarjeta = "aniversario" | "reconocimiento" | "invitacion" | "descuento";

export interface DatosTarjetaCorporativa {
  tipo: TipoTarjeta;
  nombre_destinatario: string;
  frase_eslogan: string;
  detalle?: string;
  fecha_evento?: string;
  anos_servicio?: number;
  today: Date;
}
