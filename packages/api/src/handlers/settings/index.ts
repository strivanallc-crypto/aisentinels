/**
 * Settings Lambda — entry point dispatcher.
 *
 * Handles all /api/v1/settings/* routes.
 *
 * Routes handled:
 *   GET    /api/v1/settings/org                       -> getOrg
 *   PUT    /api/v1/settings/org                       -> updateOrg
 *   POST   /api/v1/settings/standards/activate        -> activateStandard
 *   DELETE /api/v1/settings/standards/{code}           -> deactivateStandard
 *   GET    /api/v1/settings/roles                     -> getRoles
 *   GET    /api/v1/settings/users                     -> getUsers
 *   POST   /api/v1/settings/users/invite              -> inviteUser
 *   PUT    /api/v1/settings/users/{userId}/role        -> updateUserRole
 */
import type { APIGatewayProxyHandlerV2WithJWTAuthorizer } from 'aws-lambda';
import { getOrg }              from './get-org.ts';
import { updateOrg }           from './update-org.ts';
import { activateStandard }    from './activate-standard.ts';
import { deactivateStandard }  from './deactivate-standard.ts';
import { getRoles }            from './get-roles.ts';
import { getUsers }            from './get-users.ts';
import { inviteUser }          from './invite-user.ts';
import { updateUserRole }      from './update-user-role.ts';

export const handler: APIGatewayProxyHandlerV2WithJWTAuthorizer = async (event) => {
  const method = event.requestContext.http.method.toUpperCase();
  const path   = event.rawPath;

  try {
    // GET /api/v1/settings/org
    if (method === 'GET' && path === '/api/v1/settings/org') {
      return getOrg(event);
    }

    // PUT /api/v1/settings/org
    if (method === 'PUT' && path === '/api/v1/settings/org') {
      return updateOrg(event);
    }

    // POST /api/v1/settings/standards/activate
    if (method === 'POST' && path === '/api/v1/settings/standards/activate') {
      return activateStandard(event);
    }

    // DELETE /api/v1/settings/standards/{code}
    if (method === 'DELETE' && path.startsWith('/api/v1/settings/standards/')) {
      return deactivateStandard(event);
    }

    // GET /api/v1/settings/roles
    if (method === 'GET' && path === '/api/v1/settings/roles') {
      return getRoles(event);
    }

    // GET /api/v1/settings/users
    if (method === 'GET' && path === '/api/v1/settings/users') {
      return getUsers(event);
    }

    // POST /api/v1/settings/users/invite
    if (method === 'POST' && path === '/api/v1/settings/users/invite') {
      return inviteUser(event);
    }

    // PUT /api/v1/settings/users/{userId}/role
    if (method === 'PUT' && path.includes('/users/') && path.endsWith('/role')) {
      return updateUserRole(event);
    }

    return {
      statusCode: 404,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: `Not found: ${method} ${path}` }),
    };
  } catch (err) {
    console.error(JSON.stringify({ event: 'SettingsError', error: String(err), method, path }));
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Internal server error' }),
    };
  }
};
