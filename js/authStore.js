let accessToken = null;
let user = null;

export const authStore = {
  set(token, userInfo = null) {
    accessToken = token;
    if (userInfo) {
      user = userInfo; // { email, role }
    }
  },
  get() {
    return accessToken;
  },
  getUser() {
    return user;
  },
  clear() {
    accessToken = null;
    user = null;
  },
  isAuthenticated() {
    return accessToken !== null;
  }
};
