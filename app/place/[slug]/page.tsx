import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CampusMap from "@/components/CampusMap";
import { CATEGORY_META, campusName, getPlace, places } from "@/lib/places";

export function generateStaticParams() {
  return places.map((p) => ({ slug: p.id }));
}

export async function generateMetadata({ params }: PageProps<"/place/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const place = getPlace(slug);
  if (!place) return {};
  const where = `${CATEGORY_META[place.category].label} on ${campusName(place.campus)}`;
  const description = [where, place.landmark, place.description].filter(Boolean).join(" — ");
  return {
    title: place.name,
    description,
    alternates: { canonical: `/place/${place.id}` },
    openGraph: {
      type: "website",
      title: `${place.name} · Map of UNIPORT`,
      description,
      url: `/place/${place.id}`,
      ...(place.photo ? { images: [{ url: place.photo, alt: place.name }] } : {}),
    },
  };
}

export default async function PlacePage({ params }: PageProps<"/place/[slug]">) {
  const { slug } = await params;
  const place = getPlace(slug);
  if (!place) notFound();
  return <CampusMap campus={place.campus} initialPlaceId={place.id} />;
}
