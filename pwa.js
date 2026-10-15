(function () {
  'use strict';
  var installButton = document.getElementById('installBtn');
  var installPrompt = null;
  var standalone = window.matchMedia('(display-mode: standalone)').matches ||
    window.navigator.standalone === true;

  if (installButton && !standalone) {
    installButton.hidden = false;
    installButton.textContent = 'How to install';
  }

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installPrompt = event;
    if (installButton) {
      installButton.hidden = false;
      installButton.textContent = 'Install app';
    }
  });

  if (installButton) {
    installButton.addEventListener('click', async function () {
      if (installPrompt) {
        installPrompt.prompt();
        try { await installPrompt.userChoice; } catch (_) {}
        installPrompt = null;
        installButton.hidden = true;
        return;
      }
      var isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
      var isAndroid = /android/i.test(navigator.userAgent);
      var message = isIOS
        ? 'To install SnapData: tap Share in your browser, then choose Add to Home Screen.'
        : isAndroid
          ? 'To install SnapData: open your browser menu (⋮) and choose Install app or Add to Home screen.'
          : 'To install SnapData: use your browser menu and choose Install SnapData or Create shortcut.';
      if (typeof window.alert === 'function') window.alert(message);
    });
  }

  window.addEventListener('appinstalled', function () {
    if (installButton) installButton.hidden = true;
    installPrompt = null;
  });

  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('./sw.js').catch(function (error) {
        console.warn('SnapData offline support could not start:', error);
      });
    });
  }
})();
