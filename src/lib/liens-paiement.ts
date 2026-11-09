/** Liens de paiement Stripe à portée de main des commerciaux (page Prospection → Liens de paiement, et bouton sur la fiche prospect). Montants HT par mois. */
export const OFFRES: { nom: string; prix: number; url: string; detail: string }[] = [
  { nom: "Offre Essentiel", prix: 149.9, url: "https://buy.stripe.com/fZudRagycdG1csadJ3bfO0p", detail: "Site vitrine essentiel" },
  { nom: "Offre Référence", prix: 229.9, url: "https://buy.stripe.com/9B6bJ2dm06dzfEmfRbbfO0q", detail: "Site + référencement local" },
  { nom: "Offre Conquête", prix: 269.9, url: "https://buy.stripe.com/fZuaEYeq459veAi0WhbfO0r", detail: "Site + référencement + acquisition" },
  { nom: "Offre Signature", prix: 499.9, url: "https://buy.stripe.com/7sY28s3Lq7hDfEmfRbbfO0s", detail: "Sur mesure, accompagnement complet" },
];

/** Tarifs « client référence » : un lien par palier de 10 €, de 70 à 500 € HT par mois. */
export const CLIENT_REFERENCE: { prix: number; url: string }[] = [
  [70, "14AbJ25Ty45r3VE6gBbfO0t"], [80, "3cIaEYa9ObxT0JsawRbfO0u"], [90, "8x2bJ295KeK53VE7kFbfO0v"], [100, "eVq8wQ81G31n63MeN7bfO0w"], [110, "cNieVedm0cBX8bU5cxbfO0x"],
  [120, "6oU7sMchWatPgIq8oJbfO0y"], [130, "6oU00k95KbxT9fY8oJbfO0z"], [140, "4gM5kE95KatP0Js8oJbfO0A"], [150, "cNi3cw4PugSdfEm9sNbfO0B"], [160, "14A14odm0eK563M5cxbfO0C"],
  [170, "00w4gA5Ty8lHfEmcEZbfO0D"], [180, "aFafZi3LqatPfEm34pbfO0E"], [190, "7sY9AUbdSgSdeAi6gBbfO0F"], [200, "14AaEYa9OdG12RA9sNbfO0G"], [210, "9B68wQ3LqfO94ZIcEZbfO0H"],
  [220, "5kQ8wQgyc59v0JsfRbbfO0I"], [230, "00waEY3Lq31ndwe8oJbfO0J"], [240, "9B6dRadm0gSdcsaawRbfO0K"], [250, "3cIdRa4PucBX3VE8oJbfO0L"], [260, "7sY28sa9OatP1NwbAVbfO0M"],
  [270, "cNidRaa9O31n3VEgVfbfO0N"], [280, "5kQ8wQ95K1XjgIq48tbfO0O"], [290, "28E7sM95K45r1Nw20lbfO0P"], [300, "7sYaEYdm0cBX3VE6gBbfO0Q"], [310, "4gMeVe3Lq45r2RAawRbfO0R"],
  [320, "4gMbJ26XCgSd0JscEZbfO0S"], [330, "fZuaEY5TyeK563M0WhbfO0T"], [340, "8x214o81G31ngIq20lbfO0U"], [350, "3cIdRabdSdG1csa34pbfO0V"], [360, "14A28s95KdG13VE9sNbfO0W"],
  [370, "4gM8wQ4Pu31n77Q7kFbfO0X"], [380, "00wfZi2Hm8lHfEmfRbbfO0Y"], [390, "bJecN65Ty1Xj1Nw0WhbfO0Z"], [400, "dRmeVe0zedG14ZI34pbfO10"], [410, "5kQ3cw4Pu6dz63MeN7bfO11"],
  [420, "aFa14o81G31n63McEZbfO12"], [430, "fZueVefu88lHbo634pbfO13"], [440, "eVqbJ295K0Tf9fY9sNbfO14"], [450, "9B6bJ2eq4atP2RA5cxbfO15"], [460, "00w28seq4fO977QawRbfO16"],
  [470, "5kQcN63Lq59v9fY48tbfO17"], [480, "bJeaEYa9O45r3VEawRbfO18"], [490, "dRmcN60ze45r2RAfRbbfO19"], [500, "4gMfZi2Hm7hDeAiawRbfO1a"],
].map(([prix, id]) => ({ prix: prix as number, url: `https://buy.stripe.com/${id}` }));

export const euroHT = (n: number) => `${n.toLocaleString("fr-FR", { minimumFractionDigits: n % 1 ? 2 : 0 })} € HT/mois`;
