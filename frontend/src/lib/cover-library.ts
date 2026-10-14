/**
 * Event covers, hand-picked from Unsplash (free under the Unsplash License: no permission
 * or attribution required, though we credit photographers anyway). Images are loaded from
 * Unsplash's own CDN, which resizes them per screen. Generated from the renovation shortlist;
 * see docs/design/renovation-01-app/NOTES.md.
 */

export type CoverSet =
  | "music" | "social" | "culture" | "sports" | "tech" | "career" | "academic" | "arts" | "community";

export interface LibraryCover {
  id: string;
  set: CoverSet;
  /** Base image URL with no size parameters. */
  url: string;
  photographer: string;
}

export const COVER_LIBRARY: LibraryCover[] = [
  { id: "NcdG9mK3PBY", set: "music", url: "https://images.unsplash.com/photo-1459749411175-04bf5292ceea", photographer: "Nainoa Shizuru" },
  { id: "nPz8akkUmDI", set: "music", url: "https://images.unsplash.com/photo-1501386761578-eac5c94b800a", photographer: "Nicholas Green" },
  { id: "So6YckShOVA", set: "music", url: "https://images.unsplash.com/photo-1565035010268-a3816f98589a", photographer: "Tijs Van Leur" },
  { id: "gr-0oDn91cE", set: "music", url: "https://images.unsplash.com/photo-1575285113814-f770cb8c796e", photographer: "Tamara Gore" },
  { id: "KI4j59oflD4", set: "music", url: "https://images.unsplash.com/photo-1770325035177-797f94834a7f", photographer: "Alicia Christin Gerald" },
  { id: "UrzN-8K1PCE", set: "social", url: "https://images.unsplash.com/photo-1621112904887-419379ce6824", photographer: "Considerate Agency" },
  { id: "4SKNDU85KOw", set: "social", url: "https://images.unsplash.com/photo-1699730185428-d11054059c7f", photographer: "Ourwhisky Foundation" },
  { id: "e3OUQGT9bWU", set: "social", url: "https://images.unsplash.com/photo-1511988617509-a57c8a288659", photographer: "Helena Lopes" },
  { id: "fIHozNWfcvs", set: "social", url: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205", photographer: "Samantha Gades" },
  { id: "Fl7xCkbcqS4", set: "social", url: "https://images.unsplash.com/photo-1758272133392-b5bbce307e0b", photographer: "Vitaly Gariev" },
  { id: "ptf91j8SFiM", set: "culture", url: "https://images.unsplash.com/photo-1551883709-2516220df0bc", photographer: "Praveen Gupta" },
  { id: "b4Ht8TQ1JGo", set: "culture", url: "https://images.unsplash.com/photo-1664993101841-036f189719b6", photographer: "Keesha S Kitchen" },
  { id: "_HzlOHmboSk", set: "culture", url: "https://images.unsplash.com/photo-1463592177119-bab2a00f3ccb", photographer: "Pavan Gupta" },
  { id: "Dd6bdl_e7Vg", set: "culture", url: "https://images.unsplash.com/photo-1675784061072-b6a9fd155192", photographer: "Mick Haupt" },
  { id: "57e6xbb1S9M", set: "culture", url: "https://images.unsplash.com/photo-1759738102510-ec524f666274", photographer: "Rohit Dey" },
  { id: "vKVUTS0msYw", set: "culture", url: "https://images.unsplash.com/photo-1640251314219-be6eb294446b", photographer: "Karl Callwood" },
  { id: "8-s5QuUBtyM", set: "sports", url: "https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d", photographer: "Abigail Keenan" },
  { id: "iiwYpGkbDgM", set: "sports", url: "https://images.unsplash.com/flagged/photo-1550413231-202a9d53a331", photographer: "Waldemar Brandt" },
  { id: "OywyPkrDEvg", set: "sports", url: "https://images.unsplash.com/photo-1533923156502-be31530547c4", photographer: "Ryan" },
  { id: "xtPs2_MlPYc", set: "sports", url: "https://images.unsplash.com/flagged/photo-1577416336755-0b86c3e4f1d8", photographer: "Logan Weaver Lgnwvr" },
  { id: "AddAnDkkovM", set: "sports", url: "https://images.unsplash.com/photo-1629901925121-8a141c2a42f4", photographer: "Tom Briskey" },
  { id: "sIjqrd51grA", set: "tech", url: "https://images.unsplash.com/photo-1731160807880-daf859b64420", photographer: "Christine Erispe" },
  { id: "yYWOYeX-jLY", set: "tech", url: "https://images.unsplash.com/photo-1631350397792-8e0c2de5b637", photographer: "Algoleague" },
  { id: "ourQHRTE2IM", set: "tech", url: "https://images.unsplash.com/photo-1504384764586-bb4cdc1707b0", photographer: "Alex Kotliarskyi" },
  { id: "-X4Qx4_4iMU", set: "tech", url: "https://images.unsplash.com/photo-1758270705518-b61b40527e76", photographer: "Vitaly Gariev" },
  { id: "cuKJre3nyYc", set: "career", url: "https://images.unsplash.com/photo-1531058020387-3be344556be6", photographer: "Jakob Dalbjorn" },
  { id: "nOvIa_x_tfo", set: "career", url: "https://images.unsplash.com/photo-1560439514-4e9645039924", photographer: "Product School" },
  { id: "7igRs0oGJks", set: "career", url: "https://images.unsplash.com/photo-1781583716707-26ec9170ca0d", photographer: "Evan Marvell" },
  { id: "uzBZnacIKgQ", set: "career", url: "https://images.unsplash.com/photo-1782388713336-fcb8aa6db8f0", photographer: "Evan Marvell" },
  { id: "-uHVRvDr7pg", set: "academic", url: "https://images.unsplash.com/photo-1543269865-cbf427effbad", photographer: "Brooke Cagle" },
  { id: "g1Kr4Ozfoac", set: "academic", url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f", photographer: "Brooke Cagle" },
  { id: "omeaHbEFlN4", set: "academic", url: "https://images.unsplash.com/photo-1460518451285-97b6aa326961", photographer: "Alexis Brown" },
  { id: "F2KRf_QfCqw", set: "academic", url: "https://images.unsplash.com/photo-1540575467063-178a50c2df87", photographer: "Headway" },
  { id: "H-O7gUaKMow", set: "arts", url: "https://images.unsplash.com/photo-1757085242652-f8cd4d3de889", photographer: "Anya Richter" },
  { id: "TdpSX7XAcKo", set: "arts", url: "https://images.unsplash.com/photo-1544928147-79a2dbc1f389", photographer: "Hillary Ungson" },
  { id: "D9xb8dJYp5E", set: "arts", url: "https://images.unsplash.com/photo-1770739879041-22f0dfc37301", photographer: "Julia Assis" },
  { id: "W39yxhAHmiY", set: "arts", url: "https://images.unsplash.com/photo-1787725075492-b44e0b17fb01", photographer: "Vitaly Gariev" },
  { id: "CxL29J-aM5E", set: "community", url: "https://images.unsplash.com/photo-1652971876875-05db98fab376", photographer: "The Tampa Bay Estuary Program" },
  { id: "Cns0h4ypRyA", set: "community", url: "https://images.unsplash.com/photo-1628717341663-0007b0ee2597", photographer: "Ismael Paramo" },
  { id: "5wJ2GiYSifA", set: "community", url: "https://images.unsplash.com/photo-1557660559-42497f78035b", photographer: "Roman Synkevych" },
];
