const links = document.querySelectorAll(".intro a");

document.addEventListener("selectionchange", () => {
  const selection = window.getSelection();

  links.forEach((link) => {
    const isSelected = selection
      && !selection.isCollapsed
      && selection.containsNode(link, true);

    link.classList.toggle("is-selected", isSelected);
  });
});
