/* CV dialogs. htmx loads a project into the project dialog and opens it; this
   opens a project's photo full size in a second dialog stacked on top, steps
   through the project's other photos from there, and closes either dialog
   where the browser cannot on its own. Where invoker commands work, the close
   buttons do it natively; `closedby="any"` has the same gap, so without it a
   click on the backdrop is handled here. */

(function () {
  var invokers = "command" in HTMLButtonElement.prototype;
  var closedBy = "closedBy" in HTMLDialogElement.prototype;

  var dialog = /** @type {HTMLDialogElement} */ (document.getElementById("photo-dialog"));
  var photo = /** @type {HTMLImageElement} */ (document.getElementById("photo-dialog-image"));
  var caption = /** @type {HTMLElement} */ (document.getElementById("photo-dialog-caption"));
  var previous = /** @type {HTMLButtonElement} */ (document.getElementById("photo-previous"));
  var next = /** @type {HTMLButtonElement} */ (document.getElementById("photo-next"));

  /** @type {HTMLImageElement[]} The open project's photos, in gallery order. */
  var photos = [];
  var current = 0;

  /**
   * Show one of the open project's photos in the full-size dialog.
   * @param {number} index Position in `photos`; wraps around at either end.
   */
  function show(index) {
    current = (index + photos.length) % photos.length;
    var source = photos[current];
    photo.src = source.src;
    photo.alt = source.alt;
    // A markdown title (`![alt](src "caption")`) wins; otherwise the alt text.
    caption.textContent = source.title || source.alt;
  }

  document.addEventListener("click", function (event) {
    var target = /** @type {HTMLElement} */ (event.target);

    var zoom = target.closest(".photo-zoom");
    if (zoom) {
      var all = document.querySelectorAll("#project-dialog-content .photo-zoom img");
      photos = /** @type {HTMLImageElement[]} */ (Array.prototype.slice.call(all));
      // One photo has nowhere to step to, so the arrows stay out of the way.
      previous.hidden = next.hidden = photos.length < 2;
      show(photos.indexOf(/** @type {HTMLImageElement} */ (zoom.querySelector("img"))));
      dialog.showModal();
      // The dialog itself takes focus, not its close button: the arrow keys
      // that step through the photos would otherwise show the button's ring.
      dialog.focus();
      return;
    }

    if (target.closest("#photo-previous")) return show(current - 1);
    if (target.closest("#photo-next")) return show(current + 1);

    // The full-size photo closes on a click anywhere on it, too.
    if (target === photo) {
      dialog.close();
      return;
    }

    var button = target.closest("button[commandfor]");
    if (!invokers && button) {
      var owner = /** @type {HTMLDialogElement} */ (
        document.getElementById(button.getAttribute("commandfor") || "")
      );
      if (button.getAttribute("command") === "close") owner.close();
      return;
    }

    // A click on the backdrop lands on the dialog element itself.
    if (!closedBy && target instanceof HTMLDialogElement && target.open) target.close();
  });

  // The arrow keys step through the photos while the full-size one is open.
  document.addEventListener("keydown", function (event) {
    if (!dialog.open || photos.length < 2) return;
    if (event.key === "ArrowLeft") show(current - 1);
    else if (event.key === "ArrowRight") show(current + 1);
  });
})();
