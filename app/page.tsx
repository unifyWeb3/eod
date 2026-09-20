import { SiteHeader, Section } from '../components/site';
import { Hero, FlowStepper } from '../components/hero-flow';
import { ProofSection } from '../components/proof';
import {
  Problem,
  HowItWorks,
  UseCases,
  Architecture,
  Limitations,
  FinalCta,
} from '../components/sections';

export default function Page() {
  return (
    <>
      <SiteHeader />
      <main id="main">
        <Hero />
        <Section
          eyebrow="How it works"
          title="Five stages from policy to payment."
          lede="Deterministic code handles everything it can. Human judgment is replaced by validator consensus — only where it is actually needed."
        >
          <FlowStepper />
        </Section>
        <Section
          id="proof"
          eyebrow="Live proof"
          title="The complete path has already run."
          lede="A browser wallet created job-5. GenLayer validators judged it ACCEPT. An escrow released 0.01 test ETH. Every step is verifiable below."
        >
          <ProofSection />
        </Section>
        <Section
          eyebrow="Problem"
          title="Agent work has a verdict gap."
        >
          <Problem />
        </Section>
        <Section
          id="how"
          eyebrow="Method"
          title="Deterministic first, consensus for residue."
        >
          <HowItWorks />
        </Section>
        <Section eyebrow="Use cases" title="Where verdicts settle work.">
          <UseCases />
        </Section>
        <Section
          id="architecture"
          eyebrow="Architecture"
          title="GenLayer judges. It never holds the money."
          lede="Adjudication and custody stay separate by design — the contract that decides cannot spend, and the contract that spends cannot decide."
        >
          <Architecture />
        </Section>
        <Section
          eyebrow="Limitations"
          title="Honest about testnet."
        >
          <Limitations />
        </Section>
        <div className="mx-auto max-w-[1120px] px-6 pb-24">
          <FinalCta />
        </div>
      </main>
      <footer className="border-t border-[#E8E6E1]">
        <div className="mx-auto flex max-w-[1120px] flex-wrap items-center justify-between gap-3 px-6 py-8 text-sm text-[#5B6068]">
          <p>EOD — verdict infrastructure for agentic work. Testnets only.</p>
          <p>
            <a
              href="https://github.com/unifyWeb3/eod"
              className="hover:text-[#1A1D21]"
            >
              GitHub
            </a>{' '}
            ·{' '}
            <a href="/app" className="hover:text-[#1A1D21]">
              Launch app
            </a>
          </p>
        </div>
      </footer>
    </>
  );
}
