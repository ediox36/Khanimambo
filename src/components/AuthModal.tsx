import React, { useMemo, useState } from 'react';
import {
  Briefcase,
  CheckCircle2,
  KeyRound,
  Mail,
  MapPin,
  Phone,
  Shield,
  Upload,
  User,
  X,
} from 'lucide-react';
import { APP_MEDIA } from '../assets/media';
import { MOZAMBIQUE_CITIES } from '../data/mozambiqueLocations';
import { useMarketplace } from '../context/MarketplaceContext';
import { compressImageFileToDataUrl } from '../utils/imageUpload';
import type { PricingModel, ServiceLocationMode } from '../types/marketplace';

export const AuthModal: React.FC = () => {
  const {
    authModalOpen,
    authModalInitialMode,
    closeAuthModal,
    needsGoogleOnboarding,
    setNeedsGoogleOnboarding,
    currentUser,
    categories,
    sendVerificationCode,
    verifyCode,
    registerAccount,
    loginWithPassword,
    loginWithGoogle,
    loginAsDemo,
    switchOrConfigureRole,
    updateAccountProfile,
  } = useMarketplace();

  const [tab, setTab] = useState<'login' | 'register'>(authModalInitialMode);
  const [accountType, setAccountType] = useState<'customer' | 'provider' | null>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Shared Registration fields
  const [fullName, setFullName] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('+258 84 ');
  const [password, setPassword] = useState('');
  const [city, setCity] = useState('Maputo');
  const [neighborhood, setNeighborhood] = useState('Polana Cimento');
  const [address, setAddress] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [bio, setBio] = useState('');

  // Verification code state
  const [verificationCode, setVerificationCode] = useState('');
  const [codeSentPreview, setCodeSentPreview] = useState<string | null>(null);
  const [codeVerified, setCodeVerified] = useState(false);

  // Provider initial service optional fields
  const [includeInitialService, setIncludeInitialService] = useState(true);
  const [svcTitle, setSvcTitle] = useState('');
  const [svcCategoryId, setSvcCategoryId] = useState(categories[0]?.id || 'cat-hair-barber');
  const [svcDescription, setSvcDescription] = useState('');
  const [svcPricingModel, setSvcPricingModel] = useState<PricingModel>('fixed');
  const [svcPriceMzn, setSvcPriceMzn] = useState('1500');
  const [svcDuration, setSvcDuration] = useState('60');
  const [svcTransportFee, setSvcTransportFee] = useState('250');
  const [svcFreeRadius, setSvcFreeRadius] = useState('3');
  const [svcExtraKm, setSvcExtraKm] = useState('50');
  const [svcLocationMode, setSvcLocationMode] = useState<ServiceLocationMode>('both');

  // Post-Google Onboarding state
  const [googleRoleChoice, setGoogleRoleChoice] = useState<'customer' | 'provider'>('customer');
  const [googlePhone, setGooglePhone] = useState('+258 84 ');
  const [googleCity, setGoogleCity] = useState('Maputo');
  const [googleNeighborhood, setGoogleNeighborhood] = useState('Polana Cimento');
  const [googleBusinessName, setGoogleBusinessName] = useState('');
  const [googleBio, setGoogleBio] = useState('');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  React.useEffect(() => {
    setTab(authModalInitialMode);
    setErrorMsg(null);
  }, [authModalInitialMode, authModalOpen]);

  const availableNeighborhoods = useMemo(() => {
    const found = MOZAMBIQUE_CITIES.find((c) => c.name === city) || MOZAMBIQUE_CITIES[0];
    return found.neighborhoods;
  }, [city]);

  const googleNeighborhoods = useMemo(() => {
    const found = MOZAMBIQUE_CITIES.find((c) => c.name === googleCity) || MOZAMBIQUE_CITIES[0];
    return found.neighborhoods;
  }, [googleCity]);

  const handleCityChange = (nextCity: string) => {
    setCity(nextCity);
    const found = MOZAMBIQUE_CITIES.find((c) => c.name === nextCity);
    if (found && found.neighborhoods.length > 0) {
      setNeighborhood(found.neighborhoods[0].name);
    }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setErrorMsg(null);
      const compressed = await compressImageFileToDataUrl(file, 500, 0.8);
      setAvatarUrl(compressed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao carregar imagem.');
    }
  };

  const handleSendCode = async () => {
    const identifier = email.trim() || phone.trim();
    if (!identifier) {
      setErrorMsg('Preencha primeiro o email ou número +258.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const res = await sendVerificationCode(identifier);
      if (res.verificationCodePreview) {
        setCodeSentPreview(res.verificationCodePreview);
        setVerificationCode(res.verificationCodePreview);
      }
      setCodeVerified(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Falha ao enviar código.');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmCode = async () => {
    const identifier = email.trim() || phone.trim();
    if (!identifier || !verificationCode.trim()) {
      setErrorMsg('Insira o código de 6 dígitos recebido.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      await verifyCode(identifier, verificationCode.trim());
      setCodeVerified(true);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Código incorrecto.');
    } finally {
      setBusy(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      await loginWithPassword(loginEmail, loginPassword);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao iniciar sessão.');
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountType) {
      setErrorMsg('Seleccione primeiro o tipo de conta: Cliente ou Prestador de Serviços.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    try {
      const payload: Record<string, unknown> = {
        accountType,
        fullName,
        businessName: accountType === 'provider' ? businessName || fullName : undefined,
        email,
        phone,
        password,
        city,
        neighborhood,
        address,
        avatarUrl: avatarUrl || (accountType === 'provider' ? APP_MEDIA.hair : APP_MEDIA.hero),
        bio: accountType === 'provider' ? bio : undefined,
        verificationCode: verificationCode.trim(),
      };

      if (accountType === 'provider' && includeInitialService && svcTitle.trim()) {
        payload.initialService = {
          title: svcTitle.trim(),
          categoryId: svcCategoryId,
          description: svcDescription.trim(),
          durationMinutes: Number(svcDuration) || 60,
          pricingModel: svcPricingModel,
          basePriceMzn: Number(svcPriceMzn) || 0,
          transportFeeMzn: Number(svcTransportFee) || 0,
          freeTransportRadiusKm: Number(svcFreeRadius) || 0,
          extraKmRateMzn: Number(svcExtraKm) || 0,
          serviceLocationMode: svcLocationMode,
          imageUrl: APP_MEDIA.hair,
        };
      }

      await registerAccount(payload);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Não foi possível concluir o registo.');
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleOnboardingSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    try {
      await updateAccountProfile({
        phone: googlePhone,
        city: googleCity,
        neighborhood: googleNeighborhood,
      });
      if (googleRoleChoice === 'provider') {
        await switchOrConfigureRole({
          enableProviderRole: true,
          targetMode: 'provider',
          businessName: googleBusinessName || currentUser?.fullName,
          bio: googleBio,
          city: googleCity,
          neighborhood: googleNeighborhood,
          phone: googlePhone,
        });
      }
      setNeedsGoogleOnboarding(false);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erro ao concluir perfil.');
    } finally {
      setBusy(false);
    }
  };

  // Post-Google Onboarding Dialog
  if (needsGoogleOnboarding && currentUser) {
    return (
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="google-onboarding-title"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
      >
        <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-xl">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2
                id="google-onboarding-title"
                className="font-display text-xl font-bold text-[#141815]"
              >
                Complete o seu perfil na Kanimambo
              </h2>
              <p className="mt-1 text-sm text-[#4A524D]">
                Escolha como deseja utilizar a plataforma e confirme o seu contacto em Moçambique.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setNeedsGoogleOnboarding(false)}
              aria-label="Fechar janela"
              className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {errorMsg && (
            <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleGoogleOnboardingSubmit} className="mt-5 space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setGoogleRoleChoice('customer')}
                className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-colors ${
                  googleRoleChoice === 'customer'
                    ? 'border-[#14533D] bg-emerald-50/70'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <User className="h-5 w-5 text-[#14533D]" />
                <span className="mt-2 font-display text-sm font-bold text-[#141815]">
                  Sou Cliente
                </span>
                <span className="mt-0.5 text-xs text-[#4A524D]">
                  Quero descobrir e contratar prestadores.
                </span>
              </button>

              <button
                type="button"
                onClick={() => setGoogleRoleChoice('provider')}
                className={`flex flex-col items-start rounded-xl border p-3.5 text-left transition-colors ${
                  googleRoleChoice === 'provider'
                    ? 'border-[#14533D] bg-emerald-50/70'
                    : 'border-zinc-200 hover:border-zinc-300'
                }`}
              >
                <Briefcase className="h-5 w-5 text-[#14533D]" />
                <span className="mt-2 font-display text-sm font-bold text-[#141815]">
                  Sou Prestador
                </span>
                <span className="mt-0.5 text-xs text-[#4A524D]">
                  Quero divulgar serviços e receber pedidos.
                </span>
              </button>
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#141815]">
                Telefone (+258)
              </label>
              <input
                type="tel"
                required
                value={googlePhone}
                onChange={(e) => setGooglePhone(e.target.value)}
                placeholder="+258 84 123 4567"
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-[#141815]">Cidade</label>
                <select
                  value={googleCity}
                  onChange={(e) => {
                    const nextC = e.target.value;
                    setGoogleCity(nextC);
                    const found = MOZAMBIQUE_CITIES.find((c) => c.name === nextC);
                    if (found?.neighborhoods[0]) setGoogleNeighborhood(found.neighborhoods[0].name);
                  }}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                >
                  {MOZAMBIQUE_CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-[#141815]">Bairro</label>
                <select
                  value={googleNeighborhood}
                  onChange={(e) => setGoogleNeighborhood(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                >
                  {googleNeighborhoods.map((nb) => (
                    <option key={nb.name} value={nb.name}>
                      {nb.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {googleRoleChoice === 'provider' && (
              <>
                <div>
                  <label className="block text-xs font-semibold text-[#141815]">
                    Nome Profissional ou Salão / Empresa
                  </label>
                  <input
                    type="text"
                    value={googleBusinessName}
                    onChange={(e) => setGoogleBusinessName(e.target.value)}
                    placeholder="Ex: Estúdio Beleza Polana"
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[#141815]">
                    Descrição Profissional (mínimo 10 caracteres)
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={googleBio}
                    onChange={(e) => setGoogleBio(e.target.value)}
                    placeholder="Descreva a sua experiência, especialidades e zonas de atendimento..."
                    className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-lg bg-[#14533D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0E3D2D] disabled:opacity-60"
            >
              {busy ? 'A guardar...' : 'Concluir Configuração'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  if (!authModalOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
    >
      <div className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-200 bg-white p-6 shadow-2xl sm:p-8">
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 pb-4">
          <div>
            <h2 id="auth-modal-title" className="font-display text-2xl font-bold text-[#141815]">
              {tab === 'login' ? 'Entrar na Kanimambo' : 'Criar Conta na Kanimambo'}
            </h2>
            <p className="mt-1 text-sm text-[#4A524D]">
              Conectamos clientes e profissionais verificados em todo Moçambique.
            </p>
          </div>
          <button
            type="button"
            onClick={closeAuthModal}
            aria-label="Fechar janela de autenticação"
            className="rounded-lg p-1.5 text-zinc-500 hover:bg-zinc-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Mode Tabs */}
        <div className="mt-5 grid grid-cols-2 rounded-xl bg-[#F3F1EC] p-1">
          <button
            type="button"
            onClick={() => {
              setTab('login');
              setErrorMsg(null);
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === 'login' ? 'bg-white text-[#141815] shadow-xs' : 'text-[#4A524D]'
            }`}
          >
            Iniciar Sessão
          </button>
          <button
            type="button"
            onClick={() => {
              setTab('register');
              setErrorMsg(null);
            }}
            className={`rounded-lg py-2 text-sm font-semibold transition-colors ${
              tab === 'register' ? 'bg-white text-[#141815] shadow-xs' : 'text-[#4A524D]'
            }`}
          >
            Criar Conta
          </button>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-800"
          >
            {errorMsg}
          </div>
        )}

        {tab === 'login' ? (
          <div className="mt-5 space-y-5">
            <form onSubmit={handleLoginSubmit} className="space-y-4">
              <div>
                <label htmlFor="login-email" className="block text-xs font-semibold text-[#141815]">
                  Endereço de Email
                </label>
                <div className="relative mt-1">
                  <Mail className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    id="login-email"
                    type="email"
                    required
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    placeholder="exemplo@kanimambo.co.mz"
                    className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-[#14533D] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label
                  htmlFor="login-password"
                  className="block text-xs font-semibold text-[#141815]"
                >
                  Palavra-passe
                </label>
                <div className="relative mt-1">
                  <KeyRound className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                  <input
                    id="login-password"
                    type="password"
                    required
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-[#14533D] focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full rounded-lg bg-[#14533D] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#0E3D2D] disabled:opacity-60"
              >
                {busy ? 'A autenticar...' : 'Entrar'}
              </button>
            </form>

            <div className="relative flex items-center py-1">
              <div className="grow border-t border-zinc-200" />
              <span className="mx-3 text-xs font-medium text-[#6E7771]">ou</span>
              <div className="grow border-t border-zinc-200" />
            </div>

            <button
              type="button"
              onClick={async () => {
                setBusy(true);
                setErrorMsg(null);
                try {
                  await loginWithGoogle();
                } catch (err) {
                  setErrorMsg(
                    err instanceof Error ? err.message : 'Falha na autenticação com Google.'
                  );
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2.5 text-sm font-semibold text-[#141815] hover:bg-zinc-50"
            >
              <span>Continuar com Google</span>
            </button>

            {/* Quick Demo Accounts for Evaluation */}
            <div className="rounded-xl border border-zinc-200 bg-[#FAF9F6] p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6E7771]">
                Acesso Rápido de Demonstração (Maputo)
              </p>
              <div className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => loginAsDemo('customer')}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-[#141815] hover:border-[#14533D] hover:text-[#14533D]"
                >
                  Cliente Demo
                </button>
                <button
                  type="button"
                  onClick={() => loginAsDemo('provider')}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-[#141815] hover:border-[#14533D] hover:text-[#14533D]"
                >
                  Prestador Demo
                </button>
                <button
                  type="button"
                  onClick={() => loginAsDemo('admin')}
                  className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-xs font-semibold text-[#141815] hover:border-[#14533D] hover:text-[#14533D]"
                >
                  Admin Demo
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            {/* Step 1: Select Account Type Before Creating Account */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-[#6E7771]">
                Passo 1 · Seleccione o Tipo de Conta
              </p>
              <div className="mt-2.5 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => {
                    setAccountType('customer');
                    setErrorMsg(null);
                  }}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition-colors ${
                    accountType === 'customer'
                      ? 'border-[#14533D] bg-emerald-50/70 ring-1 ring-[#14533D]'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <User className="h-5 w-5 text-[#14533D]" />
                    <span className="font-mono text-xs text-[#6E7771]">Opção 1</span>
                  </div>
                  <span className="mt-2.5 font-display text-base font-bold text-[#141815]">
                    Sou Cliente
                  </span>
                  <span className="mt-1 text-xs text-[#4A524D]">
                    Quero descobrir e contratar prestadores de serviços.
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setAccountType('provider');
                    setErrorMsg(null);
                  }}
                  className={`flex flex-col items-start rounded-xl border p-4 text-left transition-colors ${
                    accountType === 'provider'
                      ? 'border-[#14533D] bg-emerald-50/70 ring-1 ring-[#14533D]'
                      : 'border-zinc-200 bg-white hover:border-zinc-300'
                  }`}
                >
                  <div className="flex w-full items-center justify-between">
                    <Briefcase className="h-5 w-5 text-[#14533D]" />
                    <span className="font-mono text-xs text-[#6E7771]">Opção 2</span>
                  </div>
                  <span className="mt-2.5 font-display text-base font-bold text-[#141815]">
                    Sou Prestador de Serviços
                  </span>
                  <span className="mt-1 text-xs text-[#4A524D]">
                    Quero divulgar os meus serviços e receber clientes.
                  </span>
                </button>
              </div>
            </div>

            {accountType && (
              <form onSubmit={handleRegisterSubmit} className="space-y-4 border-t border-zinc-200 pt-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-[#6E7771]">
                  Passo 2 · Dados de {accountType === 'provider' ? 'Prestador' : 'Cliente'}
                </p>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="reg-fullname"
                      className="block text-xs font-semibold text-[#141815]"
                    >
                      Nome Completo *
                    </label>
                    <input
                      id="reg-fullname"
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Ex: Amélia Macuácua"
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                    />
                  </div>

                  {accountType === 'provider' ? (
                    <div>
                      <label
                        htmlFor="reg-business"
                        className="block text-xs font-semibold text-[#141815]"
                      >
                        Nome Comercial ou Salão (opcional)
                      </label>
                      <input
                        id="reg-business"
                        type="text"
                        value={businessName}
                        onChange={(e) => setBusinessName(e.target.value)}
                        placeholder="Ex: Salão Brilho de Maputo"
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                      />
                    </div>
                  ) : (
                    <div>
                      <label
                        htmlFor="reg-avatar-upload"
                        className="block text-xs font-semibold text-[#141815]"
                      >
                        Fotografia de Perfil (opcional)
                      </label>
                      <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-[#4A524D] hover:border-[#14533D]">
                        <Upload className="h-4 w-4 text-[#14533D]" />
                        <span>{avatarUrl ? 'Imagem carregada' : 'Carregar fotografia'}</span>
                        <input
                          id="reg-avatar-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}
                </div>

                {accountType === 'provider' && (
                  <div>
                    <label className="block text-xs font-semibold text-[#141815]">
                      Logótipo ou Fotografia Profissional
                    </label>
                    <label className="mt-1 flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-zinc-300 px-3 py-2 text-xs font-medium text-[#4A524D] hover:border-[#14533D]">
                      <Upload className="h-4 w-4 text-[#14533D]" />
                      <span>
                        {avatarUrl ? 'Logótipo/foto carregado' : 'Seleccionar imagem do dispositivo'}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </label>
                  </div>
                )}

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="reg-email"
                      className="block text-xs font-semibold text-[#141815]"
                    >
                      Endereço de Email *
                    </label>
                    <input
                      id="reg-email"
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="nome@dominio.co.mz"
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="reg-phone"
                      className="block text-xs font-semibold text-[#141815]"
                    >
                      Número de Telefone (+258) *
                    </label>
                    <div className="relative mt-1">
                      <Phone className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                      <input
                        id="reg-phone"
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+258 84 123 4567"
                        className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-[#14533D] focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  <div>
                    <label htmlFor="reg-city" className="block text-xs font-semibold text-[#141815]">
                      Cidade *
                    </label>
                    <select
                      id="reg-city"
                      value={city}
                      onChange={(e) => handleCityChange(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                    >
                      {MOZAMBIQUE_CITIES.map((c) => (
                        <option key={c.name} value={c.name}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-neighborhood"
                      className="block text-xs font-semibold text-[#141815]"
                    >
                      Bairro *
                    </label>
                    <select
                      id="reg-neighborhood"
                      value={neighborhood}
                      onChange={(e) => setNeighborhood(e.target.value)}
                      className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                    >
                      {availableNeighborhoods.map((nb) => (
                        <option key={nb.name} value={nb.name}>
                          {nb.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-xs font-semibold text-[#141815]"
                    >
                      Palavra-passe *
                    </label>
                    <input
                      id="reg-password"
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="reg-address"
                    className="block text-xs font-semibold text-[#141815]"
                  >
                    Endereço / Avenida (opcional)
                  </label>
                  <div className="relative mt-1">
                    <MapPin className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                    <input
                      id="reg-address"
                      type="text"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="Ex: Av. Julius Nyerere, nº 420"
                      className="w-full rounded-lg border border-zinc-300 py-2 pl-9 pr-3 text-sm focus:border-[#14533D] focus:outline-none"
                    />
                  </div>
                </div>

                {accountType === 'provider' && (
                  <>
                    <div>
                      <label
                        htmlFor="reg-bio"
                        className="block text-xs font-semibold text-[#141815]"
                      >
                        Descrição Profissional *
                      </label>
                      <textarea
                        id="reg-bio"
                        rows={3}
                        required
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Descreva a sua experiência, especialidades e áreas de actuação em Moçambique..."
                        className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-[#14533D] focus:outline-none"
                      />
                    </div>

                    {/* Initial Service Registration */}
                    <div className="rounded-xl border border-zinc-200 bg-[#FAF9F6] p-4">
                      <div className="flex items-center justify-between">
                        <span className="font-display text-sm font-bold text-[#141815]">
                          Primeiro Serviço Oferecido
                        </span>
                        <label className="flex items-center gap-2 text-xs font-medium text-[#4A524D]">
                          <input
                            type="checkbox"
                            checked={includeInitialService}
                            onChange={(e) => setIncludeInitialService(e.target.checked)}
                            className="rounded border-zinc-300 text-[#14533D]"
                          />
                          Publicar já no registo
                        </label>
                      </div>

                      {includeInitialService && (
                        <div className="mt-3 space-y-3">
                          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                            <div>
                              <label className="block text-xs font-semibold text-[#141815]">
                                Título do Serviço *
                              </label>
                              <input
                                type="text"
                                required={includeInitialService}
                                value={svcTitle}
                                onChange={(e) => setSvcTitle(e.target.value)}
                                placeholder="Ex: Tranças Box Braids"
                                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-semibold text-[#141815]">
                                Categoria
                              </label>
                              <select
                                value={svcCategoryId}
                                onChange={(e) => setSvcCategoryId(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                              >
                                {categories.map((cat) => (
                                  <option key={cat.id} value={cat.id}>
                                    {cat.namePt}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-semibold text-[#141815]">
                              Descrição do Serviço
                            </label>
                            <input
                              type="text"
                              value={svcDescription}
                              onChange={(e) => setSvcDescription(e.target.value)}
                              placeholder="O que está incluído no serviço..."
                              className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm"
                            />
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                            <div>
                              <label className="block text-xs font-semibold text-[#141815]">
                                Modelo de Preço
                              </label>
                              <select
                                value={svcPricingModel}
                                onChange={(e) => setSvcPricingModel(e.target.value as PricingModel)}
                                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs"
                              >
                                <option value="fixed">Preço fixo</option>
                                <option value="starting_from">A partir de</option>
                                <option value="consultation">Sob consulta</option>
                              </select>
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-[#141815]">
                                Preço Base (MT)
                              </label>
                              <input
                                type="number"
                                min={0}
                                disabled={svcPricingModel === 'consultation'}
                                value={svcPriceMzn}
                                onChange={(e) => setSvcPriceMzn(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs tabular-nums"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-[#141815]">
                                Duração (min)
                              </label>
                              <input
                                type="number"
                                min={15}
                                value={svcDuration}
                                onChange={(e) => setSvcDuration(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-2 text-xs tabular-nums"
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                            <div>
                              <label className="block text-[11px] font-semibold text-[#141815]">
                                Taxa Deslocação (MT)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={svcTransportFee}
                                onChange={(e) => setSvcTransportFee(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-[#141815]">
                                Raio Grátis (km)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={svcFreeRadius}
                                onChange={(e) => setSvcFreeRadius(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-[#141815]">
                                Extra por km (MT)
                              </label>
                              <input
                                type="number"
                                min={0}
                                value={svcExtraKm}
                                onChange={(e) => setSvcExtraKm(e.target.value)}
                                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-xs tabular-nums"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-semibold text-[#141815]">
                                Local Atendimento
                              </label>
                              <select
                                value={svcLocationMode}
                                onChange={(e) =>
                                  setSvcLocationMode(e.target.value as ServiceLocationMode)
                                }
                                className="mt-1 w-full rounded-lg border border-zinc-300 bg-white px-2 py-1.5 text-xs"
                              >
                                <option value="both">Ambos</option>
                                <option value="provider_location">No meu local</option>
                                <option value="customer_location">Ao domicílio</option>
                              </select>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}

                {/* Account Verification Step */}
                <div className="rounded-xl border border-zinc-200 bg-[#F3F1EC] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Shield className="h-4 w-4 text-[#14533D]" />
                      <span className="text-xs font-bold text-[#141815]">
                        Verificação de Conta (Código de 6 Dígitos) *
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={handleSendCode}
                      disabled={busy}
                      className="rounded-lg border border-[#14533D] bg-white px-3 py-1.5 text-xs font-semibold text-[#14533D] hover:bg-emerald-50"
                    >
                      Enviar Código
                    </button>
                  </div>

                  {codeSentPreview && (
                    <p className="mt-2 font-mono text-xs text-[#14533D]">
                      Código de verificação enviado: <strong>{codeSentPreview}</strong>
                    </p>
                  )}

                  <div className="mt-2.5 flex items-center gap-2">
                    <input
                      type="text"
                      required
                      maxLength={6}
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      placeholder="Código de 6 dígitos"
                      aria-label="Código de verificação de 6 dígitos"
                      className="w-44 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 font-mono text-sm tabular-nums focus:border-[#14533D] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={handleConfirmCode}
                      disabled={busy}
                      className="rounded-lg bg-zinc-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-zinc-800"
                    >
                      Validar Código
                    </button>
                    {codeVerified && (
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800">
                        <CheckCircle2 className="h-4 w-4" />
                        Verificado
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full rounded-lg bg-[#14533D] px-4 py-3 text-sm font-semibold text-white hover:bg-[#0E3D2D] disabled:opacity-60"
                >
                  {busy
                    ? 'A criar conta...'
                    : accountType === 'provider'
                    ? 'Concluir Registo de Prestador'
                    : 'Concluir Registo de Cliente'}
                </button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
