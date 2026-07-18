import { createFileRoute, Link } from "@tanstack/react-router";
import { SiteNav } from "@/components/SiteNav";
import { Disclaimer } from "@/components/Disclaimer";
import { Reveal } from "@/components/Reveal";
import heroImg from "@/assets/hero-family.jpg";
import a1 from "@/assets/avatar-1.jpg";
import a4 from "@/assets/avatar-4.jpg";
import a5 from "@/assets/avatar-5.jpg";
import a7 from "@/assets/avatar-7.jpg";
import a8 from "@/assets/avatar-8.jpg";

export const Route = createFileRoute("/")({
  component: Landing,
});

const principles = [
  { text: "Invite-only — never browsable, never public", emoji: "🔒" },
  { text: "Payout order drawn once, on-chain, unchangeable", emoji: "🎲" },
  { text: "Every contribution and payout is a real transaction", emoji: "⛓️" },
  { text: "Optional collateral protects the people still waiting their turn", emoji: "🛡️" },
  { text: "Built for family and close friends, not strangers", emoji: "🤝" },
  { text: "No spreadsheets, no screenshots, no chasing anyone", emoji: "📵" },
];

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <SiteNav />

      {/* Hero */}
      <section className="relative px-4 pt-8 pb-20 sm:px-5 sm:pt-10 sm:pb-24 md:pt-20 md:pb-32">
        {/* Warm ambient blobs */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
          <div
            className="absolute -top-24 -left-24 size-[420px] rounded-full blur-3xl opacity-60 animate-drift"
            style={{ background: "radial-gradient(circle, var(--clay) 0%, transparent 65%)", opacity: 0.25 }}
          />
          <div
            className="absolute top-40 -right-32 size-[500px] rounded-full blur-3xl animate-drift-slow"
            style={{ background: "radial-gradient(circle, var(--moss) 0%, transparent 65%)", opacity: 0.22 }}
          />
          <div
            className="absolute bottom-0 left-1/3 size-[360px] rounded-full blur-3xl animate-drift"
            style={{ background: "radial-gradient(circle, #E8C77E 0%, transparent 65%)", opacity: 0.25, animationDelay: "-4s" }}
          />
        </div>

        <div className="relative max-w-3xl mx-auto text-center">
          <Reveal>
            <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-surface/80 backdrop-blur border border-foreground/10 text-xs font-medium text-foreground/70 mb-3">
              <span className="size-1.5 rounded-full bg-accent animate-soft-pulse" />
              Onchain savings circles · Ajo · Esusu · ROSCA
            </span>
          </Reveal>
          <Reveal delay={40}>
            <div className="mb-6">
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-clay/10 border border-clay/30 text-xs font-medium text-foreground/70">
                🧪 Monad testnet only — mainnet support is coming soon
              </span>
            </div>
          </Reveal>
          <Reveal delay={80}>
            <h1 className="font-display text-4xl sm:text-5xl md:text-7xl leading-[1.05] tracking-tight text-balance mb-6">
              Save together with{" "}
              <span className="relative inline-block">
                <em className="italic relative z-10">people you trust.</em>
                <span
                  aria-hidden
                  className="absolute left-0 right-0 bottom-1 h-3 md:h-4 -z-0 origin-left animate-underline-draw"
                  style={{
                    background: "color-mix(in oklab, var(--clay) 30%, transparent)",
                    borderRadius: 999,
                  }}
                />
              </span>
            </h1>
          </Reveal>
          <Reveal delay={160}>
            <p className="text-base sm:text-lg text-foreground/60 max-w-lg mx-auto text-pretty mb-8">
              A warm, transparent way to run traditional savings circles with your family and
              closest friends. No jargon, no strangers — just people you know.
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="flex flex-wrap items-center justify-center gap-3 mb-14">
              <Link
                to="/create"
                className="group w-full sm:w-auto px-6 py-3 rounded-full bg-foreground text-background font-medium shadow-lg shadow-foreground/10 hover:bg-foreground/90 hover:shadow-xl hover:-translate-y-0.5 transition-all"
              >
                Start a circle
                <span className="inline-block ml-2 transition-transform group-hover:translate-x-1">→</span>
              </Link>
              <a
                href="#how"
                className="w-full sm:w-auto px-6 py-3 rounded-full border border-foreground/15 font-medium hover:bg-surface transition text-center"
              >
                How it works
              </a>
            </div>
          </Reveal>

          <Reveal delay={320}>
            <div className="relative">
              {/* Orbit rings */}
              <div aria-hidden className="pointer-events-none absolute -inset-8 md:-inset-16 hidden sm:block">
                <div className="absolute inset-0 rounded-full border border-dashed border-foreground/10 animate-orbit" />
                <div className="absolute inset-8 rounded-full border border-dashed border-foreground/[0.07] animate-orbit-reverse" />
              </div>

              <img
                src={heroImg}
                alt="Family and friends gathered around a warm table"
                width={1600}
                height={900}
                className="relative w-full aspect-[16/9] object-cover rounded-[2rem] shadow-xl shadow-foreground/10"
              />

              {/* Floating stat chips */}
              <div className="hidden sm:flex absolute -top-4 -left-2 md:-left-8 items-center gap-2 px-3 py-2 bg-surface rounded-2xl shadow-lg border border-foreground/5 animate-float-y">
                <div className="size-8 rounded-xl bg-moss/15 grid place-items-center text-moss text-lg">
                  ✓
                </div>
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-widest text-foreground/50">Payout order</div>
                  <div className="text-sm font-semibold">Drawn on-chain, once</div>
                </div>
              </div>

              <div className="hidden sm:flex absolute top-1/3 -right-3 md:-right-10 items-center gap-2 px-3 py-2 bg-surface rounded-2xl shadow-lg border border-foreground/5 animate-float-y-lg" style={{ animationDelay: "-2s" }}>
                <div className="size-8 rounded-xl bg-accent/15 grid place-items-center text-accent text-lg">
                  ◎
                </div>
                <div className="text-left">
                  <div className="text-[10px] uppercase tracking-widest text-foreground/50">Invites</div>
                  <div className="text-sm font-semibold">Private, code-only</div>
                </div>
              </div>

              {/* Avatar cluster */}
              <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 bg-surface rounded-full shadow-xl shadow-foreground/10 border border-foreground/5 whitespace-nowrap">
                <div className="flex -space-x-2 shrink-0">
                  {[a1, a2, a3, a6, a7].map((src, i) => (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      width={40}
                      height={40}
                      loading="lazy"
                      className="size-6 sm:size-7 rounded-full border-2 border-surface object-cover"
                      style={{ animation: "float-y 4s ease-in-out infinite", animationDelay: `${i * -0.4}s` }}
                    />
                  ))}
                </div>
                <span className="text-[11px] sm:text-xs font-medium text-foreground/70">
                  Built for <span className="text-foreground font-semibold">people you know</span>
                </span>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Live activity ticker */}
      <section aria-label="How Ajoo protects your circle" className="relative border-y border-foreground/5 bg-surface/60 py-4 overflow-hidden">
        <div className="flex gap-10 whitespace-nowrap animate-marquee" style={{ width: "max-content" }}>
          {[...principles, ...principles, ...principles].map((it, i) => (
            <span key={i} className="inline-flex items-center gap-2 text-sm text-foreground/70">
              <span className="text-base" aria-hidden>{it.emoji}</span>
              <span className="font-medium text-foreground">{it.text}</span>
              <span className="mx-4 size-1 rounded-full bg-foreground/20 inline-block" aria-hidden />
            </span>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="px-4 py-16 sm:px-5 sm:py-20 bg-surface">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <div className="max-w-xl mb-14">
              <p className="text-xs uppercase tracking-[0.2em] text-accent font-semibold mb-3">
                How a circle works
              </p>
              <h2 className="font-display text-4xl md:text-5xl leading-tight">
                Three quiet steps. Everyone gets a turn.
              </h2>
            </div>
          </Reveal>
          <div className="grid md:grid-cols-3 gap-10 md:gap-6">
            {[
              {
                n: "1",
                title: "Create a group",
                body:
                  "Set the amount, how many people, and whether you contribute daily, weekly, or monthly.",
              },
              {
                n: "2",
                title: "Invite your circle",
                body:
                  "Share a private link with family and close friends. Everyone joins, no strangers.",
              },
              {
                n: "3",
                title: "Contribute & receive",
                body:
                  "Each round, everyone pays in. One member takes home the full pot — until it's everyone's turn.",
              },
            ].map((s, i) => (
              <Reveal key={s.n} delay={i * 120}>
                <div className="space-y-4 group">
                  <div className="relative size-14 rounded-full bg-accent/10 text-accent font-display text-3xl grid place-items-center transition-transform duration-500 group-hover:rotate-[10deg] group-hover:scale-110">
                    {s.n}
                    <span className="absolute inset-0 rounded-full border border-accent/20 animate-soft-pulse" />
                  </div>
                  <h3 className="text-xl font-semibold">{s.title}</h3>
                  <p className="text-foreground/60 leading-relaxed">{s.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-20">
        <div className="max-w-5xl mx-auto">
          <Reveal>
            <h2 className="font-display text-4xl md:text-5xl mb-8 max-w-xl">
              Built for trusted circles, not public speculation.
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <div className="rounded-[2rem] border border-foreground/10 bg-surface p-8 text-foreground/70 leading-relaxed">
              Ajoo keeps the flow private, transparent, and onchain so each member can see the rules, the contribution schedule, and the payout order without relying on a spreadsheet or a side chat.
            </div>
          </Reveal>
        </div>
      </section>

      {/* CTA */}
      <section className="px-4 py-16 sm:px-5 sm:py-20">
        <Reveal>
          <div className="relative max-w-4xl mx-auto rounded-[2.5rem] bg-foreground text-background p-8 sm:p-10 md:p-16 text-center overflow-hidden">
            {/* Ambient blob inside dark card */}
            <div
              aria-hidden
              className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full blur-3xl animate-drift"
              style={{ background: "var(--clay)", opacity: 0.35 }}
            />
            <div
              aria-hidden
              className="pointer-events-none absolute -bottom-24 -left-16 size-72 rounded-full blur-3xl animate-drift-slow"
              style={{ background: "#E8C77E", opacity: 0.2 }}
            />

            {/* Orbiting avatars */}
            <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 size-[520px] animate-orbit">
                {[a1, a4, a5, a8].map((src, i) => {
                  const angle = (i / 4) * 2 * Math.PI;
                  const r = 240;
                  return (
                    <img
                      key={i}
                      src={src}
                      alt=""
                      width={44}
                      height={44}
                      className="absolute size-11 rounded-full border-2 border-background/20 object-cover opacity-70"
                      style={{
                        left: `calc(50% + ${Math.cos(angle) * r}px)`,
                        top: `calc(50% + ${Math.sin(angle) * r}px)`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  );
                })}
              </div>
            </div>

            <h2 className="relative font-display text-3xl sm:text-4xl md:text-6xl leading-tight mb-4">
              Ready to pass the basket?
            </h2>
            <p className="relative text-background/70 max-w-md mx-auto mb-8">
              Start your first circle in minutes. Invite the people you love. Save with intention.
            </p>
            <Link
              to="/create"
              className="relative inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-accent text-accent-foreground font-medium hover:brightness-105 hover:-translate-y-0.5 transition-all shadow-lg shadow-accent/30"
            >
              Create your first circle
              <span aria-hidden>→</span>
            </Link>
          </div>
        </Reveal>
      </section>

      {/* Disclaimer + footer */}
      <section className="px-4 pb-14 sm:px-5">
        <div className="max-w-2xl mx-auto">
          <Disclaimer />
        </div>
      </section>

      <footer className="px-4 pb-10 border-t border-foreground/5 pt-8 sm:px-5">
        <div className="max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs text-foreground/50">
          <span className="font-display italic text-lg text-foreground/70">Ajoo</span>
          <div className="flex gap-6">
            <span>Privacy</span>
            <span>Terms</span>
            <span>Security</span>
          </div>
          <span>© 2026 Ajoo</span>
        </div>
      </footer>
    </div>
  );
}
