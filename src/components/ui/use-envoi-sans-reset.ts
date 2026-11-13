"use client";

import { startTransition, type FormEvent } from "react";

/**
 * Envoie un formulaire à son action serveur SANS que React le remette à zéro ensuite.
 * Avec <form action={…}>, React 19 réinitialise les champs après chaque envoi : un <select>
 * revient alors sur sa première option / sa valeur d'origine (ex. la source repassait en « Cold Call »
 * quand on réenregistrait). Ici on garde ce qui est saisi à l'écran.
 * À utiliser avec <SubmitButton pending={…}> (useFormStatus ne voit pas ces envois).
 */
export function useEnvoiSansReset(action: (f: FormData) => void) {
  return (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLElement | null;
    const fd = new FormData(e.currentTarget, submitter);
    startTransition(() => action(fd));
  };
}
