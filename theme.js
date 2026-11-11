// Eseguito prima del CSS per evitare un lampo del tema opposto.
(() => {
  let theme = 'dark';
  try { if (localStorage.getItem('presenze-theme') === 'light') theme = 'light'; } catch {}
  document.documentElement.dataset.theme = theme;
})();
