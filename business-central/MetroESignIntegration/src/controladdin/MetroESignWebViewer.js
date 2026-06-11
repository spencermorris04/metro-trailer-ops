(function () {
  function getHost() {
    return document.getElementById("controlAddIn") || document.body;
  }

  function ensureFrame() {
    var host = getHost();
    var frame = document.getElementById("metro-esign-web-viewer-frame");

    if (frame) {
      return frame;
    }

    host.innerHTML = "";
    host.style.margin = "0";
    host.style.padding = "0";
    host.style.width = "100%";
    host.style.height = "100%";
    host.style.minHeight = "720px";
    host.style.overflow = "hidden";

    frame = document.createElement("iframe");
    frame.id = "metro-esign-web-viewer-frame";
    frame.title = "Metro E-Sign";
    frame.style.border = "0";
    frame.style.width = "100%";
    frame.style.height = "100%";
    frame.style.minHeight = "720px";
    frame.setAttribute(
      "sandbox",
      "allow-downloads allow-forms allow-modals allow-popups allow-popups-to-escape-sandbox allow-same-origin allow-scripts"
    );
    frame.setAttribute("referrerpolicy", "no-referrer-when-downgrade");

    host.appendChild(frame);
    return frame;
  }

  window.Navigate = function (url) {
    var frame = ensureFrame();
    if (frame.getAttribute("src") === (url || "about:blank")) {
      return;
    }
    frame.removeAttribute("srcdoc");
    frame.src = url || "about:blank";
  };

  window.SetContent = function (html) {
    var frame = ensureFrame();
    frame.removeAttribute("src");
    frame.srcdoc = html || "";
  };

  window.addEventListener("message", function (event) {
    var data = event.data || {};

    if (!data || data.type !== "metro-esign-editor-state") {
      return;
    }

    Microsoft.Dynamics.NAV.InvokeExtensibilityMethod("EditorStateChanged", [
      JSON.stringify(data.payload || {}),
    ]);
  });
})();
