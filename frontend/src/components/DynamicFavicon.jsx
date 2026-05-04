import { useEffect } from "react";

function setFavicon(href, type = "image/svg+xml") {
  let link = document.querySelector("link[rel='icon']");
  if (!link) {
    link = document.createElement("link");
    link.rel = "icon";
    document.head.appendChild(link);
  }

  link.type = type;
  link.href = href;
}

export default function DynamicFavicon() {
  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");

    const update = () => {
      setFavicon(media.matches ? "/favicon-dark.svg" : "/favicon.svg");
    };

    update();
    media.addEventListener("change", update);

    return () => media.removeEventListener("change", update);
  }, []);

  return null;
}
