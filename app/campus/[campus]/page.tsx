import type { Metadata } from "next";
import { notFound } from "next/navigation";
import CampusMap from "@/components/CampusMap";
import { campuses, getCampus, isCampus } from "@/lib/places";

export function generateStaticParams() {
  return campuses.map((c) => ({ campus: c.id }));
}

export async function generateMetadata({ params }: PageProps<"/campus/[campus]">): Promise<Metadata> {
  const { campus } = await params;
  if (!isCampus(campus)) return {};
  const info = getCampus(campus);
  const description = `Find faculties, banks, hostels and more on UNIPORT's ${info.name}.`;
  return {
    title: info.name,
    description,
    alternates: { canonical: `/campus/${campus}` },
    openGraph: { title: `${info.name} · Map of UNIPORT`, description, url: `/campus/${campus}` },
  };
}

export default async function CampusPage({ params }: PageProps<"/campus/[campus]">) {
  const { campus } = await params;
  if (!isCampus(campus)) notFound();
  return <CampusMap campus={campus} />;
}
