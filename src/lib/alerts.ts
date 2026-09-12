import { prisma } from "./prisma";

export type AlertType =
  | "RONDA_INCOMPLETA"
  | "LEITURA_INCONSISTENTE"
  | "LEITURA_COM_ATENCAO"
  | "OCORRENCIA_CRITICA";

export async function createAlert(params: {
  plantId: string;
  roundId?: string;
  type: AlertType;
  severity?: "BAIXA" | "MEDIA" | "ALTA" | "CRITICA";
  message: string;
}) {
  return prisma.alert.create({
    data: {
      plantId: params.plantId,
      roundId: params.roundId,
      type: params.type,
      severity: params.severity ?? "MEDIA",
      message: params.message,
    },
  });
}
