import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-2 text-sm text-muted-foreground">Página não encontrada.</p>
        <div className="mt-6">
          <Link to="/" className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Voltar
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    reportLovableError(error, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="mt-2 text-sm text-muted-foreground">Não foi possível carregar esta página.</p>
        <div className="mt-6 flex justify-center gap-2">
          <button onClick={() => { router.invalidate(); reset(); }} className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Tentar novamente
          </button>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#04232c" },
      { name: "mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-title", content: "DFLAB" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { title: "DFLAB — Sistema de Gestão Laboratorial" },
      { name: "description", content: "Sistema de gestão para laboratório de análises clínicas: cadastros, pedidos e coletas." },
      { property: "og:title", content: "DFLAB — Sistema de Gestão Laboratorial" },
      { property: "og:description", content: "Sistema de gestão para laboratório de análises clínicas: cadastros, pedidos e coletas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "DFLAB — Sistema de Gestão Laboratorial" },
      { name: "twitter:description", content: "Sistema de gestão para laboratório de análises clínicas: cadastros, pedidos e coletas." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/575f24a7-61f5-40d4-99d6-3887b595004e/id-preview-bcf64a65--7b39f8f0-5ea2-479e-a275-f9dbdaa03e55.lovable.app-1783631108779.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/575f24a7-61f5-40d4-99d6-3887b595004e/id-preview-bcf64a65--7b39f8f0-5ea2-479e-a275-f9dbdaa03e55.lovable.app-1783631108779.png" },
    ],
    links: [
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" },
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      { rel: "icon", href: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <head><HeadContent /></head>
      <body>{children}<Scripts /></body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();
  // PWA: registra o service worker (só em produção e fora de iframes, ex.: editor do Lovable)
  useEffect(() => {
    if (!import.meta.env.PROD || !("serviceWorker" in navigator) || window.self !== window.top) return;
    navigator.serviceWorker
      .register("/sw.js")
      .then((reg) => reg.update().catch(() => undefined)) // procura versão nova do app a cada abertura
      .catch((err) => console.warn("[pwa] sw:", err));
  }, []);
  // Depois de uma atualização do sistema, uma aba aberta antes pode pedir um arquivo da versão antiga que
  // já não existe. Em vez de travar (ex.: entrar e a tela não aparecer), recarrega uma vez para pegar a nova.
  useEffect(() => {
    const KEY = "labis:reloaded-after-update";
    const onPreloadError = (event: Event) => {
      event.preventDefault();
      try {
        if (sessionStorage.getItem(KEY)) return; // já recarregou uma vez: não entra em laço
        sessionStorage.setItem(KEY, "1");
      } catch {
        /* sem sessionStorage: recarrega mesmo assim, uma vez por abertura da aba */
      }
      window.location.reload();
    };
    window.addEventListener("vite:preloadError", onPreloadError);
    const t = setTimeout(() => {
      try {
        sessionStorage.removeItem(KEY);
      } catch {
        /* ignora */
      }
    }, 15_000);
    return () => {
      window.removeEventListener("vite:preloadError", onPreloadError);
      clearTimeout(t);
    };
  }, []);
  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => sub.subscription.unsubscribe();
  }, [queryClient, router]);
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
