export default class AdminUser {
  hasRole(...roles) {
    if (this.roles) {
      for (const role of roles) {
        if (this.roles.includes(role)) {
          return true
        }
      }
    }
    return false
  }
}
