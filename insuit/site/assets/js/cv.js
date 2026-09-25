/* CV project dialog — htmx loads a project into it and opens it; this only
   closes it where the browser cannot on its own. Where invoker commands work,
   the close button does it natively; `closedby="any"` has the same gap, so
   without it a click on the backdrop is handled here. */

(function () {
  var invokers = "command" in HTMLButtonElement.prototype;
  var closedBy = "closedBy" in HTMLDialogElement.prototype;

  document.addEventListener("click", function (event) {
    var target = /** @type {HTMLElement} */ (event.target);

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
