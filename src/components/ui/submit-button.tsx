"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";

type Props = React.ComponentProps<typeof Button> & { pendingLabel?: string; pending?: boolean };

export function SubmitButton({ children, pendingLabel = "Envoi…", pending: forced, ...rest }: Props) {
  const status = useFormStatus();
  const pending = forced ?? status.pending;
  return (
    <Button type="submit" disabled={pending} {...rest}>
      {pending ? pendingLabel : children}
    </Button>
  );
}
