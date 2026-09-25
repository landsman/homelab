/* CV dialogs. htmx loads a project into the project dialog and opens it; this
   opens a project's photo full size in a second dialog stacked on top, and
   closes either one where the browser cannot on its own. Where invoker
   commands work, the close buttons do it natively; `closedby="any"` has the
   same gap, so without it a click on the backdrop is handled here. */

(function () {
  var invokers = "command" in HTMLButtonElement.prototype;
  var closedBy = "closedBy" in HTMLDialogElement.prototype;

  document.addEventListener("click", function (event) {
    var target = /** @type {HTMLElement} */ (event.target);

    var zoom = target.closest(".photo-zoom");
    if (zoom) {
      var source = /** @type {HTMLImageElement} */ (zoom.querySelector("img"));
      var photo = /** @type {HTMLImageElement} */ (document.getElementById("photo-dialog-image"));
      photo.src = source.src;
      photo.alt = source.alt;
      // A markdown title (`![alt](src "caption")`) wins; otherwise the alt text.
      /** @type {HTMLElement} */ (document.getElementById("photo-dialog-caption")).textContent =
        source.title || source.alt;
      /** @type {HTMLDialogElement} */ (document.getElementById("photo-dialog")).showModal();
      return;
    }

    // The full-size photo closes on a click anywhere on it, too.
    if (target.id === "photo-dialog-image") {
      /** @type {HTMLDialogElement} */ (target.closest("dialog")).close();
      return;
    }

    var button = target.closest("button[commandfor]");
    if (!invokers && button) {
      var dialog = /** @type {HTMLDialogElement} */ (
        document.getElementById(button.getAttribute("commandfor") || "")
      );
      if (button.getAttribute("command") === "close") dialog.close();
      return;
    }

    // A click on the backdrop lands on the dialog element itself.
    if (!closedBy && target instanceof HTMLDialogElement && target.open) target.close();
  });
})();
