import { useMemo, useState } from 'react';
import demo from './data/demo.json';

const steps = ['Understand', 'Review', 'Confirm'];

export default function App() {
  const [step, setStep] = useState(0);
  const [demoMode, setDemoMode] = useState(true);
  const current = demo.steps[step];
  const progress = useMemo(() => `${step + 1} / ${steps.length}`, [step]);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">SD Worx hackathon prototype</p>
          <h1>{demo.productName}</h1>
        </div>
        <label className="mode">
          <input
            type="checkbox"
            checked={demoMode}
            onChange={(event) => setDemoMode(event.target.checked)}
          />
          Deterministic demo mode
        </label>
      </header>

      <section className="promise">
        <span>Demo promise</span>
        <strong>{demo.promise}</strong>
      </section>

      <nav aria-label="Demo progress" className="steps">
        {steps.map((label, index) => (
          <button
            className={index === step ? 'active' : ''}
            key={label}
            onClick={() => setStep(index)}
          >
            <span>{index + 1}</span>{label}
          </button>
        ))}
      </nav>

      <section className="card" aria-live="polite">
        <div className="card-meta">
          <span>Step {progress}</span>
          <span className="status">{demoMode ? 'Synthetic data' : 'Live adapter'}</span>
        </div>
        <h2>{current.title}</h2>
        <p>{current.description}</p>
        <div className="evidence">
          <span>Visible outcome</span>
          <strong>{current.outcome}</strong>
        </div>
        <div className="actions">
          <button className="secondary" disabled={step === 0} onClick={() => setStep(step - 1)}>
            Back
          </button>
          <button className="primary" disabled={step === steps.length - 1} onClick={() => setStep(step + 1)}>
            {step === steps.length - 1 ? 'Ready to pitch' : 'Continue'}
          </button>
        </div>
      </section>

      <footer>
        <span>Primary KPI</span>
        <strong>{demo.kpi}</strong>
        <small>{demo.disclosure}</small>
      </footer>
    </main>
  );
}
