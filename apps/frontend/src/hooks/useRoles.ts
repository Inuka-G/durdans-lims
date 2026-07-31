import keycloak from"@/lib/keycloak";

export function useRoles() {
 const roles = keycloak?.tokenParsed?.realm_access?.roles || [];

 return {
 roles,
 hasRole: (role: string) => roles.includes(role),
 hasAnyRole: (roleList: string[]) => Object.values(roleList).some(r => roles.includes(r))
 };
}
