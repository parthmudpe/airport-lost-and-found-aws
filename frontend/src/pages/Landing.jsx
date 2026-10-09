import { Link } from 'react-router-dom';

export default function Landing() {
  return (
    <div className="min-h-screen bg-runway-950 text-mist-50">
      <header className="max-w-5xl mx-auto px-6 py-6 flex items-center justify-between">
        <p className="font-display text-xl font-bold">Skyway Lost &amp; Found</p>
        <div className="flex gap-3">
          <Link to="/login" className="btn-ghost text-mist-50 hover:bg-white/10">Log in</Link>
          <Link to="/register" className="btn-primary">Get started</Link>
        </div>
      </header>

      <section className="max-w-5xl mx-auto px-6 pt-16 pb-24">
        <p className="text-signal-500 font-semibold text-sm mb-3">Airport lost property, handled properly</p>
        <h1 className="font-display text-4xl sm:text-5xl font-bold leading-tight max-w-2xl">
          Left something at the gate? We'll help you get it back.
        </h1>
        <p className="mt-5 text-mist-100/80 max-w-xl text-lg">
          Report a lost item in minutes, track it as staff search for a match, and prove it's
          yours before it's returned. Airport teams use the same system to log found items,
          review matches, and close the loop.
        </p>
        <div className="mt-8 flex gap-3">
          <Link to="/register" className="btn-primary text-base px-6 py-3">Report a lost item</Link>
          <Link to="/login" className="btn-secondary bg-transparent text-mist-50 border-white/20 hover:bg-white/10 text-base px-6 py-3">
            Staff sign in
          </Link>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-6 pb-24 grid sm:grid-cols-3 gap-6">
        {[
          { title: 'Report', body: 'Describe the item, where you lost it, and add a photo. You get a tracking number instantly.' },
          { title: 'Match', body: 'Our matching engine compares your report against everything found, and flags likely matches for staff to review.' },
          { title: 'Verify & collect', body: 'Staff confirm ownership with you before anything is released — never by similarity score alone.' },
        ].map((s) => (
          <div key={s.title} className="border border-white/10 rounded-lg p-5">
            <p className="font-display font-semibold text-lg mb-2">{s.title}</p>
            <p className="text-sm text-mist-100/70">{s.body}</p>
          </div>
        ))}
      </section>
    </div>
  );
}
