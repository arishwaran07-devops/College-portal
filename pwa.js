let deferredInstallPrompt = null;

(function () {
  const installButton = document.getElementById("installAppBtn");

  function isStandalone() {
    return window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true;
  }

  function showInstallButton() {
    if (installButton && !isStandalone()) {
      installButton.hidden = false;
    }
  }

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    showInstallButton();
  });

  if (installButton) {
    installButton.addEventListener("click", async () => {
      if (!deferredInstallPrompt) return;

      deferredInstallPrompt.prompt();
      const result = await deferredInstallPrompt.userChoice;

      if (result.outcome === "accepted") {
        installButton.hidden = true;
      }

      deferredInstallPrompt = null;
    });
  }

  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    if (installButton) installButton.hidden = true;
    if (typeof toast === "function") {
      toast("AJV College Connect installed successfully.");
    }
  });

  window.addEventListener("load", () => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js")
        .then(() => console.log("AJV PWA service worker registered"))
        .catch((error) => console.error("PWA service worker registration failed:", error));
    }
  });
})();
