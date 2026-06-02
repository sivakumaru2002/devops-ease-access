interface AccountSettingsPageProps {
  email: string;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onChangePassword: () => void;
}

export function AccountSettingsPage({
  email,
  currentPassword,
  newPassword,
  confirmPassword,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onChangePassword
}: Readonly<AccountSettingsPageProps>) {
  return (
    <section className="card stack">
      <h2>My Account</h2>
      <p>Signed in as {email}. Change your own password here.</p>
      <div className="subcard stack account-panel">
        <input
          type="password"
          placeholder="Current password"
          value={currentPassword}
          onChange={(e) => onCurrentPasswordChange(e.target.value)}
        />
        <input
          type="password"
          placeholder="New password"
          value={newPassword}
          onChange={(e) => onNewPasswordChange(e.target.value)}
        />
        <input
          type="password"
          placeholder="Confirm new password"
          value={confirmPassword}
          onChange={(e) => onConfirmPasswordChange(e.target.value)}
        />
        <button type="button" className="btn primary" onClick={onChangePassword}>
          Update Password
        </button>
      </div>
    </section>
  );
}
