"use client";

/** Champ fichier qui envoie le formulaire dès qu'un fichier est choisi (1 tap). */
export function AutoUploadInput({ name = "file", accept }: { name?: string; accept?: string }) {
  return (
    <input
      type="file"
      name={name}
      accept={accept}
      required
      className="sr-only"
      onChange={(e) => e.currentTarget.files?.length && e.currentTarget.form?.requestSubmit()}
    />
  );
}
