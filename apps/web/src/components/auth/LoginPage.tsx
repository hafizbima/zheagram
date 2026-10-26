import React, { FormEvent, useState } from 'react';
import { ArrowRight, Eye, EyeOff, LogIn, Mail, Shapes, UserPlus } from 'lucide-react';
import { api } from '../../services/api';

interface LoginPageProps {
  onAuthenticated: () => void;
}

export const LoginPage: React.FC<LoginPageProps> = ({ onAuthenticated }) => {
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (mode === 'signup' && !name.trim()) {
      setError('Please enter your name.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (mode === 'login') {
        await api.signIn(email.trim(), password);
        onAuthenticated();
      } else {
        const result = await api.signUp(email.trim(), password, name.trim());
        if (result.needsEmailConfirmation) {
          setMessage('Account created. Check your email to confirm your account, then sign in.');
          setMode('login');
          setPassword('');
        } else {
          onAuthenticated();
        }
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-blue-200/40 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-indigo-200/40 blur-3xl" />

      <section className="relative w-full max-w-5xl grid lg:grid-cols-[1.05fr_0.95fr] bg-white rounded-[2rem] border border-slate-200/80 shadow-2xl shadow-slate-300/30 overflow-hidden">
        <div className="hidden lg:flex bg-gradient-to-br from-slate-950 via-blue-950 to-indigo-800 p-12 text-white flex-col justify-between min-h-[620px]">
          <div>
            <div className="flex items-center gap-3 mb-16">
              <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                <Shapes className="w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight">Zheagram</span>
            </div>
            <p className="text-sm uppercase tracking-[0.24em] text-blue-200 font-semibold mb-5">Your visual workspace</p>
            <h1 className="text-5xl font-bold leading-[1.08] tracking-tight max-w-md">
              Turn ideas into clear, connected diagrams.
            </h1>
            <p className="mt-6 text-blue-100/80 leading-7 max-w-md">
              Create flowcharts, mind maps, canvases, and documents that stay available wherever you work.
            </p>
          </div>
          <div className="flex items-center gap-3 text-sm text-blue-100/70">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            Secure cloud workspace powered by Supabase
          </div>
        </div>

        <div className="p-7 sm:p-12 flex flex-col justify-center min-h-[620px]">
          <div className="lg:hidden flex items-center gap-3 mb-10">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-md">
              <Shapes className="w-6 h-6" />
            </div>
            <span className="text-xl font-bold text-slate-900">Zheagram</span>
          </div>

          <div className="mb-8">
            <p className="text-sm font-semibold text-blue-600 mb-2">Welcome back</p>
            <h2 className="text-3xl font-bold tracking-tight text-slate-900">
              {mode === 'login' ? 'Sign in to your workspace' : 'Create your workspace account'}
            </h2>
            <p className="text-sm text-slate-500 mt-3">
              {mode === 'login' ? 'Access your saved diagrams and documents.' : 'Save your diagrams securely in the cloud.'}
            </p>
          </div>

          <div className="flex p-1 bg-slate-100 rounded-xl mb-7">
            <button
              type="button"
              onClick={() => { setMode('login'); setError(''); setMessage(''); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
              className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
            >
              Create account
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <label className="block">
                <span className="block text-xs font-semibold text-slate-700 mb-2">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  autoComplete="name"
                  placeholder="Your name"
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-slate-50/70 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </label>
            )}

            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 mb-2">Email address</span>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  placeholder="you@example.com"
                  required
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 bg-slate-50/70 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                />
              </div>
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-slate-700 mb-2">Password</span>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  placeholder="At least 6 characters"
                  required
                  className="w-full pl-4 pr-11 py-3 rounded-xl border border-slate-200 bg-slate-50/70 text-sm outline-none focus:bg-white focus:border-blue-500 focus:ring-4 focus:ring-blue-100 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-slate-600"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            {error && <p className="text-sm text-red-600 bg-red-50 border border-red-100 rounded-xl px-3 py-2.5">{error}</p>}
            {message && <p className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-xl px-3 py-2.5">{message}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold shadow-lg shadow-blue-600/20 transition-all disabled:opacity-60 disabled:cursor-wait"
            >
              {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
              {!isSubmitting && <ArrowRight className="w-4 h-4 ml-auto" />}
            </button>
          </form>

          <p className="text-xs text-slate-400 text-center mt-7">
            By continuing, you agree to keep your workspace account secure.
          </p>
        </div>
      </section>
    </main>
  );
};
