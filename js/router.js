// js/router.js

export class Router {
  constructor(routes, containerId = 'app') {
    this.routes = routes;
    this.container = document.getElementById(containerId);
  }

  init() {
    // Escucha cambios en la URL (al hacer clic en un enlace)
    window.addEventListener('hashchange', () => this.handleRoute());
    // Dispara la primera ruta al cargar la página
    this.handleRoute();
  }

  handleRoute() {
    const hash = window.location.hash || '#dashboard';
    const [path, param] = hash.split('/').slice(0, 2); 
    // Ejemplo: "#team/15" -> path: "#team", param: "15"

    const route = this.routes[path];

    if (route) {
      // Limpia el contenedor e inyecta la vista
      this.container.innerHTML = '';
      route(param);
      this.updateActiveNavLink(path);
    } else {
      // Ruta no encontrada -> Redirige a Dashboard
      window.location.hash = '#dashboard';
    }
  }

  updateActiveNavLink(currentPath) {
    const links = document.querySelectorAll('.nav-links a');
    links.forEach(link => {
      if (link.getAttribute('href') === currentPath) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });
  }
}