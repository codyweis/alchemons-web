// App store links, read by the homepage and the browser game (/play/).
// Fill them in when the apps are live, then redeploy the site
// (firebase deploy --only hosting). Empty: the homepage shows no store
// buttons and the game's start screen says the apps are coming soon.
window.ALCHEMONS_STORES = {
  // App Store page, e.g. 'https://apps.apple.com/app/alchemons/id1234567890'
  ios: '',
  // Google Play page, e.g. 'https://play.google.com/store/apps/details?id=com.luck3yapps.alchemons'
  android: '',
  // The number in the App Store link (id1234567890 → '1234567890'). Turns on
  // Safari's "Open in the App Store" banner on iPhone and iPad.
  iosAppId: '',
};

// Safari only honours the banner's meta tag when it is in the page as it
// loads, so this file is loaded in <head> and writes it there.
(function () {
  var id = window.ALCHEMONS_STORES.iosAppId;
  if (id && document.readyState === 'loading') {
    document.write('<meta name="apple-itunes-app" content="app-id=' + String(id).replace(/\D/g, '') + '">');
  }
})();
