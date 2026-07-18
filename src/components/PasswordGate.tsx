import { useEffect, useState, type ReactNode } from "react";
import { Lock, LogOut } from "lucide-react";
import { supabase } from "../lib/supabase";

interface Props { children: ReactNode; }

export default function PasswordGate({ children }: Props) {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(Boolean(data.session));
      setReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(Boolean(session));
      setReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError("");
    const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    if (authError) setError("登录失败，请检查邮箱和密码");
    setSubmitting(false);
  };

  if (!ready) return <div className="min-h-screen grid place-items-center text-gray-400">正在检查登录状态…</div>;

  if (authed) {
    return <>{children}<button type="button" onClick={() => supabase.auth.signOut()} aria-label="退出登录" className="fixed right-3 top-3 z-40 rounded-full bg-white/15 p-2 text-white"><LogOut size={16} /></button></>;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 px-4">
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <div className="flex flex-col items-center mb-6">
          <div className="w-14 h-14 rounded-full bg-primary-600 text-white flex items-center justify-center mb-3"><Lock size={26} /></div>
          <h1 className="text-xl font-bold text-gray-800">下单助手</h1>
          <p className="text-xs text-gray-400 mt-1">使用管理员创建的账号登录</p>
        </div>
        <label className="text-xs text-gray-500 mb-1 block">邮箱</label>
        <input type="email" autoComplete="username" value={email} onChange={e => { setEmail(e.target.value); setError(""); }} className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3" />
        <label className="text-xs text-gray-500 mb-1 block">密码</label>
        <input type="password" autoComplete="current-password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} className="w-full border border-gray-300 rounded-xl px-4 py-3 mb-3" />
        {error && <p className="text-sm text-red-500 mb-3 text-center">{error}</p>}
        <button type="submit" disabled={!email.trim() || !password || submitting} className="w-full py-3 rounded-xl text-white font-bold bg-primary-600 disabled:bg-gray-300">{submitting ? "登录中…" : "登录"}</button>
      </form>
    </div>
  );
}
