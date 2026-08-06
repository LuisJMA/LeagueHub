// js/app.js
import { Router } from './router.js';
import * as Views from './views/placeholder-views.js';

// Mapeo de rutas de la SPA
const routes = {
  '#dashboard': Views.renderDashboard,
  '#leagues': Views.renderLeagues,
  '#teams': Views.renderTeams,
  '#team': (id) => Views.renderTeamDetail(id),
  '#players': Views.renderPlayers,
  '#player': (id) => Views.renderPlayerDetail(id),
  '#matches': Views.renderMatches,
  '#match': (id) => Views.renderMatchDetail(id),
  '#stats': Views.renderStats
};

document.addEventListener('DOMContentLoaded', () => {
  const router = new Router(routes);
  router.init();
});