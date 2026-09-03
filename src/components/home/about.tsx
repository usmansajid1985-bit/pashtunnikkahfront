export function About() {
  return (
    <section id="about" className="bg-sand border-y border-ink-900/5">
      <div className="max-w-6xl mx-auto px-5 sm:px-8 py-24 sm:py-32 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-4 reveal">
          <span className="text-rose-600 text-xs font-semibold uppercase tracking-widest">About Us</span>
          <h2 className="font-serif mt-3 text-3xl sm:text-4xl font-medium text-ink-950 tracking-tight">
            Why we built Pashtun Nikah
          </h2>
        </div>
        <div className="lg:col-span-7 lg:col-start-6 reveal">
          <p className="font-serif italic text-2xl sm:text-3xl text-ink-950 leading-snug">
            &ldquo;There was no dedicated, trustworthy matrimony platform built for the Pashtun community — existing
            platforms felt too generic, too casual.&rdquo;
          </p>
          <p className="mt-6 text-ink-700 text-sm sm:text-base leading-relaxed">
            We are a team of Pashtuns who understand the importance of Nikah, the role of family, and the need for a
            safe space where serious intentions are the only kind accepted.
          </p>
          <p className="mt-4 text-ink-950 text-sm sm:text-base leading-relaxed font-medium">
            Our mission: to help Pashtun Muslims find their spouse the right way — with dignity, privacy, and full
            family involvement.
          </p>
        </div>
      </div>
    </section>
  );
}
