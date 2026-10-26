import React, { FormEvent, useState } from 'react';
import { Eye, EyeOff, LogIn, Mail, Shapes, UserPlus } from 'lucide-react';
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
    <main className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 py-8 overflow-y-auto">
      <section className="w-full max-w-5xl grid lg:grid-cols-[1.05fr_0.95fr] bg-white rounded-3xl border border-slate-200/80 shadow-xl shadow-slate-300/20 overflow-hidden">
        <div className="hidden lg:flex bg-slate-950 p-12 text-white flex-col justify-between lg:min-h-[620px]">
          <div>
            <div className="flex items-center gap-3 mb-16">
              <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center">
                <Shapes className="w-6 h-6" />
              </div>
              <span className="text-xl font-bold tracking-tight">Zheagram</span>
            </div>
            <p className="text-sm font-semibold text-blue-300 mb-5">Diagram workspace</p>
            <h1 className="text-5xl font-bold leading-[1.08] tracking-tight max-w-md">
              Make the structure visible.
            </h1>
            <p className="mt-6 text-slate-300 leading-7 max-w-md">
              Build flowcharts, mind maps, and documents on one open canvas.
            </p>
          </div>
          <div className="text-sm text-slate-400">
            Your boards are saved to your workspace account.
          </div>
        </div>

        <div className="p-6 sm:p-12 flex flex-col justify-center lg:min-h-[620px]">
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
              aria-pressed={mode === 'login'}
              className={`flex-1 min-h-11 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${mode === 'login' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => { setMode('signup'); setError(''); setMessage(''); }}
              aria-pressed={mode === 'signup'}
              className={`flex-1 min-h-11 rounded-lg text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 ${mode === 'signup' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
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
                  className="w-full px-4 py-3 rounded-lg border border-slate-300 bg-slate-50/70 text-sm outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
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
                  className="w-full pl-11 pr-4 py-3 rounded-lg border border-slate-300 bg-slate-50/70 text-sm outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
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
                  className="w-full pl-4 pr-11 py-3 rounded-lg border border-slate-300 bg-slate-50/70 text-sm outline-none focus:bg-white focus:border-blue-600 focus:ring-4 focus:ring-blue-100 transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-w-11 min-h-11 flex items-center justify-center text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </label>

            {error && <p role="alert" className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">{error}</p>}
            {message && <p role="status" aria-live="polite" className="text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">{message}</p>}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full min-h-12 flex items-center justify-center gap-2 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-bold shadow-md shadow-blue-700/15 transition-all disabled:opacity-60 disabled:cursor-wait focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2"
            >
              {mode === 'login' ? <LogIn className="w-4 h-4" /> : <UserPlus className="w-4 h-4" />}
              {isSubmitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
};
