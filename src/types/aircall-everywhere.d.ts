/** Typage minimal du SDK aircall-everywhere (téléphone Aircall Workspace intégré dans l'app). Doc : github.com/aircall/aircall-everywhere */
declare module "aircall-everywhere" {
  type Cb = (success: boolean, data?: unknown) => void;
  export default class AircallWorkspace {
    constructor(opts: { domToLoadWorkspace: string; onLogin?: (settings: unknown) => void; onLogout?: () => void; size?: "big" | "small" | "auto"; debug?: boolean; integrationToLoad?: "zendesk" | "hubspot" });
    on(event: string, callback: (data: unknown) => void): void;
    send(event: "dial_number", data: { phone_number: string }, callback?: Cb): void;
    send(event: string, data?: Record<string, unknown>, callback?: Cb): void;
    isLoggedIn(callback: (logged: boolean) => void): void;
    removeListener(event: string): void;
  }
}
