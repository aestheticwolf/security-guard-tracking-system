import { startTransition, useEffect, useState } from "react";
import {
  Building2,
  CreditCard,
  KeyRound,
  Landmark,
  Pencil,
  ShieldCheck,
  UserPlus,
  Users
} from "lucide-react";
import toast from "react-hot-toast";
import AppShell from "../layouts/AppShell";
import FormField from "../components/FormField";
import Panel from "../components/Panel";
import StatCard from "../components/StatCard";
import StatusBadge from "../components/StatusBadge";
import DashboardSkeleton from "../components/skeletons/DashboardSkeleton";
import {
  createOrganizationAdmin,
  createOrganizationWorkspace,
  getSuperAdminOverview,
  resetOrganizationAdminPassword,
  updateOrganizationWorkspace
} from "../services/superAdminService";
import { formatDateTime } from "../utils/format";

const emptyOrganizationForm = {
  name: "",
  code: "",
  contactEmail: "",
  phone: "",
  plan: "starter",
  guardLimit: "50",
  adminFullName: "",
  adminEmail: "",
  adminPassword: ""
};

const emptyAdminForm = {
  organizationId: "",
  fullName: "",
  email: "",
  password: "",
  phone: ""
};

const emptyEditOrganizationForm = {
  name: "",
  code: "",
  contactEmail: "",
  phone: "",
  status: "active",
  plan: "starter",
  guardLimit: "50",
  subscriptionStatus: "active"
};

const subscriptionPlanOptions = [
  { value: "starter", label: "Starter" },
  { value: "professional", label: "Professional" },
  { value: "enterprise", label: "Enterprise" }
];

const superAdminLinks = [
  { id: "platform-overview", label: "Overview", icon: Landmark },
  { id: "new-organization", label: "Add Org", icon: Building2 },
  { id: "organizations", label: "Organizations", icon: Users },
  { id: "organization-admins", label: "Admins", icon: UserPlus }
];

function organizationStatusAction(status) {
  return status === "active" ? "suspended" : "active";
}

function SubscriptionPlanSelect({ value, onChange }) {
  return (
    <label className="block">
      <span className="app-label">Subscription plan</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="app-input"
      >
        {subscriptionPlanOptions.map((plan) => (
          <option key={plan.value} value={plan.value}>
            {plan.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function SuperAdminDashboard() {
  const [overview, setOverview] = useState(null);
  const [organizationForm, setOrganizationForm] = useState(emptyOrganizationForm);
  const [adminForm, setAdminForm] = useState(emptyAdminForm);
  const [editingOrganizationId, setEditingOrganizationId] = useState("");
  const [editOrganizationForm, setEditOrganizationForm] = useState(emptyEditOrganizationForm);
  const [revealedAdminPasswords, setRevealedAdminPasswords] = useState({});
  const [resettingAdminId, setResettingAdminId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function refreshOverview() {
    try {
      const response = await getSuperAdminOverview();
      startTransition(() => setOverview(response));
      setError("");
      return response;
    } catch (loadError) {
      setError(loadError.message);
      return null;
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshOverview();
  }, []);

  function updateOrganizationForm(field, value) {
    setOrganizationForm((current) => ({ ...current, [field]: value }));
  }

  function updateAdminForm(field, value) {
    setAdminForm((current) => ({ ...current, [field]: value }));
  }

  function beginEditOrganization(organization) {
    setEditingOrganizationId(organization.id);
    setEditOrganizationForm({
      name: organization.name || "",
      code: organization.code || "",
      contactEmail: organization.contactEmail || "",
      phone: organization.phone || "",
      status: organization.status || "active",
      plan: organization.subscription?.plan || "starter",
      guardLimit: String(organization.subscription?.guardLimit ?? 50),
      subscriptionStatus: organization.subscription?.status || "active"
    });
    setError("");
    setMessage("");
  }

  function updateEditOrganizationForm(field, value) {
    setEditOrganizationForm((current) => ({ ...current, [field]: value }));
  }

  function cancelEditOrganization() {
    setEditingOrganizationId("");
    setEditOrganizationForm(emptyEditOrganizationForm);
  }

  async function handleCreateOrganization(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await createOrganizationWorkspace({
        name: organizationForm.name,
        code: organizationForm.code,
        contactEmail: organizationForm.contactEmail,
        phone: organizationForm.phone,
        subscription: {
          plan: organizationForm.plan,
          guardLimit: Number(organizationForm.guardLimit) || 50,
          status: "active"
        },
        admin:
          organizationForm.adminFullName ||
          organizationForm.adminEmail ||
          organizationForm.adminPassword
            ? {
                fullName: organizationForm.adminFullName,
                email: organizationForm.adminEmail,
                password: organizationForm.adminPassword
              }
            : null
      });
      setOrganizationForm(emptyOrganizationForm);
      await refreshOverview();
      setMessage("Organization workspace created.");
      toast.success("Organization workspace created.");
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleToggleOrganization(organization) {
    setBusy(true);
    setError("");
    setMessage("");

    try {
      const nextStatus = organizationStatusAction(organization.status);
      await updateOrganizationWorkspace(organization.id, {
        ...organization,
        status: nextStatus,
        subscription: organization.subscription || {}
      });
      await refreshOverview();
      setMessage(`Organization ${nextStatus === "active" ? "reactivated" : "suspended"}.`);
      toast.success(`Organization ${nextStatus === "active" ? "reactivated" : "suspended"}.`);
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleUpdateOrganization(event, organization) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await updateOrganizationWorkspace(organization.id, {
        name: editOrganizationForm.name,
        code: editOrganizationForm.code,
        contactEmail: editOrganizationForm.contactEmail,
        phone: editOrganizationForm.phone,
        status: editOrganizationForm.status,
        subscription: {
          ...(organization.subscription || {}),
          plan: editOrganizationForm.plan,
          guardLimit: Number(editOrganizationForm.guardLimit) || 50,
          status: editOrganizationForm.subscriptionStatus
        }
      });
      cancelEditOrganization();
      await refreshOverview();
      setMessage("Organization details updated.");
      toast.success("Organization details updated.");
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetAdminPassword(organization, admin) {
    setResettingAdminId(admin.id);
    setError("");
    setMessage("");

    try {
      const response = await resetOrganizationAdminPassword(organization.id, admin.id);
      setRevealedAdminPasswords((current) => ({
        ...current,
        [admin.id]: response.temporaryPassword
      }));
      await refreshOverview();
      setMessage(`Temporary password reset for ${admin.fullName}.`);
      toast.success("Temporary password generated.");
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setResettingAdminId("");
    }
  }

  function copyAdminPassword(adminId) {
    const password = revealedAdminPasswords[adminId];

    if (!password) {
      return;
    }

    navigator.clipboard?.writeText(password).then(
      () => toast.success("Temporary password copied."),
      () => toast.error("Could not copy password.")
    );
  }

  async function handleCreateAdmin(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");

    try {
      await createOrganizationAdmin(adminForm.organizationId, adminForm);
      setAdminForm(emptyAdminForm);
      await refreshOverview();
      setMessage("Organization admin created.");
      toast.success("Organization admin created.");
    } catch (submitError) {
      setError(submitError.message);
      toast.error(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <AppShell
        title="Platform Control"
        subtitle="Manage client organizations, organization administrators, and manual subscription records."
      >
        <DashboardSkeleton />
      </AppShell>
    );
  }

  const organizations = overview?.organizations || [];

  return (
    <AppShell
      title="Platform Control"
      subtitle="Manage organizations, organization admins, and subscription limits from the Infipre owner workspace."
      mobileQuickLinks={superAdminLinks}
      sectionLinks={superAdminLinks}
    >
      <div className="space-y-5">
        {(error || message) && (
          <div className={`app-banner ${error ? "app-banner-error" : "app-banner-success"}`}>
            {error || message}
          </div>
        )}

        <section id="platform-overview" className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
          <StatCard
            icon={Building2}
            label="Organizations"
            value={overview?.metrics?.organizations ?? 0}
            detail={`${overview?.metrics?.activeOrganizations ?? 0} active workspaces`}
          />
          <StatCard
            icon={CreditCard}
            label="Subscriptions"
            value={overview?.metrics?.activeSubscriptions ?? 0}
            detail="Manual active subscription records"
            tone="jade"
          />
          <StatCard
            icon={ShieldCheck}
            label="Guards"
            value={overview?.metrics?.totalGuards ?? 0}
            detail="Across all organizations"
            tone="gold"
          />
          <StatCard
            icon={Users}
            label="Owner Role"
            value="Super"
            detail="Platform-level access"
            tone="slate"
          />
        </section>

        <div className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Panel
            id="new-organization"
            title="Add Organization"
            subtitle="Create a client workspace with an optional first organization admin."
          >
            <form onSubmit={handleCreateOrganization} className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Organization name"
                value={organizationForm.name}
                onChange={(value) => updateOrganizationForm("name", value)}
                placeholder="North Star Security"
              />
              <FormField
                label="Organization code"
                value={organizationForm.code}
                onChange={(value) => updateOrganizationForm("code", value)}
                placeholder="NORTH-STAR"
              />
              <FormField
                label="Contact email"
                type="email"
                value={organizationForm.contactEmail}
                onChange={(value) => updateOrganizationForm("contactEmail", value)}
                placeholder="ops@example.com"
              />
              <FormField
                label="Phone"
                value={organizationForm.phone}
                onChange={(value) => updateOrganizationForm("phone", value)}
                placeholder="+91 90000 00000"
              />
              <SubscriptionPlanSelect
                value={organizationForm.plan}
                onChange={(value) => updateOrganizationForm("plan", value)}
              />
              <FormField
                label="Guard limit"
                type="number"
                value={organizationForm.guardLimit}
                onChange={(value) => updateOrganizationForm("guardLimit", value)}
                placeholder="50"
              />
              <FormField
                label="First admin name"
                value={organizationForm.adminFullName}
                onChange={(value) => updateOrganizationForm("adminFullName", value)}
                placeholder="Priya Sharma"
              />
              <FormField
                label="First admin email"
                type="email"
                value={organizationForm.adminEmail}
                onChange={(value) => updateOrganizationForm("adminEmail", value)}
                placeholder="admin@example.com"
              />
              <FormField
                label="First admin password"
                type="password"
                value={organizationForm.adminPassword}
                onChange={(value) => updateOrganizationForm("adminPassword", value)}
                placeholder="Temporary password"
              />
              <button
                type="submit"
                disabled={busy}
                className="app-primary-button rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:self-end"
              >
                Create Workspace
              </button>
            </form>
          </Panel>

          <Panel
            id="organization-admins"
            title="Add Organization Admin"
            subtitle="Give an existing organization another admin login."
          >
            <form onSubmit={handleCreateAdmin} className="grid gap-4 sm:grid-cols-2">
              <label className="block sm:col-span-2">
                <span className="app-label">Organization</span>
                <select
                  value={adminForm.organizationId}
                  onChange={(event) => updateAdminForm("organizationId", event.target.value)}
                  className="app-input"
                >
                  <option value="">Select organization</option>
                  {organizations.map((organization) => (
                    <option key={organization.id} value={organization.id}>
                      {organization.name}
                    </option>
                  ))}
                </select>
              </label>
              <FormField
                label="Admin name"
                value={adminForm.fullName}
                onChange={(value) => updateAdminForm("fullName", value)}
                placeholder="Amit Rao"
              />
              <FormField
                label="Admin email"
                type="email"
                value={adminForm.email}
                onChange={(value) => updateAdminForm("email", value)}
                placeholder="admin@client.com"
              />
              <FormField
                label="Temporary password"
                type="password"
                value={adminForm.password}
                onChange={(value) => updateAdminForm("password", value)}
                placeholder="Minimum 8 characters"
              />
              <FormField
                label="Phone"
                value={adminForm.phone}
                onChange={(value) => updateAdminForm("phone", value)}
                placeholder="+91 90000 00000"
              />
              <button
                type="submit"
                disabled={busy}
                className="app-outline-button rounded-2xl px-5 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70 sm:col-span-2"
              >
                Create Admin
              </button>
            </form>
          </Panel>
        </div>

        <Panel
          id="organizations"
          title="Organizations"
          subtitle="Client workspaces, administrators, subscription status, and guard capacity."
        >
          <div className="grid gap-4 xl:grid-cols-2">
            {organizations.length ? (
              organizations.map((organization) => (
                <article
                  key={organization.id}
                  className="rounded-[24px] border border-white/10 bg-white/5 p-4"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-display text-2xl font-semibold app-copy-primary">
                        {organization.name}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-[0.24em] app-copy-soft">
                        {organization.code}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={organization.status} />
                      <button
                        type="button"
                        onClick={() => beginEditOrganization(organization)}
                        className="app-outline-button inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        Edit Details
                      </button>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-3">
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] app-copy-soft">Guards</p>
                      <p className="mt-2 text-xl font-semibold app-copy-primary">
                        {organization.metrics?.guardCount ?? 0}
                        <span className="text-sm font-normal app-copy-muted">
                          {" "} / {organization.subscription?.guardLimit ?? 0}
                        </span>
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] app-copy-soft">Admins</p>
                      <p className="mt-2 text-xl font-semibold app-copy-primary">
                        {organization.metrics?.adminCount ?? 0}
                      </p>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-slate-950/30 p-3">
                      <p className="text-xs uppercase tracking-[0.2em] app-copy-soft">Plan</p>
                      <p className="mt-2 text-sm font-semibold capitalize app-copy-primary">
                        {organization.subscription?.plan || "starter"}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 text-sm app-copy-muted">
                    <p>{organization.contactEmail || "No contact email"}</p>
                    <p>{organization.phone || "No phone"}</p>
                    <p>
                      Subscription:{" "}
                      <span className="font-medium capitalize app-copy-primary">
                        {organization.subscription?.status || "active"}
                      </span>
                    </p>
                    <p>
                      Updated:{" "}
                      {organization.updatedAt ? formatDateTime(organization.updatedAt) : "Not available"}
                    </p>
                  </div>

                  {editingOrganizationId === organization.id && (
                    <form
                      onSubmit={(event) => handleUpdateOrganization(event, organization)}
                      className="mt-5 grid gap-4 rounded-[22px] border border-white/10 bg-white/5 p-4 sm:grid-cols-2"
                    >
                      <FormField
                        label="Organization name"
                        value={editOrganizationForm.name}
                        onChange={(value) => updateEditOrganizationForm("name", value)}
                      />
                      <FormField
                        label="Organization code"
                        value={editOrganizationForm.code}
                        onChange={(value) => updateEditOrganizationForm("code", value)}
                      />
                      <FormField
                        label="Contact email"
                        type="email"
                        value={editOrganizationForm.contactEmail}
                        onChange={(value) => updateEditOrganizationForm("contactEmail", value)}
                      />
                      <FormField
                        label="Phone"
                        value={editOrganizationForm.phone}
                        onChange={(value) => updateEditOrganizationForm("phone", value)}
                      />
                      <SubscriptionPlanSelect
                        value={editOrganizationForm.plan}
                        onChange={(value) => updateEditOrganizationForm("plan", value)}
                      />
                      <FormField
                        label="Guard limit"
                        type="number"
                        value={editOrganizationForm.guardLimit}
                        onChange={(value) => updateEditOrganizationForm("guardLimit", value)}
                      />
                      <label className="block">
                        <span className="app-label">Organization status</span>
                        <select
                          value={editOrganizationForm.status}
                          onChange={(event) => updateEditOrganizationForm("status", event.target.value)}
                          className="app-input"
                        >
                          <option value="active">Active</option>
                          <option value="suspended">Suspended</option>
                        </select>
                      </label>
                      <label className="block">
                        <span className="app-label">Subscription status</span>
                        <select
                          value={editOrganizationForm.subscriptionStatus}
                          onChange={(event) => updateEditOrganizationForm("subscriptionStatus", event.target.value)}
                          className="app-input"
                        >
                          <option value="trial">Trial</option>
                          <option value="active">Active</option>
                          <option value="past_due">Past due</option>
                          <option value="cancelled">Cancelled</option>
                        </select>
                      </label>
                      <div className="flex flex-col gap-2 sm:col-span-2 sm:flex-row sm:justify-end">
                        <button
                          type="button"
                          onClick={cancelEditOrganization}
                          className="app-outline-button rounded-2xl px-4 py-2.5 text-sm font-medium"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={busy}
                          className="app-primary-button rounded-2xl px-4 py-2.5 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-70"
                        >
                          Save Changes
                        </button>
                      </div>
                    </form>
                  )}

                  {organization.admins?.length > 0 && (
                    <div className="mt-4 border-t border-white/10 pt-4">
                      <p className="text-xs uppercase tracking-[0.22em] app-copy-soft">
                        Organization admins
                      </p>
                      <div className="mt-3 grid gap-3">
                        {organization.admins.map((admin) => (
                          <div
                            key={admin.id}
                            className="rounded-2xl border border-white/10 bg-white/5 p-3"
                          >
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div>
                                <p className="text-sm font-semibold app-copy-primary">{admin.fullName}</p>
                                <p className="mt-1 text-xs app-copy-muted">{admin.email}</p>
                                <p className="mt-1 text-xs app-copy-soft">
                                  Password: reset to generate a temporary password.
                                </p>
                              </div>
                              <button
                                type="button"
                                disabled={resettingAdminId === admin.id}
                                onClick={() => handleResetAdminPassword(organization, admin)}
                                className="app-outline-button inline-flex items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-70"
                              >
                                <KeyRound className="h-3.5 w-3.5" />
                                {resettingAdminId === admin.id ? "Resetting..." : "Reset Password"}
                              </button>
                            </div>
                            {revealedAdminPasswords[admin.id] && (
                              <div className="mt-3 rounded-2xl border border-jade-300/20 bg-jade-300/10 p-3">
                                <p className="text-xs uppercase tracking-[0.2em] text-jade-200">
                                  Temporary password
                                </p>
                                <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <code className="rounded-xl bg-slate-950/40 px-3 py-2 text-sm app-copy-primary">
                                    {revealedAdminPasswords[admin.id]}
                                  </code>
                                  <button
                                    type="button"
                                    onClick={() => copyAdminPassword(admin.id)}
                                    className="app-outline-button rounded-2xl px-3 py-2 text-xs font-medium"
                                  >
                                    Copy
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleToggleOrganization(organization)}
                      className="app-outline-button rounded-2xl px-4 py-2.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {organization.status === "active" ? "Suspend Organization" : "Reactivate Organization"}
                    </button>
                  </div>
                </article>
              ))
            ) : (
              <p className="text-sm app-copy-muted">No organizations have been created yet.</p>
            )}
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
