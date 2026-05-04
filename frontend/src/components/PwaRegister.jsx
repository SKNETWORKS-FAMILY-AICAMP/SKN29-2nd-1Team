import { useEffect } from "react";

export default function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && import.meta.env.PROD) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("/sw.js").catch(() => {
          // 개발/배포 환경에 따라 Service Worker 등록이 실패할 수 있습니다.
        });
      });
    }
  }, []);

  return null;
}
