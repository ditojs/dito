export default class DitoUser {
  hasRole(role) {
    return this.roles?.includes(role)
  }
}
