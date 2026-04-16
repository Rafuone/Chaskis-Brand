const sections = document.querySelectorAll("section");

[...sections].forEach((section) => {
  const checkbox = section.querySelector("input");

  checkbox.addEventListener("change", () => {
    section.classList.toggle("enable-animation");
  });
});
