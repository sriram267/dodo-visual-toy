import React from "react";

/**
 * Editorial Content: "Tusky: the dynamic island that eats what you copy"
 * Dodo Payments design engineer assignment submission.
 */
export const EditorialEssay: React.FC = () => {
  return (
    <article className="editorial-essay-container">
      {/* ── Editorial Masthead ── */}
      <header className="essay-masthead">
        <h1 className="essay-headline">
          Tusky: the dynamic island that eats what you copy
        </h1>

        <p className="essay-byline">
          A tiny visual toy for the Dodo Payments design engineer assignment.
        </p>
      </header>

      {/* ── Essay Body Paragraphs ── */}
      <div className="essay-prose">
        <h2 className="essay-section-heading">Meet Tusky</h2>
        <p className="essay-lead">
          Tusky is an elephant who lives in the dynamic island at the top of this page. Select any text here and he lowers his trunk and waits. Press <kbd className="essay-kbd">Command + C</kbd> / <kbd className="essay-kbd">Ctrl + C</kbd> and he sucks the words in as one funnel. Press <kbd className="essay-kbd">Command + V</kbd> / <kbd className="essay-kbd">Ctrl + V</kbd> and he sneezes them back out, landing exactly where they came from.
        </p>

        <h2 className="essay-section-heading">How it started</h2>
        <p>
          I've always been fascinated by the iPhone's dynamic island. While looking for open source projects like it, I found <a href="https://github.com/Louis-CFM/coucou" target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:text-indigo-800 underline underline-offset-2">Coucou</a>, a companion that lives in the Mac notch. It's a macOS app, not something you can open in a browser, so I kept the feeling of a small living thing that reacts to you and rebuilt it for the web.
        </p>
        <p>
          When I browse, I mostly click links, take screenshots, and copy text. Links are just navigation, and screenshots are out of a browser's reach. Copying was the one that was both fun and doable in the time. A page can't see what you copy elsewhere, so Tusky only reacts to text copied here.
        </p>

        <h2 className="essay-section-heading">He has feelings</h2>
        <p>
          A mascot that only swallows is half a toy, so he sneezes it all back out. And he's not a pushover: poke him and he'll tell you off, keep poking and he gets properly annoyed, and if you really don't stop, he gets dizzy.
        </p>

        <h2 className="essay-section-heading">If I had more time</h2>
        <p>
          Touch-first on mobile: long-press selection already works, but the system copy menu sits right where Tusky's trunk wants to reach, and a 390px screen leaves him little room. I'd design a touch-first interaction, like pulling down on the island to sneeze, instead of squeezing the desktop version onto a phone.
        </p>
      </div>
    </article>
  );
};
