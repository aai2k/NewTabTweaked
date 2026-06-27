'use strict';
// Runs in <head>, before first paint — applies the saved background image
// immediately so the page never flashes the empty dark background.
(function () {
  try {
    var bg = localStorage.getItem('ntp-bg-data') || localStorage.getItem('ntp-bg-url');
    if (bg) {
      document.documentElement.style.backgroundImage = 'url("' + bg.replace(/"/g, '\\"') + '")';
    }
  } catch (e) {}
})();
