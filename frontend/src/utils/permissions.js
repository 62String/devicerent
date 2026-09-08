export const ADMIN_LEVEL = {
  MASTER: 0,
  OPERATOR: 1,
  DASHBOARD: 2,
  USER: 99,
};

export const getAdminLevel = (user) => {
  const level = Number(user?.roleLevel);
  return Number.isFinite(level) && level >= 0 ? level : ADMIN_LEVEL.USER;
};

export const isMasterAdmin = (user) => getAdminLevel(user) <= ADMIN_LEVEL.MASTER;
export const canOperateAdmin = (user) => getAdminLevel(user) <= ADMIN_LEVEL.OPERATOR;
export const canViewDashboard = (user) => getAdminLevel(user) <= ADMIN_LEVEL.DASHBOARD;
