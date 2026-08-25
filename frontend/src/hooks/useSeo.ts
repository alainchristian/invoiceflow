import { useEffect } from "react";

// TODO: set VITE_SITE_URL to the real production domain before deploying --
// this placeholder is only here so canonical/OG/sitemap URLs aren't broken in dev.
export const SITE_URL = import.meta.env.VITE_SITE_URL || "https://invoiceflow.app";
export const SITE_NAME = "InvoiceFlow";
export const DEFAULT_DESCRIPTION =
  "Free invoicing software for freelancers and small businesses. Create invoices and quotes, accept online payments, and get paid faster with InvoiceFlow.";

interface SeoOptions {
  title: string;
  description?: string;
  path?: string;
  noindex?: boolean;
  jsonLd?: object;
}

function setMeta(attr: "name" | "property", key: string, content: string) {
  let el = document.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement("meta");
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute("content", content);
}

function setLink(rel: string, href: string) {
  let el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement("link");
    el.setAttribute("rel", rel);
    document.head.appendChild(el);
  }
  el.setAttribute("href", href);
}

function setJsonLd(data: object) {
  const id = "seo-json-ld";
  let el = document.getElementById(id) as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement("script");
    el.id = id;
    el.type = "application/ld+json";
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

function removeJsonLd() {
  document.getElementById("seo-json-ld")?.remove();
}

// Sets document title + description/canonical/OG/Twitter meta tags for the current
// route. This is a client-rendered SPA, so these updates run after the initial
// paint -- they help browser tabs/bookmarks and JS-executing crawlers (Googlebot
// does), but a crawler that never runs JS still only sees index.html's defaults.
// True per-page tags in the initial HTML response would need SSR/prerendering.
export function useSeo({ title, description = DEFAULT_DESCRIPTION, path = "/", noindex = false, jsonLd }: SeoOptions) {
  useEffect(() => {
    const fullTitle = title === SITE_NAME ? title : `${title} | ${SITE_NAME}`;
    document.title = fullTitle;

    setMeta("name", "description", description);
    setMeta("name", "robots", noindex ? "noindex, nofollow" : "index, follow");

    const url = `${SITE_URL}${path}`;
    setLink("canonical", url);

    setMeta("property", "og:title", fullTitle);
    setMeta("property", "og:description", description);
    setMeta("property", "og:url", url);
    setMeta("property", "og:type", "website");
    setMeta("property", "og:site_name", SITE_NAME);

    setMeta("name", "twitter:card", "summary_large_image");
    setMeta("name", "twitter:title", fullTitle);
    setMeta("name", "twitter:description", description);

    if (jsonLd) {
      setJsonLd(jsonLd);
    } else {
      removeJsonLd();
    }
  }, [title, description, path, noindex, jsonLd]);
}
