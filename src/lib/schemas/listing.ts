import { z } from "zod";

export const listingPhotoSchema = z.object({
  src: z.string().url(),
  alt: z.string().min(1),
});

export const roomListingSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  monthlyRentPhp: z.number().positive(),
  floorAreaSqm: z.number().positive(),
  shortDescription: z.string().min(1),
  amenities: z.array(z.string().min(1)),
  photos: z.array(listingPhotoSchema).min(1),
});

export type RoomListing = z.infer<typeof roomListingSchema>;
