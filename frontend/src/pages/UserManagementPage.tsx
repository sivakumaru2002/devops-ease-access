import type { AppUser, UserRole } from "../types";

interface UserManagementPageProps {
  users: AppUser[];
  newUserEmail: string;
  newUserPassword: string;
  newUserRole: UserRole;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onRoleChange: (value: UserRole) => void;
  onCreateUser: () => void;
  onRefreshUsers: () => void;
}

export function UserManagementPage({
  users,
  newUserEmail,
  newUserPassword,
  newUserRole,
  onEmailChange,
  onPasswordChange,
  onRoleChange,
  onCreateUser,
  onRefreshUsers
}: Readonly<UserManagementPageProps>) {
  return (
    <section className="card stack">
      <div className="row user-page-header">
        <div>
          <h2>User Management</h2>
          <p>Create application users with email, password, and role.</p>
        </div>
        <button type="button" className="btn" onClick={onRefreshUsers}>
          Refresh Users
        </button>
      </div>

      <div className="subcard stack">
        <h3>Create User</h3>
        <div className="row user-form-row">
          <input
            placeholder="User email"
            value={newUserEmail}
            onChange={(e) => onEmailChange(e.target.value)}
          />
          <input
            type="password"
            placeholder="Temporary password"
            value={newUserPassword}
            onChange={(e) => onPasswordChange(e.target.value)}
          />
          <select value={newUserRole} onChange={(e) => onRoleChange(e.target.value as UserRole)}>
            <option value="admin">Admin</option>
            <option value="devops">DevOps</option>
            <option value="tester">Tester</option>
          </select>
          <button type="button" className="btn primary" onClick={onCreateUser}>
            Create User
          </button>
        </div>
      </div>

      <div className="table-wrap">
        <table className="env-table compact-users-table">
          <thead>
            <tr>
              <th>Email</th>
              <th>Role</th>
              <th>Created By</th>
              <th>Updated By</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td>{user.email}</td>
                <td>{user.role}</td>
                <td>{user.created_by}</td>
                <td>{user.updated_by ?? "-"}</td>
                <td>{new Date(user.updated_at).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
