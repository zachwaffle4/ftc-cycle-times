import { createRouter, createWebHistory } from 'vue-router'
import { CURRENT_YEAR } from '../config'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: `/home/${CURRENT_YEAR}` },
    { path: '/home/:year(\\d+)', name: 'home', component: () => import('../views/HomeView.vue'), props: true },
    {
      path: '/event/:year(\\d+)/:code',
      name: 'event',
      component: () => import('../views/EventDetailView.vue'),
      props: true,
    },
    {
      path: '/month/:year(\\d+)/:month(\\d+)',
      name: 'month',
      component: () => import('../views/MonthAggregateView.vue'),
      props: true,
    },
    { path: '/overall', redirect: `/season/${CURRENT_YEAR}` },
    {
      path: '/season/:year(\\d+)',
      name: 'season',
      component: () => import('../views/SeasonOverviewView.vue'),
      props: true,
    },
    {
      path: '/region/:year(\\d+)/:regionCode',
      name: 'region',
      component: () => import('../views/RegionHomeView.vue'),
      props: true,
    },
    {
      path: '/region/:year(\\d+)/:regionCode/overall',
      name: 'region-overall',
      component: () => import('../views/RegionOverallView.vue'),
      props: true,
    },
    {
      path: '/league/:year(\\d+)/:regionCode/:leagueCode',
      name: 'league',
      component: () => import('../views/LeagueHomeView.vue'),
      props: true,
    },
  ],
})

export default router
