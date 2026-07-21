import { useEffect, useRef, useState } from "react";
import "../styles/home.css";

export default function Home({ onGetStarted }) {
  const videoSrc = "/hero-video.mp4";

  const [navScrolled, setNavScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  // ---- Navbar shrink + active-section scroll-spy + progress + back-to-top ----
  useEffect(() => {
    const sectionIds = ["features", "pricing", "faq", "contact"];

    function handleScroll() {
      setNavScrolled(window.scrollY > 40);
      setShowScrollTop(window.scrollY > 480);

      const docHeight = document.documentElement.scrollHeight - window.innerHeight;
      const progress = docHeight > 0 ? (window.scrollY / docHeight) * 100 : 0;
      setScrollProgress(progress);

      let current = "";
      for (const id of sectionIds) {
        const el = document.getElementById(id);
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.top <= 120 && rect.bottom >= 120) {
            current = id;
          }
        }
      }
      setActiveSection(current);
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ---- Lock body scroll when mobile menu is open ----
  useEffect(() => {
    document.body.style.overflow = mobileMenuOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // ---- Core smooth-scroll-to-id function (reliable, used everywhere) ----
  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // ---- Nav link click handler (Features / Pricing / FAQ / Contact — all use this) ----
  function handleNavClick(e, id) {
    e.preventDefault();
    scrollToSection(id);
    setMobileMenuOpen(false);
  }

  // ---- Logo click -> scroll to top ----
  function handleLogoClick() {
    window.scrollTo({ top: 0, behavior: "smooth" });
    setMobileMenuOpen(false);
  }

  // ---- Watch Explainer -> scroll to Features section ----
  function handleWatchExplainer() {
    scrollToSection("features");
  }

  // ---- Back to top button ----
  function handleScrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ---- Scroll-Reveal Logic ----
  const revealRefs = useRef([]);
  revealRefs.current = [];

  function addRevealRef(el) {
    if (el && !revealRefs.current.includes(el)) revealRefs.current.push(el);
  }

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    revealRefs.current.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  // ---- FAQ State & Data ----
  const [openFaq, setOpenFaq] = useState(null);
  const faqs = [
    {
      q: "How is this different from just using ChatGPT on my documents?",
      a: "ChatGPT reads one document at a time with no memory of how it connects to others. Industrial Nexus builds a knowledge graph across every document you upload — so it can tell you that Pump-104's vibration issue is related to the Boiler-3 incident from six months ago, something a plain chatbot has no way of knowing.",
    },
    {
      q: "Does Industrial Nexus handle proprietary blueprints and confidential reports?",
      a: "Yes. Every industry gets its own isolated workspace — your documents, knowledge graph, and chat history are never shared across accounts. Data stays scoped to your industry ID from upload to query.",
    },
    {
      q: "What file formats can I upload?",
      a: "PDF, DOCX, and TXT are supported today. Maintenance reports, inspection logs, safety procedures, and regulatory guidelines all work well — anything with structured or semi-structured text.",
    },
    {
      q: "Can it flag equipment that might need attention before something fails?",
      a: "Yes — the Risk Flagging feature scans the knowledge graph for equipment connected (within 2 hops) to a past incident, and the Cascading Risk Simulator shows what else would be affected if a given piece of equipment failed.",
    },
    {
      q: "Do I need to be technical to use this?",
      a: "No. If you can type a question in plain English, you can use it. Upload documents through drag-and-drop, then ask questions the same way you'd ask a colleague.",
    },
    {
      q: "Can I upload documents via email as well?",
      a: "Yes — each industry gets a unique email address. Simply forward a PDF report to that address, and it will be automatically extracted and added to the knowledge graph without needing manual chat uploads.",
    },
  ];

  return (
    <div className="home">
      <div className="home-frame-rail home-frame-rail-left" />
      <div className="home-frame-rail home-frame-rail-right" />

      {/* ===== Nav ===== */}
      <nav className={`home-nav ${navScrolled ? "scrolled" : ""}`}>
        <div className="home-scroll-progress" style={{ width: `${scrollProgress}%` }} />

        <button
          className="home-logo home-logo-btn"
          onClick={handleLogoClick}
          aria-label="Scroll to top"
        >
          <svg width="30" height="30" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="homeNavGradient" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FF6A1A" />
                <stop offset="100%" stopColor="#34C3D9" />
              </linearGradient>
            </defs>
            <line x1="16" y1="16" x2="6" y2="7" stroke="url(#homeNavGradient)" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="16" y1="16" x2="26" y2="7" stroke="url(#homeNavGradient)" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="16" y1="16" x2="6" y2="25" stroke="url(#homeNavGradient)" strokeWidth="1.6" strokeLinecap="round" />
            <line x1="16" y1="16" x2="26" y2="25" stroke="url(#homeNavGradient)" strokeWidth="1.6" strokeLinecap="round" />
            <circle cx="16" cy="16" r="5.5" fill="url(#homeNavGradient)" />
            <circle cx="6" cy="7" r="2.6" fill="#FF6A1A" />
            <circle cx="26" cy="7" r="2.6" fill="#34C3D9" />
            <circle cx="6" cy="25" r="2.6" fill="#34C3D9" />
            <circle cx="26" cy="25" r="2.6" fill="#FF6A1A" />
          </svg>
          <span>Industrial Nexus</span>
        </button>

        <div className="home-nav-links">
          <a href="#features" onClick={(e) => handleNavClick(e, "features")} className={activeSection === "features" ? "nav-active" : ""}>Features</a>
          <a href="#pricing" onClick={(e) => handleNavClick(e, "pricing")} className={activeSection === "pricing" ? "nav-active" : ""}>Pricing</a>
          <a href="#faq" onClick={(e) => handleNavClick(e, "faq")} className={activeSection === "faq" ? "nav-active" : ""}>FAQ</a>
          <a href="#contact" onClick={(e) => handleNavClick(e, "contact")} className={activeSection === "contact" ? "nav-active" : ""}>Contact</a>
        </div>

        <div className="home-nav-actions">
          <button className="btn-ghost" onClick={onGetStarted}>Login</button>
          <button className="btn-primary" onClick={onGetStarted}>Get Started</button>
        </div>

        {/* ---- Hamburger (mobile only) ---- */}
        <button
          className={`home-hamburger ${mobileMenuOpen ? "open" : ""}`}
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Toggle menu"
          aria-expanded={mobileMenuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </nav>

      <div className="home-hazard-rule" />

      {/* ---- Mobile menu overlay ---- */}
      <div className={`home-mobile-menu ${mobileMenuOpen ? "open" : ""}`}>
        <a href="#features" onClick={(e) => handleNavClick(e, "features")} className={activeSection === "features" ? "nav-active" : ""}>Features</a>
        <a href="#pricing" onClick={(e) => handleNavClick(e, "pricing")} className={activeSection === "pricing" ? "nav-active" : ""}>Pricing</a>
        <a href="#faq" onClick={(e) => handleNavClick(e, "faq")} className={activeSection === "faq" ? "nav-active" : ""}>FAQ</a>
        <a href="#contact" onClick={(e) => handleNavClick(e, "contact")} className={activeSection === "contact" ? "nav-active" : ""}>Contact</a>
        <div className="home-mobile-menu-actions">
          <button className="btn-ghost" onClick={() => { setMobileMenuOpen(false); onGetStarted(); }}>Login</button>
          <button className="btn-primary" onClick={() => { setMobileMenuOpen(false); onGetStarted(); }}>Get Started</button>
        </div>
      </div>
      {mobileMenuOpen && <div className="home-mobile-backdrop" onClick={() => setMobileMenuOpen(false)} />}

      {/* ===== Hero ===== */}
      <section className="home-hero">
        <div className="home-hero-video-wrap">
          <div className="home-hero-overlay" />
          <video autoPlay muted loop playsInline className="home-hero-video">
            <source src={videoSrc} type="video/mp4" />
          </video>
        </div>

        <div className="home-hero-glow home-hero-glow-1" />
        <div className="home-hero-glow home-hero-glow-2" />

        <div className="hero-corner hero-corner-tl" />
        <div className="hero-corner hero-corner-tr" />
        <div className="hero-corner hero-corner-bl" />
        <div className="hero-corner hero-corner-br" />
        <div className="hero-scanline" />

        <div className="hero-hud hero-hud-left">
          <span className="hero-hud-dot" />
          <span>SYSTEM ONLINE</span>
        </div>
        <div className="hero-hud hero-hud-right">
          <span className="hero-hud-dot" />
          <span>GRAPH ENGINE ACTIVE</span>
        </div>

        <div className="home-hero-content">
          <span className="home-hero-badge">Industrial Intelligence, Reimagined</span>
          <h1 className="home-hero-title">
            Turn scattered plant documents into <span className="home-hero-title-accent">cross-referenced knowledge</span>
          </h1>
          <p className="home-hero-sub">
            Industrial Nexus reads your manuals, reports, and procedures — then connects them
            into a living knowledge graph your team can actually query.
          </p>

          <div className="home-hero-actions">
            <button className="btn-primary btn-lg" onClick={onGetStarted}>
              Try Live Demo
            </button>
            <button className="btn-glass btn-lg" onClick={handleWatchExplainer}>
              <span className="btn-play-icon">▶</span> Watch Explainer
            </button>
          </div>
        </div>

        <button
          className="hero-scroll-cue"
          onClick={() => scrollToSection("features")}
          aria-label="Scroll to features"
        >
          <span className="hero-scroll-cue-mouse"><span></span></span>
        </button>
      </section>

      {/* ===== Ticker strip ===== */}
      <div className="home-ticker">
        <div className="home-ticker-track">
          {Array(2).fill([
            "PUMP-101", "BOILER-3", "VALVE-22", "COMPRESSOR-B", "OISD-105",
            "PUMP-104", "SP-45", "COOLING-TOWER-1", "TURBINE-A", "RELIEF-VALVE-9",
          ]).flat().map((tag, i) => (
            <span className="home-ticker-item" key={i}>
              <span className="home-ticker-dot" />
              {tag}
            </span>
          ))}
        </div>
      </div>

      {/* ===== Features ===== */}
      <section id="features" className="home-features" ref={addRevealRef}>
        <span className="home-section-watermark">01</span>
        <span className="home-section-eyebrow">// Capabilities</span>
        <h2 className="home-section-title">Built for engineering teams</h2>
        <p className="home-section-sub">
          Six capabilities working together — not separate tools.
        </p>

        <div className="home-features-grid">
          <div className="home-feature-card">
            <span className="home-feature-index">Feature 01</span>
            <span className="home-feature-icon">🕸</span>
            <h3>Knowledge Graph</h3>
            <p>Every equipment, incident, and procedure auto-linked across every document you upload.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-index">Feature 02</span>
            <span className="home-feature-icon">💬</span>
            <h3>Grounded Chat</h3>
            <p>Ask questions in plain English — answers cite the exact source document, every time.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-index">Feature 03</span>
            <span className="home-feature-icon">⚠</span>
            <h3>Risk Flagging</h3>
            <p>Equipment silently connected to past incidents gets surfaced before it becomes a problem.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-index">Feature 04</span>
            <span className="home-feature-icon">⚖</span>
            <h3>Compliance Gaps</h3>
            <p>Finds equipment linked to a procedure with no matching inspection record on file.</p>
          </div>
          <div className="home-feature-card home-feature-card-new">
            <span className="home-feature-new-badge">NEW</span>
            <span className="home-feature-index">Feature 05</span>
            <span className="home-feature-icon">📧</span>
            <h3>Email Auto-Import</h3>
            <p>Forward a report to your industry's dedicated inbox — it's extracted and added automatically.</p>
          </div>
          <div className="home-feature-card">
            <span className="home-feature-index">Feature 06</span>
            <span className="home-feature-icon">📊</span>
            <h3>Audit Trails</h3>
            <p>Complete traceability and logs for every query, document update, and graph extraction.</p>
          </div>
        </div>
      </section>

      {/* ===== Pricing ===== */}
      <section id="pricing" className="home-pricing" ref={addRevealRef}>
        <span className="home-section-watermark">02</span>
        <span className="home-section-eyebrow">// Pricing</span>
        <h2 className="home-section-title">Sized for your plant</h2>
        <p className="home-section-sub">Start on one unit, scale to the whole facility.</p>

        <div className="home-pricing-grid">
          <div className="pricing-card">
            <div className="pricing-tier">Pilot</div>
            <div className="pricing-price">Free<span>/team</span></div>
            <p className="pricing-desc">Test the knowledge graph on one industry workspace.</p>
            <ul className="pricing-features">
              <li>Up to 25 documents</li>
              <li>Grounded chat + citations</li>
              <li>Risk flagging</li>
              <li>1 industry workspace</li>
            </ul>
            <button className="btn-glass pricing-btn" onClick={onGetStarted}>Get Started</button>
          </div>

          <div className="pricing-card pricing-card-featured hazard-corner">
            <div className="pricing-tier">Operations</div>
            <div className="pricing-price">₹24,999<span>/month</span></div>
            <p className="pricing-desc">For a single plant running full-time on the graph.</p>
            <ul className="pricing-features">
              <li>Unlimited documents</li>
              <li>Cascading risk simulator</li>
              <li>Compliance gap detection</li>
              <li>Priority support</li>
            </ul>
            <button className="btn-primary pricing-btn" onClick={onGetStarted}>Get Started</button>
          </div>

          <div className="pricing-card">
            <div className="pricing-tier">Enterprise</div>
            <div className="pricing-price">Custom</div>
            <p className="pricing-desc">Multi-site rollouts with dedicated onboarding.</p>
            <ul className="pricing-features">
              <li>Multiple industry workspaces</li>
              <li>SSO &amp; access controls</li>
              <li>On-prem / private deployment</li>
              <li>Dedicated success manager</li>
            </ul>
            <button className="btn-glass pricing-btn" onClick={onGetStarted}>Talk to Us</button>
          </div>
        </div>
      </section>

      {/* ===== FAQ ===== */}
      <section id="faq" className="home-faq" ref={addRevealRef}>
        <span className="home-section-watermark">03</span>
        <span className="home-section-eyebrow">// Reference</span>
        <h2 className="home-section-title">Frequently asked questions</h2>
        <p className="home-section-sub">Everything you need to know before getting started.</p>
        <div className="home-faq-list">
          {faqs.map((item, i) => (
            <div key={i} className={`home-faq-item ${openFaq === i ? "open" : ""}`}>
              <button className="home-faq-question" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                <span>{item.q}</span>
                <span className="home-faq-icon">{openFaq === i ? "−" : "+"}</span>
              </button>
              <div className="home-faq-answer">
                <p>{item.a}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CTA band ===== */}
      <section className="home-cta-band" ref={addRevealRef}>
        <h2>Ready to see it on your own documents?</h2>
        <p>Create your industry workspace in under a minute.</p>
        <button className="btn-primary btn-lg" onClick={onGetStarted}>Get Started — It's Free</button>
      </section>

      {/* ===== Footer ===== */}
      <footer id="contact" className="home-footer">
        <div className="home-footer-brand">
          <div className="home-logo">
            <svg width="24" height="24" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <defs>
                <linearGradient id="homeFooterGradient" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FF6A1A" />
                  <stop offset="100%" stopColor="#34C3D9" />
                </linearGradient>
              </defs>
              <line x1="16" y1="16" x2="6" y2="7" stroke="url(#homeFooterGradient)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="16" y1="16" x2="26" y2="7" stroke="url(#homeFooterGradient)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="16" y1="16" x2="6" y2="25" stroke="url(#homeFooterGradient)" strokeWidth="1.6" strokeLinecap="round" />
              <line x1="16" y1="16" x2="26" y2="25" stroke="url(#homeFooterGradient)" strokeWidth="1.6" strokeLinecap="round" />
              <circle cx="16" cy="16" r="5.5" fill="url(#homeFooterGradient)" />
              <circle cx="6" cy="7" r="2.6" fill="#FF6A1A" />
              <circle cx="26" cy="7" r="2.6" fill="#34C3D9" />
              <circle cx="6" cy="25" r="2.6" fill="#34C3D9" />
              <circle cx="26" cy="25" r="2.6" fill="#FF6A1A" />
            </svg>
            <span>Industrial Nexus</span>
          </div>
          <p>Unified intelligence for the industrial world.</p>
        </div>

        <div className="home-footer-col">
          <h4>Product</h4>
          <a href="#features" onClick={(e) => handleNavClick(e, "features")}>Features</a>
          <a href="#pricing" onClick={(e) => handleNavClick(e, "pricing")}>Pricing</a>
          <a href="#faq" onClick={(e) => handleNavClick(e, "faq")}>FAQ</a>
        </div>

        <div className="home-footer-col">
          <h4>Company</h4>
          <a href="#contact" onClick={(e) => handleNavClick(e, "contact")}>Contact</a>
        </div>

        <p className="home-footer-copy">© 2026 Industrial Nexus. Built for Industry 4.0.</p>
      </footer>

      {/* ---- Back to top ---- */}
      <button
        className={`home-scroll-top ${showScrollTop ? "visible" : ""}`}
        onClick={handleScrollTop}
        aria-label="Back to top"
      >
        ↑
      </button>
    </div>
  );
}