/**
 * Qui gère quoi :
 * - le gestionnaire (Arsène) : le Suivi client (portail, clés API, Google) ; il reçoit les notifications de cette partie ;
 * - les autres membres de l'équipe (admins comme Bilel, commerciaux) : le Suivi commercial (CRM) ; ils reçoivent celles du CRM.
 * Emails des gestionnaires dans GESTIONNAIRE_EMAILS (séparés par des virgules), par défaut arsene@acco-lab.fr.
 */
export function gestionnaireEmails() {
  return (process.env.GESTIONNAIRE_EMAILS ?? "arsene@acco-lab.fr").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
}
export function isGestionnaire(user: { email: string; role: string } | null | undefined) {
  if (!user || user.role !== "ADMIN") return false;
  return gestionnaireEmails().includes(user.email.toLowerCase());
}
