(function () {
  var KEY = "folium_demo";
  var DEMO_EMAIL = "demo@utp.ac.pa";
  try {
    var qs = new URLSearchParams(window.location.search);
    if (qs.get("demo") === "1") {
      sessionStorage.setItem(KEY, "1");
      try {
        var p = window.location.pathname;
        history.replaceState({}, "", p);
      } catch (e2) {}
    }
  } catch (e) {}
  if (!sessionStorage.getItem(KEY)) {
    window.location.replace("login.html");
    return;
  }
  window.FOLIUM_SESSION_EMAIL = DEMO_EMAIL;

  document.addEventListener("DOMContentLoaded", function () {
    var nav = document.getElementById("navEmail");
    if (nav && window.FOLIUM_SESSION_EMAIL) {
      nav.textContent = window.FOLIUM_SESSION_EMAIL;
    }
    document.querySelectorAll(".nav-logout").forEach(function (a) {
      a.addEventListener("click", function () {
        try {
          sessionStorage.removeItem(KEY);
        } catch (err) {}
      });
    });
  });
})();
