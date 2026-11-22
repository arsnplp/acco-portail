import { redirect } from "next/navigation";

/** « Mes sites » est devenu l'onglet Site de « Mes services ». */
export default function SitesPage() { redirect("/services"); }
