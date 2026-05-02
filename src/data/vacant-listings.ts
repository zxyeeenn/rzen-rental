import { roomListingSchema, type RoomListing } from "@/lib/schemas/listing";

const rawListings: RoomListing[] = [
  {
    id: "unit-01",
    title: "Garden Wing · Room 1",
    monthlyRentPhp: 5000,
    floorAreaSqm: 22,
    shortDescription:
      "Ground-floor corner room with a small patio, ideal for two guests or a remote-work setup.",
    amenities: ["Wi‑Fi", "Private bath", "Mini fridge", "Hot shower"],
    photos: [
      {
        src: "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?auto=format&fit=crop&w=1200&q=80",
        alt: "Bright studio living area with sofa and tall windows",
      },
      {
        src: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=1200&q=80",
        alt: "Minimal bedroom with white linens and wooden headboard",
      },
      {
        src: "https://images.unsplash.com/photo-1554995207-c18c203602cb?auto=format&fit=crop&w=1200&q=80",
        alt: "Compact kitchenette with sink and cabinets",
      },
    ],
  },
  {
    id: "unit-02",
    title: "Garden Wing · Room 2",
    monthlyRentPhp: 5000,
    floorAreaSqm: 20,
    shortDescription:
      "Quiet middle unit overlooking the garden — cross-ventilation and blackout curtains included.",
    amenities: ["Wi‑Fi", "Private bath", "Desk", "A/C"],
    photos: [
      {
        src: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=1200&q=80",
        alt: "Living room with sofa and framed art",
      },
      {
        src: "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=80",
        alt: "Bed with decorative pillows and side table",
      },
      {
        src: "https://images.unsplash.com/photo-1584622650111-993a426fbf0a?auto=format&fit=crop&w=1200&q=80",
        alt: "Modern bathroom vanity with mirror",
      },
    ],
  },
  {
    id: "unit-03",
    title: "Sea Breeze Loft · Room 3",
    monthlyRentPhp: 5000,
    floorAreaSqm: 26,
    shortDescription:
      "Upper-floor loft feel with higher ceilings, extra storage, and stronger afternoon breeze.",
    amenities: ["Wi‑Fi", "Private bath", "Kitchenette", "Balcony"],
    photos: [
      {
        src: "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        alt: "Bedroom with large bed and pendant lights",
      },
      {
        src: "https://images.unsplash.com/photo-1484154218962-a197022b5858?auto=format&fit=crop&w=1200&q=80",
        alt: "Open living and dining space with plants",
      },
      {
        src: "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1200&q=80",
        alt: "Staircase and loft-style interior",
      },
    ],
  },
  {
    id: "unit-04",
    title: "Sea Breeze Loft · Room 4",
    monthlyRentPhp: 5000,
    floorAreaSqm: 24,
    shortDescription:
      "Same building as Room 3 with a slightly smaller footprint — still gets great natural light.",
    amenities: ["Wi‑Fi", "Private bath", "A/C", "Work nook"],
    photos: [
      {
        src: "https://images.unsplash.com/photo-1616594039964-ae9021a400a0?auto=format&fit=crop&w=1200&q=80",
        alt: "Cozy bedroom with warm lighting",
      },
      {
        src: "https://images.unsplash.com/photo-1615529328331-f8917597711f?auto=format&fit=crop&w=1200&q=80",
        alt: "Sofa and coffee table in compact lounge",
      },
      {
        src: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1200&q=80",
        alt: "Bathroom with walk-in shower glass",
      },
    ],
  },
  {
    id: "unit-05",
    title: "Courtyard Studio · Room 5",
    monthlyRentPhp: 5000,
    floorAreaSqm: 19,
    shortDescription:
      "Efficient studio layout steps from the shared courtyard — easy laundry and bike parking.",
    amenities: ["Wi‑Fi", "Private bath", "Laundry access", "Fan"],
    photos: [
      {
        src: "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?auto=format&fit=crop&w=1200&q=80",
        alt: "Studio apartment with bed and sofa in one room",
      },
      {
        src: "https://images.unsplash.com/photo-1556020682-ae6ab96120cc?auto=format&fit=crop&w=1200&q=80",
        alt: "Kitchen area with bar stools",
      },
      {
        src: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80",
        alt: "Exterior courtyard with plants",
      },
    ],
  },
  {
    id: "unit-06",
    title: "Courtyard Studio · Room 6",
    monthlyRentPhp: 5000,
    floorAreaSqm: 21,
    shortDescription:
      "Slightly wider studio with space for a small dining table — popular with long-stay guests.",
    amenities: ["Wi‑Fi", "Private bath", "Hot shower", "A/C"],
    photos: [
      {
        src: "https://images.unsplash.com/photo-1618220179428-22790b461013?auto=format&fit=crop&w=1200&q=80",
        alt: "Modern living room with grey sofa",
      },
      {
        src: "https://images.unsplash.com/photo-1631679706909-1844bbd07221?auto=format&fit=crop&w=1200&q=80",
        alt: "Bedroom corner with wall art",
      },
      {
        src: "https://images.unsplash.com/photo-1604014237800-1c9102b219e5?auto=format&fit=crop&w=1200&q=80",
        alt: "Clean white bathroom interior",
      },
    ],
  },
  {
    id: "unit-07",
    title: "Streetfront · Room 7",
    monthlyRentPhp: 3500,
    floorAreaSqm: 18,
    shortDescription:
      "Quick access to the main road for trikes and habal-habal — good for commuters.",
    amenities: ["Wi‑Fi", "Private bath", "Security grille", "Desk"],
    photos: [
      {
        src: "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=1200&q=80",
        alt: "Contemporary room with wood accents",
      },
      {
        src: "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=80",
        alt: "Armchair and floor lamp reading corner",
      },
      {
        src: "https://images.unsplash.com/photo-1600573472592-401b489a3cdc?auto=format&fit=crop&w=1200&q=80",
        alt: "Hallway with framed photos",
      },
    ],
  },
  {
    id: "unit-08",
    title: "Rooftop Corner · Room 8",
    monthlyRentPhp: 5000,
    floorAreaSqm: 28,
    shortDescription:
      "Largest unit with panoramic rooftop access for drying laundry and sunset coffee.",
    amenities: ["Wi‑Fi", "Private bath", "Full kitchenette", "Rooftop access"],
    photos: [
      {
        src: "https://images.unsplash.com/photo-1600607687644-c7171b42498f?auto=format&fit=crop&w=1200&q=80",
        alt: "Spacious open plan apartment interior",
      },
      {
        src: "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1200&q=80",
        alt: "Dining table with chairs near window",
      },
      {
        src: "https://images.unsplash.com/photo-1600585154526-990dced4db0d?auto=format&fit=crop&w=1200&q=80",
        alt: "Rooftop terrace with city view at dusk",
      },
    ],
  },
];

export const VACANT_LISTINGS: RoomListing[] = rawListings.map((item) =>
  roomListingSchema.parse(item),
);
