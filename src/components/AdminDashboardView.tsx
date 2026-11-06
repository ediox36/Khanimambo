import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Eye,
  EyeOff,
  Plus,
  Search,
  ShieldAlert,
  ShieldCheck,
  Star,
  UserCheck,
  UserX,
} from 'lucide-react';
import { useMarketplace } from '../context/MarketplaceContext';
import { formatMozDate, formatMzn, REQUEST_STATUS_LABELS_PT } from '../utils/marketplaceLogic';

export const AdminDashboardView: React.FC = () => {
  const {
    currentUser,
    adminData,
    refreshAdminOverview,
    adminVerifyProvider,
    adminSuspendUser,
    adminCreateCategory,
    adminToggleCategory,
    adminModerateReview,
    adminUpdateReport,
    adminUpdateSettings,
  } = useMarketplace();

  const [subTab, setSubTab] = useState<
    'users' | 'categories' | 'requests' | 'moderation' | 'settings'
  >('users');
  const [userSearch, setUserSearch] = useState('');

  // New Category Form
  const [newCatPt, setNewCatPt] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');

  // Settings Form
  const [platformName, setPlatformName] = useState(
    adminData?.settings.platformName || 'Kanimambo'
  );
  const [commissionPercent, setCommissionPercent] = useState(
    String(adminData?.settings.commissionPercent ?? 8)
  );
  const [requireVerif, setRequireVerif] = useState(
    adminData?.settings.requireProviderVerification ?? true
  );
  const [supportPhone, setSupportPhone] = useState(
    adminData?.settings.supportPhone || '+258 84 300 9000'
  );
  const [supportEmail, setSupportEmail] = useState(
    adminData?.settings.supportEmail || 'suporte@kanimambo.co.mz'
  );

  React.useEffect(() => {
    if (currentUser?.roles.includes('admin') && !adminData) {
      refreshAdminOverview();
    }
  }, [currentUser, adminData, refreshAdminOverview]);

  React.useEffect(() => {
    if (!adminData?.settings) return;
    setPlatformName(adminData.settings.platformName);
    setCommissionPercent(String(adminData.settings.commissionPercent));
    setRequireVerif(adminData.settings.requireProviderVerification);
    setSupportPhone(adminData.settings.supportPhone);
    setSupportEmail(adminData.settings.supportEmail);
  }, [adminData?.settings]);

  const filteredUsers = useMemo(() => {
    if (!adminData) return [];
    const q = userSearch.trim().toLowerCase();
    if (!q) return adminData.users;
    return adminData.users.filter(
      (u) =>
        u.fullName.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q)
    );
  }, [adminData, userSearch]);

  if (!currentUser || !currentUser.roles.includes('admin')) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-14 text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-rose-700" />
        <h1 className="mt-3 font-display text-2xl font-bold text-[#141815]">
          Acesso Restrito à Administração
        </h1>
        <p className="mt-1 text-sm text-[#4A524D]">
          Esta área é reservada aos administradores da plataforma Kanimambo.
        </p>
      </div>
    );
  }

  if (!adminData) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 text-sm text-[#4A524D]">
        A carregar painel administrativo...
      </div>
    );
  }

  const { analytics, providers, categories, requests, reviews, reports } = adminData;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[#14533D]">
            Administração Kanimambo · Moçambique
          </span>
          <h1 className="mt-1 font-display text-2xl font-bold text-[#141815] sm:text-3xl">
            Painel de Controlo da Plataforma
          </h1>
        </div>

        <button
          type="button"
          onClick={refreshAdminOverview}
          className="self-start rounded-lg border border-zinc-300 bg-white px-3.5 py-2 text-xs font-semibold text-[#141815] hover:bg-zinc-50"
        >
          Actualizar Dados
        </button>
      </div>

      {/* Platform Analytics Strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
        {[
          { label: 'Utilizadores', value: analytics.totalUsers },
          { label: 'Prestadores Activos', value: analytics.activeProviders },
          { label: 'Disponíveis Agora', value: analytics.availableProviders },
          { label: 'Serviços Activos', value: analytics.activeServices },
          { label: 'Total Pedidos', value: analytics.totalRequests },
          { label: 'Concluídos', value: analytics.completedRequests },
          { label: 'Média Avaliação', value: `${analytics.averageProviderRating.toFixed(1)} ★` },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-zinc-200 bg-white p-3.5"
          >
            <span className="block text-[11px] font-medium text-[#6E7771]">{kpi.label}</span>
            <span className="mt-1 block font-display text-xl font-bold text-[#141815] tabular-nums">
              {kpi.value}
            </span>
          </div>
        ))}
      </div>

      {/* Admin Sub-tabs */}
      <div className="flex gap-2 overflow-x-auto border-b border-zinc-200 pb-3">
        {[
          { id: 'users', label: `Utilizadores e Prestadores (${adminData.users.length})` },
          { id: 'categories', label: `Categorias (${categories.length})` },
          { id: 'requests', label: `Pedidos (${requests.length})` },
          { id: 'moderation', label: `Denúncias e Avaliações (${reports.length})` },
          { id: 'settings', label: 'Definições da Plataforma' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSubTab(tab.id as typeof subTab)}
            className={`rounded-lg border px-3.5 py-2 text-xs font-semibold whitespace-nowrap ${
              subTab === tab.id
                ? 'border-[#14533D] bg-[#14533D] text-white'
                : 'border-zinc-200 bg-white text-[#4A524D] hover:text-[#141815]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* SUBTAB 1: USERS & PROVIDERS */}
      {subTab === 'users' && (
        <div className="space-y-4">
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={userSearch}
              onChange={(e) => setUserSearch(e.target.value)}
              placeholder="Filtrar por nome, email ou cidade..."
              className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-xs"
            />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-zinc-200 bg-[#FAF9F6] text-[#6E7771]">
                  <th className="px-4 py-3 font-semibold">Utilizador / Negócio</th>
                  <th className="px-4 py-3 font-semibold">Contacto e Cidade</th>
                  <th className="px-4 py-3 font-semibold">Papéis</th>
                  <th className="px-4 py-3 font-semibold">Estado</th>
                  <th className="px-4 py-3 text-right font-semibold">Acções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredUsers.map((u) => {
                  const prov = providers.find((p) => p.providerId === u.uid);
                  const isSelf = u.uid === currentUser.uid;
                  return (
                    <tr key={u.uid}>
                      <td className="px-4 py-3">
                        <p className="font-bold text-[#141815]">{u.fullName}</p>
                        {prov && (
                          <p className="text-[11px] text-[#14533D]">
                            {prov.businessName}{' '}
                            {prov.isVerified ? '· Verificado' : '· Não verificado'}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[#4A524D]">
                        <p>{u.email}</p>
                        <p className="text-[11px] text-[#6E7771]">
                          {u.phone} · {u.neighborhood}, {u.city}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-mono text-[11px] text-[#4A524D]">
                        {u.roles.join(', ')}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`font-semibold ${
                            u.isSuspended ? 'text-rose-700' : 'text-[#14533D]'
                          }`}
                        >
                          {u.isSuspended ? 'Suspensa' : 'Activa'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          {prov && (
                            <button
                              type="button"
                              onClick={() => adminVerifyProvider(prov.providerId, !prov.isVerified)}
                              className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 px-2.5 py-1 text-[11px] font-semibold text-[#141815] hover:bg-zinc-50"
                            >
                              <ShieldCheck className="h-3.5 w-3.5 text-[#14533D]" />
                              <span>{prov.isVerified ? 'Remover Selo' : 'Verificar'}</span>
                            </button>
                          )}

                          {!isSelf && (
                            <button
                              type="button"
                              onClick={() => adminSuspendUser(u.uid, !u.isSuspended)}
                              className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                                u.isSuspended
                                  ? 'border-emerald-300 text-emerald-800 hover:bg-emerald-50'
                                  : 'border-rose-200 text-rose-700 hover:bg-rose-50'
                              }`}
                            >
                              {u.isSuspended ? (
                                <>
                                  <UserCheck className="h-3.5 w-3.5" />
                                  <span>Reactivar</span>
                                </>
                              ) : (
                                <>
                                  <UserX className="h-3.5 w-3.5" />
                                  <span>Suspender</span>
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* SUBTAB 2: SERVICE CATEGORIES */}
      {subTab === 'categories' && (
        <div className="space-y-6">
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!newCatPt.trim()) return;
              await adminCreateCategory({
                namePt: newCatPt.trim(),
                descriptionPt: newCatDesc.trim(),
              });
              setNewCatPt('');
              setNewCatDesc('');
            }}
            className="flex flex-col gap-3 rounded-2xl border border-zinc-200 bg-white p-4 sm:flex-row sm:items-end"
          >
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[#141815]">
                Nova Categoria (Português) *
              </label>
              <input
                type="text"
                required
                value={newCatPt}
                onChange={(e) => setNewCatPt(e.target.value)}
                placeholder="Ex: Informática e Reparação"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
              />
            </div>
            <div className="flex-1">
              <label className="block text-xs font-semibold text-[#141815]">Descrição</label>
              <input
                type="text"
                value={newCatDesc}
                onChange={(e) => setNewCatDesc(e.target.value)}
                placeholder="Breve descrição dos serviços..."
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-xs"
              />
            </div>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#14533D] px-4 py-2 text-xs font-semibold text-white"
            >
              <Plus className="h-4 w-4" />
              <span>Adicionar</span>
            </button>
          </form>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((cat) => (
              <div
                key={cat.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-zinc-200 bg-white p-4"
              >
                <div>
                  <p className="font-display text-sm font-bold text-[#141815]">{cat.namePt}</p>
                  <p className="mt-0.5 text-xs text-[#6E7771]">{cat.descriptionPt}</p>
                </div>
                <button
                  type="button"
                  onClick={() => adminToggleCategory(cat.id, !cat.isActive)}
                  className={`shrink-0 rounded-lg border px-2.5 py-1 text-[11px] font-semibold ${
                    cat.isActive
                      ? 'border-emerald-200 bg-emerald-50 text-[#14533D]'
                      : 'border-zinc-200 bg-zinc-50 text-zinc-500'
                  }`}
                >
                  {cat.isActive ? 'Activa' : 'Inactiva'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 3: MONITOR REQUESTS */}
      {subTab === 'requests' && (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-zinc-200 bg-[#FAF9F6] text-[#6E7771]">
                <th className="px-4 py-3 font-semibold">Serviço</th>
                <th className="px-4 py-3 font-semibold">Cliente</th>
                <th className="px-4 py-3 font-semibold">Prestador</th>
                <th className="px-4 py-3 font-semibold">Data</th>
                <th className="px-4 py-3 font-semibold">Total Estimado</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {requests.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-semibold text-[#141815]">{r.serviceTitle}</td>
                  <td className="px-4 py-3 text-[#4A524D]">{r.customerName}</td>
                  <td className="px-4 py-3 text-[#4A524D]">{r.providerName}</td>
                  <td className="px-4 py-3 text-[#6E7771] tabular-nums">
                    {formatMozDate(r.preferredDate)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#141815] tabular-nums">
                    {r.pricingModel === 'consultation'
                      ? 'Sob consulta'
                      : formatMzn(r.estimatedTotalMzn)}
                  </td>
                  <td className="px-4 py-3 font-semibold text-[#14533D]">
                    {REQUEST_STATUS_LABELS_PT[r.status]}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SUBTAB 4: REPORTS & REVIEW MODERATION */}
      {subTab === 'moderation' && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Reports Column */}
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[#141815]">
              Denúncias Reportadas ({reports.length})
            </h2>
            {reports.map((rep) => (
              <div
                key={rep.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141815]">{rep.targetLabel}</span>
                  <span
                    className={`rounded px-2 py-0.5 text-[11px] font-semibold ${
                      rep.status === 'open'
                        ? 'bg-amber-50 text-amber-900'
                        : 'bg-zinc-100 text-zinc-700'
                    }`}
                  >
                    {rep.status === 'open'
                      ? 'Em aberto'
                      : rep.status === 'resolved'
                      ? 'Resolvida'
                      : 'Arquivada'}
                  </span>
                </div>
                <p className="text-xs text-[#4A524D]">
                  <strong>Motivo:</strong> {rep.reason}
                </p>
                {rep.details && <p className="text-xs text-[#6E7771]">{rep.details}</p>}
                <p className="text-[11px] text-[#6E7771]">
                  Reportado por {rep.reporterName} em {formatMozDate(rep.createdAt)}
                </p>

                {rep.status === 'open' && (
                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => adminUpdateReport(rep.id, 'resolved')}
                      className="rounded-lg bg-[#14533D] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Marcar Resolvida
                    </button>
                    <button
                      type="button"
                      onClick={() => adminUpdateReport(rep.id, 'dismissed')}
                      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700"
                    >
                      Arquivar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Customer Reviews Moderation Column */}
          <div className="space-y-3">
            <h2 className="font-display text-lg font-bold text-[#141815]">
              Moderação de Avaliações ({reviews.length})
            </h2>
            {reviews.map((rev) => (
              <div
                key={rev.id}
                className={`rounded-xl border p-4 space-y-2 ${
                  rev.isModeratedHidden
                    ? 'border-rose-200 bg-rose-50/40'
                    : 'border-zinc-200 bg-white'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-[#141815]">
                      {rev.customerName} → {rev.providerName}
                    </p>
                    <p className="text-[11px] text-[#6E7771]">
                      {rev.serviceTitle} · {formatMozDate(rev.createdAt)}
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-bold text-[#B45309] tabular-nums">
                    <Star className="h-3.5 w-3.5 fill-[#B45309] text-[#B45309]" />
                    {rev.rating}
                  </span>
                </div>

                <p className="text-xs text-[#4A524D]">{rev.comment}</p>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] font-semibold text-[#6E7771]">
                    {rev.isModeratedHidden ? 'Oculta do público' : 'Visível publicamente'}
                  </span>
                  <button
                    type="button"
                    onClick={() => adminModerateReview(rev.id, !rev.isModeratedHidden)}
                    className="inline-flex items-center gap-1 rounded-lg border border-zinc-300 bg-white px-3 py-1 text-xs font-semibold text-[#141815] hover:bg-zinc-50"
                  >
                    {rev.isModeratedHidden ? (
                      <>
                        <Eye className="h-3.5 w-3.5 text-[#14533D]" />
                        <span>Restaurar</span>
                      </>
                    ) : (
                      <>
                        <EyeOff className="h-3.5 w-3.5 text-rose-700" />
                        <span>Ocultar</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SUBTAB 5: PLATFORM SETTINGS */}
      {subTab === 'settings' && (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            await adminUpdateSettings({
              platformName,
              commissionPercent: Number(commissionPercent) || 8,
              requireProviderVerification: requireVerif,
              supportPhone,
              supportEmail,
            });
          }}
          className="max-w-xl rounded-2xl border border-zinc-200 bg-white p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-bold text-[#141815]">
            Configurações Gerais da Plataforma
          </h2>

          <div>
            <label className="block text-xs font-semibold text-[#141815]">
              Nome da Plataforma
            </label>
            <input
              type="text"
              value={platformName}
              onChange={(e) => setPlatformName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-semibold text-[#141815]">
                Taxa de Comissão (%)
              </label>
              <input
                type="number"
                min={0}
                max={35}
                value={commissionPercent}
                onChange={(e) => setCommissionPercent(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm tabular-nums"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#141815]">
                Telefone de Suporte (+258)
              </label>
              <input
                type="text"
                value={supportPhone}
                onChange={(e) => setSupportPhone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#141815]">Email de Suporte</label>
            <input
              type="email"
              value={supportEmail}
              onChange={(e) => setSupportEmail(e.target.value)}
              className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-[#141815]">
            <input
              type="checkbox"
              checked={requireVerif}
              onChange={(e) => setRequireVerif(e.target.checked)}
            />
            <span>Exigir verificação administrativa para selo oficial de prestador</span>
          </label>

          <button
            type="submit"
            className="inline-flex items-center gap-2 rounded-lg bg-[#14533D] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#0E3D2D]"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Guardar Configurações</span>
          </button>
        </form>
      )}
    </div>
  );
};
