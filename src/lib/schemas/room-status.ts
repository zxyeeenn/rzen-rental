import { z } from "zod";

export const roomStatusSchema = z.enum(["vacant", "occupied", "maintenance"]);

export type RoomStatus = z.infer<typeof roomStatusSchema>;
