import { z } from "zod";

export const vitalsPacketSchema = z
  .object({
    patient_id: z.string().min(1),
    timestamp: z
      .string()
      .min(1)
      .refine((value: string) => Number.isFinite(Date.parse(value)), {
        message: "timestamp must be ISO 8601",
      }),
    heart_rate: z.number().finite(),
    spo2: z.number().finite(),
    systolic_bp: z.number().finite(),
    diastolic_bp: z.number().finite(),
  })
  .strict();

export type VitalsPacketInput = z.infer<typeof vitalsPacketSchema>;
