"use client";

import { useEffect, useState } from "react";
import { useAuthStore } from "@/lib/auth-store";
import { ApiError } from "@/lib/api";
import { toast } from "@/lib/toast-store";

export default function MyAccountPage() {
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const changePassword = useAuthStore((s) => s.changePassword);

  const [profileForm, setProfileForm] = useState({ firstName: "", lastName: "", email: "" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [passwordForm, setPasswordForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (user) {
      setProfileForm({ firstName: user.firstName ?? "", lastName: user.lastName ?? "", email: user.email ?? "" });
    }
  }, [user]);

  async function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavingProfile(true);
    try {
      await updateProfile({ firstName: profileForm.firstName, lastName: profileForm.lastName || null, email: profileForm.email || null });
      toast.success("Profile updated");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  }

  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New password and confirmation don't match");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      toast.success("Password changed. Your other sessions have been signed out.");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">My Account</h1>

      <form onSubmit={handleProfileSubmit} className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Your Details</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="label">First Name</label>
            <input required className="input" value={profileForm.firstName} onChange={(e) => setProfileForm({ ...profileForm, firstName: e.target.value })} />
          </div>
          <div>
            <label className="label">Last Name</label>
            <input className="input" value={profileForm.lastName} onChange={(e) => setProfileForm({ ...profileForm, lastName: e.target.value })} />
          </div>
          <div className="sm:col-span-2">
            <label className="label">Email (optional)</label>
            <input type="email" className="input" value={profileForm.email} onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })} />
          </div>
          <div>
            <label className="label">Phone</label>
            <input className="input bg-slate-50" value={user.phone ?? ""} disabled />
            <p className="mt-1 text-xs text-slate-400">Your login phone number can't be changed here.</p>
          </div>
          <div>
            <label className="label">Role</label>
            <input className="input bg-slate-50" value={user.role} disabled />
          </div>
        </div>
        <button type="submit" disabled={savingProfile} className="btn-primary">
          {savingProfile ? "Saving…" : "Save Changes"}
        </button>
      </form>

      <form onSubmit={handlePasswordSubmit} className="card space-y-4 p-5">
        <h2 className="text-sm font-semibold">Change Password</h2>
        <div className="grid grid-cols-1 gap-4 sm:max-w-sm">
          <div>
            <label className="label">Current Password</label>
            <input required type="password" className="input" value={passwordForm.currentPassword} onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })} />
          </div>
          <div>
            <label className="label">New Password</label>
            <input required type="password" minLength={8} className="input" value={passwordForm.newPassword} onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })} />
            <p className="mt-1 text-xs text-slate-400">At least 8 characters, with a letter and a number.</p>
          </div>
          <div>
            <label className="label">Confirm New Password</label>
            <input required type="password" className="input" value={passwordForm.confirmPassword} onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })} />
          </div>
        </div>
        <button type="submit" disabled={changingPassword} className="btn-primary">
          {changingPassword ? "Updating…" : "Update Password"}
        </button>
      </form>
    </div>
  );
}
